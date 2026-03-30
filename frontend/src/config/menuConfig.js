// Dynamic menu config — getMenuForUser(user) returns filtered menu items

const ALL_MENUS = {
  operator: [
    { id: 'operator-home', label: 'Acasa', icon: 'Home', path: '/', module: null, permission: null },
    { id: 'operator-report', label: 'Raporteaza', icon: 'ClipboardList', path: '/production/report', module: 'production', permission: null },
    { id: 'operator-stop', label: 'Oprire Masina', icon: 'AlertOctagon', path: '/production/stop', module: 'production', permission: null },
    { id: 'operator-maintenance', label: 'Cerere Mentenanta', icon: 'Wrench', path: '/maintenance/request', module: 'maintenance', permission: null },
    { id: 'operator-checklist', label: 'Checklist', icon: 'CheckSquare', path: '/checklists', module: 'checklists', permission: null },
    { id: 'operator-leave', label: 'Concediu', icon: 'Calendar', path: '/leave', module: null, permission: null },
  ],

  shift_leader: [
    { id: 'sl-dashboard', label: 'Dashboard Tura', icon: 'LayoutDashboard', path: '/', module: null, permission: null },
    {
      id: 'sl-production', label: 'Productie', icon: 'Factory', path: '/production', module: 'production', permission: null,
      children: [
        { id: 'sl-prod-reports', label: 'Rapoarte', path: '/production/reports', permission: 'production.reports.view_all' },
        { id: 'sl-prod-stops', label: 'Opriri', path: '/production/stops', permission: 'production.stops.create' },
        { id: 'sl-prod-oee', label: 'OEE', path: '/production/oee', permission: null },
      ]
    },
    {
      id: 'sl-team', label: 'Echipa', icon: 'Users', path: '/team', module: 'hr_skills', permission: null,
      children: [
        { id: 'sl-attendance', label: 'Prezenta', path: '/skill-matrix', permission: null },
        { id: 'sl-leave', label: 'Concedii', path: '/leave', permission: null },
        { id: 'sl-skills', label: 'Competente', path: '/skill-matrix', permission: null },
      ]
    },
    { id: 'sl-maintenance', label: 'Mentenanta', icon: 'Wrench', path: '/maintenance', module: 'maintenance', permission: null },
    { id: 'sl-checklists', label: 'Checklists', icon: 'CheckSquare', path: '/checklists', module: 'checklists', permission: null },
    { id: 'sl-reports', label: 'Rapoarte', icon: 'BarChart2', path: '/reports', module: 'reports_advanced', permission: null },
  ],

  production_manager: [
    { id: 'pm-dashboard', label: 'Dashboard', icon: 'LayoutDashboard', path: '/', module: null, permission: null },
    {
      id: 'pm-planning', label: 'Planificare', icon: 'Calendar', path: '/planning', module: 'planning', permission: null,
      children: [
        { id: 'pm-plan-gantt', label: 'Gantt', path: '/planning', permission: null },
        { id: 'pm-plan-generate', label: 'Genereaza Plan', path: '/planning', permission: null },
        { id: 'pm-plan-capacity', label: 'Capacitate', path: '/planning', permission: null },
        { id: 'pm-plan-simulations', label: 'Simulari', path: '/planning', module: 'simulation', permission: null },
      ]
    },
    { id: 'pm-bom', label: 'BOM / MBOM', icon: 'Package', path: '/bom', module: 'bom_mbom', permission: null,
      children: [
        { id: 'pm-bom-catalog', label: 'Catalog', path: '/bom', permission: null },
        { id: 'pm-bom-approvals', label: 'Aprobari', path: '/approvals', permission: 'approvals.approve' },
      ]
    },
    { id: 'pm-workorders', label: 'Comenzi Lucru', icon: 'FileText', path: '/work-orders', module: 'work_orders', permission: null },
    { id: 'pm-production', label: 'Productie', icon: 'Factory', path: '/production', module: 'production', permission: null },
    { id: 'pm-machines', label: 'Utilaje', icon: 'Cpu', path: '/machines', module: 'machines', permission: null },
    { id: 'pm-reports', label: 'Rapoarte P/R/R', icon: 'BarChart2', path: '/reports', module: 'reports_advanced', permission: null },
    { id: 'pm-scheduling', label: 'Planificare Auto', icon: 'Zap', path: '/scheduling', module: 'planning', permission: null },
    { id: 'pm-setup', label: 'Timpi Setup', icon: 'Timer', path: '/setup', module: 'setup_times', permission: null },
  ],

  director: [
    { id: 'dir-dashboard', label: 'Dashboard Executiv', icon: 'LayoutDashboard', path: '/', module: null, permission: null },
    { id: 'dir-costs', label: 'Costuri & Profit', icon: 'DollarSign', path: '/costs', module: 'costs_realtime', permission: null,
      children: [
        { id: 'dir-costs-orders', label: 'Pe comanda', path: '/costs', permission: null },
        { id: 'dir-costs-pieces', label: 'Pe piesa', path: '/costs', permission: null },
        { id: 'dir-costs-trend', label: 'Trend', path: '/costs', permission: null },
      ]
    },
    { id: 'dir-orders', label: 'Comenzi', icon: 'ClipboardList', path: '/work-orders', module: 'work_orders', permission: null },
    { id: 'dir-production', label: 'Productie', icon: 'Factory', path: '/production', module: 'production', permission: null },
    { id: 'dir-alerts', label: 'Alerte', icon: 'Bell', path: '/alerts', module: 'alerts', permission: null },
    { id: 'dir-reports', label: 'Rapoarte', icon: 'BarChart2', path: '/reports', module: 'reports_advanced', permission: null },
    { id: 'dir-hr', label: 'Personal', icon: 'Users', path: '/skill-matrix', module: 'hr_skills', permission: null },
    { id: 'dir-companies', label: 'Companii', icon: 'Building2', path: '/companies', module: 'companies', permission: null },
  ],

  maintenance: [
    { id: 'mnt-dashboard', label: 'Dashboard Mentenanta', icon: 'LayoutDashboard', path: '/', module: null, permission: null },
    { id: 'mnt-requests', label: 'Interventii', icon: 'AlertTriangle', path: '/maintenance', module: 'maintenance', permission: null,
      children: [
        { id: 'mnt-open', label: 'Noi / In lucru', path: '/maintenance', permission: null },
        { id: 'mnt-all', label: 'Toate', path: '/maintenance', permission: null },
      ]
    },
    { id: 'mnt-planned', label: 'Planificate', icon: 'Calendar', path: '/maintenance/planned', module: 'maintenance', permission: null },
    { id: 'mnt-tools', label: 'Scule & Matrite', icon: 'Settings', path: '/tools', module: 'tools', permission: null },
    { id: 'mnt-machines', label: 'Utilaje', icon: 'Cpu', path: '/machines', module: 'machines', permission: null },
    { id: 'mnt-reports', label: 'Rapoarte', icon: 'FileText', path: '/reports', module: null, permission: null },
  ],

  logistics: [
    { id: 'log-dashboard', label: 'Dashboard Stocuri', icon: 'LayoutDashboard', path: '/', module: null, permission: null },
    { id: 'log-inventory', label: 'Stocuri', icon: 'Package', path: '/inventory', module: 'inventory', permission: null,
      children: [
        { id: 'log-items', label: 'Articole', path: '/inventory', permission: null },
        { id: 'log-alerts', label: 'Alerte stoc', path: '/alerts', permission: null },
        { id: 'log-receipts', label: 'Receptii', path: '/inventory', permission: null },
      ]
    },
    { id: 'log-suppliers', label: 'Furnizori', icon: 'Truck', path: '/companies', module: 'companies', permission: null },
    { id: 'log-import', label: 'Import', icon: 'Upload', path: '/import', module: 'import_export', permission: null },
    { id: 'log-reports', label: 'Rapoarte stocuri', icon: 'BarChart2', path: '/reports', module: 'reports_advanced', permission: null },
  ],

  viewer: [
    { id: 'view-dashboard', label: 'Dashboard', icon: 'LayoutDashboard', path: '/', module: null, permission: null },
    { id: 'view-reports', label: 'Rapoarte', icon: 'BarChart2', path: '/reports', module: 'reports_advanced', permission: null },
  ],

  admin: [
    { id: 'adm-dashboard', label: 'Dashboard', icon: 'LayoutDashboard', path: '/', module: null, permission: null },
    { id: 'adm-production', label: 'Productie', icon: 'Factory', path: '/production', module: 'production', permission: null },
    { id: 'adm-machines', label: 'Utilaje', icon: 'Cpu', path: '/machines', module: 'machines', permission: null },
    { id: 'adm-maintenance', label: 'Mentenanta', icon: 'Wrench', path: '/maintenance', module: 'maintenance', permission: null },
    { id: 'adm-planning', label: 'Planificare', icon: 'Calendar', path: '/planning', module: 'planning', permission: null },
    { id: 'adm-bom', label: 'BOM', icon: 'Package', path: '/bom', module: 'bom_mbom', permission: null },
    { id: 'adm-workorders', label: 'Comenzi', icon: 'FileText', path: '/work-orders', module: 'work_orders', permission: null },
    { id: 'adm-inventory', label: 'Stocuri', icon: 'Package', path: '/inventory', module: 'inventory', permission: null },
    { id: 'adm-companies', label: 'Companii', icon: 'Building2', path: '/companies', module: 'companies', permission: null },
    { id: 'adm-costs', label: 'Costuri', icon: 'DollarSign', path: '/costs', module: 'costs_realtime', permission: null },
    { id: 'adm-reports', label: 'Rapoarte', icon: 'BarChart2', path: '/reports', module: 'reports_advanced', permission: null },
    { id: 'adm-alerts', label: 'Alerte', icon: 'Bell', path: '/alerts', module: 'alerts', permission: null },
    { id: 'adm-import', label: 'Import', icon: 'Upload', path: '/import', module: 'import_export', permission: null },
    { id: 'adm-approvals', label: 'Aprobari', icon: 'CheckCircle', path: '/approvals', module: null, permission: null },
    { id: 'adm-users', label: 'Utilizatori', icon: 'Users', path: '/users', module: null, permission: null },
    { id: 'adm-admin', label: 'Administrare', icon: 'Settings', path: '/admin', module: null, permission: null },
    { id: 'adm-shifts', label: 'Ture', icon: 'Clock', path: '/shifts', module: null, permission: null },
    { id: 'adm-lookups', label: 'Configurare Liste', icon: 'List', path: '/lookups', module: null, permission: null },
    { id: 'adm-currency', label: 'Monede & Cursuri', icon: 'DollarSign', path: '/currency', module: null, permission: null },
    { id: 'adm-scheduling', label: 'Planificare Auto', icon: 'Zap', path: '/scheduling', module: 'planning', permission: null },
    { id: 'adm-setup', label: 'Timpi Setup', icon: 'Timer', path: '/setup', module: 'setup_times', permission: null },
    { id: 'adm-audit', label: 'Audit Trail', icon: 'History', path: '/audit', module: null, permission: null },
    { id: 'adm-rework', label: 'Reprelucrare', icon: 'RefreshCw', path: '/rework', module: 'production', permission: null },
    { id: 'adm-barcodes', label: 'Coduri QR', icon: 'QrCode', path: '/barcodes', module: null, permission: null },
  ],
};

// Role aliases
ALL_MENUS.planner = ALL_MENUS.production_manager;

export function getMenuForUser(user) {
  if (!user) return [];

  const activeModules = user.activeModules || null; // null = legacy (show all)
  const permissions = user.permissions || null; // null = legacy

  // Get all roles from both legacy role field and new roles array
  const roles = [];
  if (user.role) roles.push(user.role);
  if (user.roles && Array.isArray(user.roles)) roles.push(...user.roles);
  const uniqueRoles = [...new Set(roles)];

  // Collect items from all roles (union)
  const seenIds = new Set();
  const allItems = [];

  for (const role of uniqueRoles) {
    const roleMenu = ALL_MENUS[role] || [];
    for (const item of roleMenu) {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        allItems.push(item);
      }
    }
  }

  // Filter by module and permission
  function isVisible(item) {
    if (activeModules && item.module && !activeModules.includes(item.module)) return false;
    if (permissions && item.permission && !permissions.includes(item.permission)) return false;
    return true;
  }

  return allItems
    .filter(item => isVisible(item))
    .map(item => {
      if (!item.children) return item;
      const visibleChildren = item.children.filter(isVisible);
      if (visibleChildren.length === 0) return null; // hide parent if no visible children
      return { ...item, children: visibleChildren };
    })
    .filter(Boolean);
}

export function getBottomNavForRole(roles) {
  const role = roles?.[0] || 'operator';
  const roleSet = new Set(roles || []);

  // Operator with maintenance dual-role gets extra maintenance tab
  if (role === 'operator' && roleSet.has('maintenance')) {
    return [
      { icon: 'Home', label: 'Acasa', path: '/' },
      { icon: 'ClipboardList', label: 'Productie', path: '/production' },
      { icon: 'Wrench', label: 'Mentenanta', path: '/maintenance' },
      { icon: 'User', label: 'Profil', path: '/profile' },
    ];
  }

  const configs = {
    operator: [
      { icon: 'Home', label: 'Acasa', path: '/' },
      { icon: 'ClipboardList', label: 'Productie', path: '/production' },
      { icon: 'Wrench', label: 'Mentenanta', path: '/maintenance/request' },
      { icon: 'User', label: 'Profil', path: '/profile' },
    ],
    shift_leader: [
      { icon: 'LayoutDashboard', label: 'Dashboard', path: '/' },
      { icon: 'Factory', label: 'Productie', path: '/production' },
      { icon: 'Users', label: 'Echipa', path: '/skill-matrix' },
      { icon: 'FileText', label: 'Rapoarte', path: '/reports' },
      { icon: 'User', label: 'Profil', path: '/profile' },
    ],
    production_manager: [
      { icon: 'LayoutDashboard', label: 'Dashboard', path: '/' },
      { icon: 'Calendar', label: 'Planning', path: '/planning' },
      { icon: 'FileText', label: 'Comenzi', path: '/work-orders' },
      { icon: 'BarChart2', label: 'Rapoarte', path: '/reports' },
      { icon: 'User', label: 'Profil', path: '/profile' },
    ],
    director: [
      { icon: 'LayoutDashboard', label: 'Dashboard', path: '/' },
      { icon: 'DollarSign', label: 'Costuri', path: '/costs' },
      { icon: 'ClipboardList', label: 'Comenzi', path: '/work-orders' },
      { icon: 'Bell', label: 'Alerte', path: '/alerts' },
      { icon: 'User', label: 'Profil', path: '/profile' },
    ],
    maintenance: [
      { icon: 'LayoutDashboard', label: 'Dashboard', path: '/' },
      { icon: 'AlertTriangle', label: 'Interventii', path: '/maintenance' },
      { icon: 'Settings', label: 'Scule', path: '/tools' },
      { icon: 'Calendar', label: 'Planificate', path: '/maintenance/planned' },
      { icon: 'User', label: 'Profil', path: '/profile' },
    ],
    logistics: [
      { icon: 'LayoutDashboard', label: 'Dashboard', path: '/' },
      { icon: 'Package', label: 'Stocuri', path: '/inventory' },
      { icon: 'List', label: 'Necesar', path: '/inventory' },
      { icon: 'Upload', label: 'Import', path: '/import' },
      { icon: 'User', label: 'Profil', path: '/profile' },
    ],
    admin: [
      { icon: 'LayoutDashboard', label: 'Dashboard', path: '/' },
      { icon: 'Users', label: 'Utilizatori', path: '/users' },
      { icon: 'Bell', label: 'Alerte', path: '/alerts' },
      { icon: 'Settings', label: 'Admin', path: '/admin' },
      { icon: 'User', label: 'Profil', path: '/profile' },
    ],
  };

  return configs[role] || configs['operator'];
}
