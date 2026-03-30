import db from '../../config/db.js';
import { escapeLike } from '../../utils/sanitize.js';

// ─── Companies ────────────────────────────────────────────────────────────────

export async function listCompanies({ page = 1, limit = 50, companyType, active, search } = {}) {
  const offset = (page - 1) * limit;
  let q = db('companies.companies');
  if (companyType) q = q.whereRaw(`company_types @> ?::jsonb`, [JSON.stringify([companyType])]);
  if (active !== undefined) q = q.where('is_active', active === 'true' || active === true);
  if (search) q = q.where('name', 'ilike', `%${escapeLike(search)}%`);
  const [{ count }] = await q.clone().count('* as count');
  const data = await q.clone().orderBy('name').limit(limit).offset(offset);
  return { data, total: Number(count), page, limit };
}

export async function getCompany(id) {
  const company = await db('companies.companies').where({ id }).first();
  if (!company) return null;
  const contacts = await db('companies.contacts').where({ company_id: id }).orderBy('is_primary', 'desc');
  return { ...company, contacts };
}

export async function createCompany(data) {
  const [company] = await db('companies.companies').insert({
    name: data.name,
    company_types: data.companyTypes ? JSON.stringify(data.companyTypes) : JSON.stringify(['client']),
    fiscal_code: data.fiscalCode,
    trade_register: data.tradeRegister,
    address: data.address,
    city: data.city,
    country: data.country || 'Romania',
    phone: data.phone,
    email: data.email,
    website: data.website,
    payment_terms_days: data.paymentTermsDays ?? 30,
    notes: data.notes,
    is_active: data.isActive !== false,
  }).returning('*');
  return company;
}

export async function updateCompany(id, data) {
  const row = {};
  const map = {
    name: 'name', fiscalCode: 'fiscal_code',
    tradeRegister: 'trade_register', address: 'address', city: 'city',
    country: 'country', phone: 'phone', email: 'email', website: 'website',
    paymentTermsDays: 'payment_terms_days', notes: 'notes', isActive: 'is_active',
  };
  for (const [k, v] of Object.entries(map)) {
    if (data[k] !== undefined) row[v] = data[k];
  }
  if (data.companyTypes !== undefined) row.company_types = JSON.stringify(data.companyTypes);
  row.updated_at = new Date();
  const [company] = await db('companies.companies').where({ id }).update(row).returning('*');
  return company;
}

export async function softDeleteCompany(id) {
  const [company] = await db('companies.companies').where({ id }).update({ is_active: false, updated_at: new Date() }).returning('*');
  return company;
}

// ─── Contacts ─────────────────────────────────────────────────────────────────

export async function listContacts(companyId, { relationshipType, contextTag } = {}) {
  let q = db('companies.contacts').where({ company_id: companyId }).orderBy('is_primary', 'desc');
  if (relationshipType) q = q.where('relationship_type', relationshipType);
  if (contextTag) q = q.whereRaw(`context_tags @> ?::jsonb`, [JSON.stringify([contextTag])]);
  return q;
}

export async function createContact(companyId, data) {
  const [contact] = await db('companies.contacts').insert({
    company_id: companyId,
    full_name: data.fullName || data.name,
    role: data.role,
    phone: data.phone,
    email: data.email,
    is_primary: data.isPrimary || false,
    notes: data.notes,
    relationship_type: data.relationshipType || 'client_contact',
    context_tags: data.contextTags ? JSON.stringify(data.contextTags) : JSON.stringify([]),
    department: data.department || null,
  }).returning('*');
  return contact;
}

export async function updateContact(id, data) {
  const row = {};
  if (data.fullName !== undefined) row.full_name = data.fullName;
  if (data.role !== undefined) row.role = data.role;
  if (data.phone !== undefined) row.phone = data.phone;
  if (data.email !== undefined) row.email = data.email;
  if (data.isPrimary !== undefined) row.is_primary = data.isPrimary;
  if (data.notes !== undefined) row.notes = data.notes;
  if (data.relationshipType !== undefined) row.relationship_type = data.relationshipType;
  if (data.contextTags !== undefined) row.context_tags = JSON.stringify(data.contextTags);
  if (data.department !== undefined) row.department = data.department;
  const [contact] = await db('companies.contacts').where({ id }).update(row).returning('*');
  return contact;
}

// ─── Contact Assignments ──────────────────────────────────────────────────────

export async function assignContact(data, userId) {
  const [assignment] = await db('companies.contact_assignments').insert({
    contact_id: data.contactId,
    entity_type: data.entityType,
    entity_id: data.entityId,
    role_in_context: data.roleInContext || null,
    assigned_by: userId,
  }).returning('*');
  return assignment;
}

export async function getContactsForEntity(entityType, entityId) {
  return db('companies.contact_assignments as ca')
    .join('companies.contacts as ct', 'ca.contact_id', 'ct.id')
    .where({ 'ca.entity_type': entityType, 'ca.entity_id': entityId })
    .select('ct.*', 'ca.role_in_context', 'ca.assigned_at');
}

export async function deleteContact(id) {
  return db('companies.contacts').where({ id }).delete();
}
