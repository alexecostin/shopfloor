import db from '../config/db.js';
import logger from '../config/logger.js';

// ─── Version helpers ──────────────────────────────────────────────────────────

function incrementVersion(version) {
  const parts = version.split('.');
  const minor = parseInt(parts[1] || '0', 10) + 1;
  return `${parts[0]}.${minor}`;
}

// ─── Document callbacks ───────────────────────────────────────────────────────

const DOCUMENT_CALLBACKS = {
  mbom: {
    async onApproved(documentId, version, approvedBy) {
      await db('bom.products').where({ id: documentId }).update({
        approval_status: 'active',
        approved_at: new Date(),
        approved_by: approvedBy,
      });
    },
    async onRejected(documentId) {
      await db('bom.products').where({ id: documentId }).update({
        approval_status: 'draft',
      });
    },
    async getSnapshot(documentId) {
      const product = await db('bom.products').where({ id: documentId }).first();
      if (!product) return null;
      const operations = await db('bom.operations').where({ product_id: documentId });
      return { product, operations };
    },
  },
};

// ─── Core engine ─────────────────────────────────────────────────────────────

export async function submitForApproval(tenantId, documentType, documentId, documentReference, submittedBy, snapshotData = null) {
  // Get workflow
  const workflow = await db('approvals.workflow_definitions')
    .where({ tenant_id: tenantId, document_type: documentType, is_active: true })
    .first();
  if (!workflow) {
    const err = new Error(`Nu exista un flux de aprobare configurat pentru "${documentType}".`);
    err.statusCode = 400;
    err.code = 'WORKFLOW_NEGASIT';
    throw err;
  }

  // Get current version from document
  let currentVersion = '0.1';
  if (documentType === 'mbom') {
    const product = await db('bom.products').where({ id: documentId }).first();
    if (!product) {
      const err = new Error('Documentul nu a fost gasit.');
      err.statusCode = 404;
      throw err;
    }
    if (product.approval_status === 'pending_approval') {
      const err = new Error('Documentul este deja in curs de aprobare.');
      err.statusCode = 409;
      err.code = 'DEJA_IN_APROBARE';
      throw err;
    }
    currentVersion = product.current_version || '0.1';
  }

  // Cancel any existing pending requests for this document
  await db('approvals.approval_requests')
    .where({ document_type: documentType, document_id: documentId, status: 'pending' })
    .update({ status: 'cancelled', completed_at: new Date() });

  // Create approval request
  const [request] = await db('approvals.approval_requests').insert({
    tenant_id: tenantId,
    workflow_id: workflow.id,
    document_type: documentType,
    document_id: documentId,
    document_reference: documentReference,
    version: currentVersion,
    current_level: 1,
    total_levels: workflow.levels,
    status: 'pending',
    submitted_by: submittedBy,
  }).returning('*');

  // Create steps for each level
  const levelConfig = workflow.level_config || [];
  const steps = levelConfig.map((lvl) => ({
    request_id: request.id,
    level: lvl.level,
    level_label: lvl.label,
    status: lvl.level === 1 ? 'waiting' : 'waiting',
    required_role: lvl.role,
  }));
  await db('approvals.approval_steps').insert(steps);

  // Save snapshot
  const snapshot = snapshotData || (DOCUMENT_CALLBACKS[documentType]?.getSnapshot ? await DOCUMENT_CALLBACKS[documentType].getSnapshot(documentId) : {});
  await db('approvals.document_versions').insert({
    tenant_id: tenantId,
    document_type: documentType,
    document_id: documentId,
    version: currentVersion,
    snapshot: JSON.stringify(snapshot),
    created_by: submittedBy,
    approval_request_id: request.id,
  });

  // Update document status
  if (documentType === 'mbom') {
    await db('bom.products').where({ id: documentId }).update({ approval_status: 'pending_approval' });
  }

  // Notify L1 approver (async, non-blocking)
  notifyLevel(request, 1, levelConfig).catch(e => logger.error('Notify L1 error', { error: e.message }));

  return { request, stepsCreated: steps.length };
}

export async function approveStep(requestId, userId, comment = '') {
  const request = await db('approvals.approval_requests').where({ id: requestId }).first();
  if (!request) {
    const err = new Error('Cererea de aprobare nu a fost gasita.'); err.statusCode = 404; throw err;
  }
  if (request.status !== 'pending') {
    const err = new Error('Aceasta cerere nu mai este in asteptare.'); err.statusCode = 409; throw err;
  }

  // Find current step
  const step = await db('approvals.approval_steps')
    .where({ request_id: requestId, level: request.current_level, status: 'waiting' })
    .first();
  if (!step) {
    const err = new Error('Nu exista un pas in asteptare pentru nivelul curent.'); err.statusCode = 404; throw err;
  }

  // Verify user role
  const user = await db('auth.users').where({ id: userId }).first();
  if (step.required_role && user?.role !== step.required_role && user?.role !== 'admin') {
    // Also check auth.user_roles for the new RBAC
    const hasRole = await db('auth.user_roles as ur')
      .join('auth.roles as r', 'ur.role_id', 'r.id')
      .where({ 'ur.user_id': userId, 'r.code': step.required_role })
      .first();
    if (!hasRole) {
      const err = new Error(`Necesiti rolul "${step.required_role}" pentru a aproba acest nivel.`);
      err.statusCode = 403; err.code = 'ROL_INSUFICIENT'; throw err;
    }
  }

  // Approve the step
  await db('approvals.approval_steps').where({ id: step.id }).update({
    status: 'approved',
    decided_by: userId,
    decided_at: new Date(),
    comment: comment || null,
  });

  const isLastLevel = request.current_level >= request.total_levels;

  if (isLastLevel) {
    // Final approval
    await db('approvals.approval_requests').where({ id: requestId }).update({
      status: 'approved',
      completed_at: new Date(),
      final_comment: comment || null,
    });

    // Callbacks
    const cb = DOCUMENT_CALLBACKS[request.document_type];
    if (cb?.onApproved) {
      await cb.onApproved(request.document_id, request.version, userId);
    }

    notifySubmitter(request, 'approved', comment).catch(() => {});
    return { status: 'approved', message: 'Document aprobat complet.' };
  } else {
    // Advance to next level
    const nextLevel = request.current_level + 1;
    await db('approvals.approval_requests').where({ id: requestId }).update({ current_level: nextLevel });

    // Get workflow for notification
    const workflow = await db('approvals.workflow_definitions').where({ id: request.workflow_id }).first();
    const levelConfig = workflow?.level_config || [];
    notifyLevel(request, nextLevel, levelConfig).catch(() => {});

    return { status: 'pending', message: `Aprobat nivelul ${request.current_level}. Asteapta nivel ${nextLevel}.` };
  }
}

export async function rejectStep(requestId, userId, comment = '') {
  const request = await db('approvals.approval_requests').where({ id: requestId }).first();
  if (!request) {
    const err = new Error('Cererea de aprobare nu a fost gasita.'); err.statusCode = 404; throw err;
  }
  if (request.status !== 'pending') {
    const err = new Error('Aceasta cerere nu mai este in asteptare.'); err.statusCode = 409; throw err;
  }

  const step = await db('approvals.approval_steps')
    .where({ request_id: requestId, level: request.current_level, status: 'waiting' })
    .first();
  if (!step) {
    const err = new Error('Nu exista un pas in asteptare.'); err.statusCode = 404; throw err;
  }

  // Verify user role
  const user = await db('auth.users').where({ id: userId }).first();
  if (step.required_role && user?.role !== step.required_role && user?.role !== 'admin') {
    const hasRole = await db('auth.user_roles as ur')
      .join('auth.roles as r', 'ur.role_id', 'r.id')
      .where({ 'ur.user_id': userId, 'r.code': step.required_role })
      .first();
    if (!hasRole) {
      const err = new Error(`Necesiti rolul "${step.required_role}" pentru a respinge acest nivel.`);
      err.statusCode = 403; err.code = 'ROL_INSUFICIENT'; throw err;
    }
  }

  await db('approvals.approval_steps').where({ id: step.id }).update({
    status: 'rejected',
    decided_by: userId,
    decided_at: new Date(),
    comment: comment || null,
  });

  await db('approvals.approval_requests').where({ id: requestId }).update({
    status: 'rejected',
    completed_at: new Date(),
    final_comment: comment || null,
  });

  // Callbacks
  const cb = DOCUMENT_CALLBACKS[request.document_type];
  if (cb?.onRejected) {
    await cb.onRejected(request.document_id);
  }

  notifySubmitter(request, 'rejected', comment).catch(() => {});
  return { status: 'rejected', message: 'Document respins.' };
}

export async function getApprovalStatus(documentType, documentId) {
  const request = await db('approvals.approval_requests')
    .where({ document_type: documentType, document_id: documentId })
    .orderBy('submitted_at', 'desc')
    .first();
  if (!request) return null;

  const steps = await db('approvals.approval_steps')
    .where({ request_id: request.id })
    .orderBy('level', 'asc');

  return { ...request, steps };
}

export async function getPendingApprovals(userId, tenantId) {
  // Get user's roles
  const user = await db('auth.users').where({ id: userId }).first();
  const userRoles = [user?.role].filter(Boolean);

  // Also check new RBAC roles
  const rbacRoles = await db('auth.user_roles as ur')
    .join('auth.roles as r', 'ur.role_id', 'r.id')
    .where({ 'ur.user_id': userId })
    .pluck('r.code');

  const allRoles = [...new Set([...userRoles, ...rbacRoles, 'admin'])];

  // Find steps waiting for one of user's roles
  const steps = await db('approvals.approval_steps as s')
    .join('approvals.approval_requests as r', 's.request_id', 'r.id')
    .where('s.status', 'waiting')
    .where('r.status', 'pending')
    .where('r.tenant_id', tenantId)
    .whereRaw('r.current_level = s.level')
    .whereIn('s.required_role', allRoles)
    .select('r.*', 's.level_label', 's.required_role', 's.id as step_id');

  return steps;
}

export async function getMySubmissions(userId, tenantId) {
  return db('approvals.approval_requests')
    .where({ submitted_by: userId, tenant_id: tenantId })
    .orderBy('submitted_at', 'desc');
}

export async function getRequestDetail(requestId) {
  const request = await db('approvals.approval_requests').where({ id: requestId }).first();
  if (!request) return null;
  const steps = await db('approvals.approval_steps as s')
    .leftJoin('auth.users as u', 's.decided_by', 'u.id')
    .where('s.request_id', requestId)
    .orderBy('s.level', 'asc')
    .select('s.*', 'u.full_name as decided_by_name');
  return { ...request, steps };
}

export async function getDocumentVersions(documentType, documentId) {
  return db('approvals.document_versions')
    .where({ document_type: documentType, document_id: documentId })
    .orderBy('created_at', 'desc');
}

export async function getDocumentHistory(documentType, documentId) {
  return db('approvals.approval_requests as r')
    .leftJoin('auth.users as u', 'r.submitted_by', 'u.id')
    .where({ 'r.document_type': documentType, 'r.document_id': documentId })
    .orderBy('r.submitted_at', 'desc')
    .select('r.*', 'u.full_name as submitted_by_name');
}

// Called when an approved document is modified — resets to draft and bumps version
export async function onDocumentModified(documentType, documentId, tenantId, modifiedBy) {
  if (documentType === 'mbom') {
    const product = await db('bom.products').where({ id: documentId }).first();
    if (!product || product.approval_status !== 'active') return;

    const newVersion = incrementVersion(product.current_version || '0.1');
    await db('bom.products').where({ id: documentId }).update({
      approval_status: 'draft',
      current_version: newVersion,
      approved_at: null,
      approved_by: null,
    });

    // Cancel active approval if any
    await db('approvals.approval_requests')
      .where({ document_type: documentType, document_id: documentId, status: 'pending' })
      .update({ status: 'cancelled', completed_at: new Date() });

    logger.info('MBOM reset to draft after modification', { documentId, newVersion });
  }
}

// ─── Notification helpers ─────────────────────────────────────────────────────

async function notifyLevel(request, level, levelConfig) {
  const lvlConf = levelConfig.find(l => l.level === level);
  if (!lvlConf) return;

  // Find users with required role
  const users = await db('auth.users')
    .where({ role: lvlConf.role, is_active: true })
    .catch(() => []);

  for (const user of users) {
    try {
      const { sendNotification } = await import('./email.service.js');
      await sendNotification({
        type: 'approval_required',
        data: {
          to: user.email,
          documentType: request.document_type,
          documentReference: request.document_reference,
          level: lvlConf.level,
          levelLabel: lvlConf.label,
          requestId: request.id,
        },
      });
    } catch (_) { /* non-critical */ }
  }
}

async function notifySubmitter(request, outcome, comment) {
  const submitter = await db('auth.users').where({ id: request.submitted_by }).first().catch(() => null);
  if (!submitter) return;
  try {
    const { sendNotification } = await import('./email.service.js');
    await sendNotification({
      type: outcome === 'approved' ? 'approval_final_approved' : 'approval_rejected',
      data: {
        to: submitter.email,
        documentType: request.document_type,
        documentReference: request.document_reference,
        comment,
      },
    });
  } catch (_) { /* non-critical */ }
}
