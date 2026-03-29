import logger from '../config/logger.js';

export function auditLog(db) {
  return async (req, res, next) => {
    if (!['POST', 'PUT', 'DELETE'].includes(req.method)) {
      return next();
    }

    const originalJson = res.json.bind(res);
    res.json = async (body) => {
      if (res.statusCode < 400 && db) {
        try {
          const resourceId =
            req.params.id ||
            (body && (body.id || (body.data && body.data.id))) ||
            null;

          await db('audit.audit_log').insert({
            user_id: req.user?.userId || null,
            action: req.method,
            resource: req.path,
            resource_id: resourceId,
            ip_address: req.ip,
            details: JSON.stringify(req.body),
          });
        } catch (err) {
          logger.error('Audit log error', { error: err.message });
        }
      }
      return originalJson(body);
    };

    next();
  };
}
