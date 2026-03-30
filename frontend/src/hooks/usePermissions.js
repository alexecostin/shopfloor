import { useAuth } from '../context/AuthContext';

export function usePermissions() {
  const { user } = useAuth();

  const hasPermission = (permissionCode) => {
    if (!user) return false;
    const perms = user.permissions;
    if (!perms) return user.role === 'admin'; // legacy fallback
    if (perms.includes('*')) return true; // admin wildcard
    return perms.includes(permissionCode);
  };

  const hasModule = (moduleCode) => {
    if (!user) return false;
    const mods = user.activeModules;
    if (!mods) return true; // legacy: allow all
    return mods.includes(moduleCode);
  };

  const hasRole = (roleCode) => {
    if (!user) return false;
    const roles = user.roles;
    if (!roles) return user.role === roleCode; // legacy fallback
    return roles.includes(roleCode);
  };

  const canAccess = (orgUnitId) => {
    if (!user) return false;
    const scopes = user.scopes;
    if (!scopes || scopes.length === 0) return true; // no scopes = admin access
    return scopes.some(s => s.orgUnitId === orgUnitId);
  };

  const currentScopes = user?.scopes || [];
  const tier = user?.tier || 'basic';
  const licenseStatus = user?.licenseStatus || 'active';

  return { hasPermission, hasModule, hasRole, canAccess, currentScopes, tier, licenseStatus };
}
