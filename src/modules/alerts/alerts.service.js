import db from '../../config/db.js';
import { checkAllRules } from '../../services/alert-engine.service.js';

export const listRules = () => db('alerts.rule_definitions').orderBy('severity').orderBy('name');
export const createRule = async data => {
  const [r] = await db('alerts.rule_definitions').insert({ ...data, is_predefined: false }).returning('*');
  return r;
};
export const updateRule = async (id, data) => {
  const [r] = await db('alerts.rule_definitions').where('id', id).update(data).returning('*');
  return r;
};
export const deleteRule = async id => {
  const rule = await db('alerts.rule_definitions').where('id', id).first();
  if (rule?.is_predefined) throw Object.assign(new Error('Regulile predefinite nu pot fi sterse.'), { statusCode: 400 });
  return db('alerts.rule_definitions').where('id', id).delete();
};

export const listChannels = ruleId => db('alerts.notification_channels').where('rule_id', ruleId);
export const createChannel = async (ruleId, data) => {
  const [r] = await db('alerts.notification_channels').insert({ rule_id: ruleId, ...data }).returning('*');
  return r;
};
export const deleteChannel = async id => db('alerts.notification_channels').where('id', id).delete();

export const listAlerts = ({ status, severity, type } = {}) => {
  let q = db('alerts.alerts as a')
    .join('alerts.rule_definitions as rd', 'a.rule_id', 'rd.id')
    .select('a.*', 'rd.code as rule_code', 'rd.name as rule_name')
    .orderBy('a.created_at', 'desc');
  if (status) q = q.where('a.status', status);
  if (severity) q = q.where('a.severity', severity);
  if (type) q = q.where('rd.code', type);
  return q;
};

export const getAlertCount = async () => {
  const rows = await db('alerts.alerts').where('status', 'new').select('severity').count('* as cnt').groupBy('severity');
  const result = { new: 0, warning: 0, critical: 0 };
  for (const r of rows) {
    result.new += Number(r.cnt);
    result[r.severity] = Number(r.cnt);
  }
  return result;
};

export const acknowledgeAlert = async (id, userId) => {
  const [r] = await db('alerts.alerts').where('id', id)
    .update({ status: 'seen', acknowledged_by: userId, acknowledged_at: new Date() })
    .returning('*');
  return r;
};

export const resolveAlert = async (id, userId) => {
  const [r] = await db('alerts.alerts').where('id', id)
    .update({ status: 'resolved', resolved_by: userId, resolved_at: new Date() })
    .returning('*');
  return r;
};

export const runCheck = checkAllRules;
