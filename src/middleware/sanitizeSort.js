/**
 * Middleware to whitelist sort fields and directions from query params.
 * Prevents SQL injection via ORDER BY clause.
 *
 * Usage:
 *   router.get('/items', sanitizeSort(['code', 'name', 'created_at']), controller.list);
 */
export function sanitizeSort(allowedFields) {
  return (req, res, next) => {
    if (req.query.sortBy && !allowedFields.includes(req.query.sortBy)) {
      req.query.sortBy = allowedFields[0] || 'created_at';
    }
    if (req.query.sortDir) {
      const dir = req.query.sortDir.toLowerCase();
      if (dir !== 'asc' && dir !== 'desc') {
        req.query.sortDir = 'desc';
      }
    }
    next();
  };
}

export default sanitizeSort;
