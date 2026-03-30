const STATUS_CONFIG = {
  draft: { label: 'Draft', bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
  pending_approval: { label: 'În aprobare', bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  active: { label: 'Activ', bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
  archived: { label: 'Arhivat', bg: 'bg-slate-100', text: 'text-slate-400', dot: 'bg-slate-300' },
  pending: { label: 'În aprobare', bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  approved: { label: 'Aprobat', bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
  rejected: { label: 'Respins', bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
  cancelled: { label: 'Anulat', bg: 'bg-slate-100', text: 'text-slate-500', dot: 'bg-slate-400' },
};

export default function ApprovalBadge({ status, version, size = 'sm' }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  const sizeClass = size === 'xs' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-1';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${cfg.bg} ${cfg.text} ${sizeClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
      {version && <span className="opacity-60">v{version}</span>}
    </span>
  );
}
