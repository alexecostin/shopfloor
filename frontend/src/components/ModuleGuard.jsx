import { usePermissions } from '../hooks/usePermissions';

export default function ModuleGuard({ module: moduleCode, upsellMessage, children }) {
  const { hasModule, tier } = usePermissions();

  if (!hasModule(moduleCode)) {
    const tierMap = { basic: 'Basic', professional: 'Professional', enterprise: 'Enterprise' };
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md p-8 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🔒</span>
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Functionalitate indisponibila</h3>
          <p className="text-slate-500 text-sm mb-4">
            {upsellMessage || `Aceasta functionalitate nu este inclusa in planul tau curent (${tierMap[tier] || tier}).`}
          </p>
          <span className="inline-block bg-blue-100 text-blue-700 text-xs font-medium px-3 py-1 rounded-full">
            Contacteaza administratorul pentru upgrade
          </span>
        </div>
      </div>
    );
  }

  return children;
}
