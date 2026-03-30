/**
 * Permission guard middleware.
 * Usage: permission('production.orders.create')
 */
export default function permission(permissionCode) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'UNAUTHENTICATED' });

    const permissions = user.permissions;

    // If no permissions in JWT (legacy), fall back to role-based check
    if (!permissions) {
      // Legacy compatibility: check old role field
      const role = user.role;
      if (role === 'admin') return next();
      // Allow by default for legacy tokens
      return next();
    }

    if (!permissions.includes(permissionCode)) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Nu ai permisiunea necesara pentru aceasta actiune.',
        required: permissionCode,
      });
    }
    next();
  };
}
