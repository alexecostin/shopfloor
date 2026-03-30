/**
 * Module guard middleware.
 * Usage: router.use(moduleGuard('planning'))
 * Checks that the tenant has the module active (from JWT activeModules).
 */
export default function moduleGuard(moduleCode) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'UNAUTHENTICATED' });

    const activeModules = user.activeModules;

    // If no activeModules in JWT (legacy), allow everything
    if (!activeModules) return next();

    if (!activeModules.includes(moduleCode)) {
      // Determine upsell tier
      const professionalModules = ['hr_skills', 'inventory', 'import_export', 'reports_advanced', 'alerts', 'companies'];
      const enterpriseModules = ['bom_mbom', 'tools', 'planning', 'simulation', 'costs_realtime', 'setup_times'];

      let upsellTier = 'professional';
      if (enterpriseModules.includes(moduleCode)) upsellTier = 'enterprise';

      return res.status(403).json({
        error: 'MODULE_INACTIVE',
        message: `Aceasta functionalitate este disponibila in pachetul ${upsellTier === 'enterprise' ? 'Enterprise' : 'Professional'}.`,
        upsellTier,
        moduleCode,
      });
    }
    next();
  };
}
