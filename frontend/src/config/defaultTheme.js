export const defaultTheme = {
  primaryColor: '#3B82F6',
  secondaryColor: '#64748B',
  accentColor: '#3B82F6',
  dangerColor: '#FF4757',
  warningColor: '#FFB020',
  successColor: '#00D4AA',
  sidebarBg: '#0F172A',
  headerBg: '#1E293B',
  fontFamily: 'DM Sans',
  darkModeEnabled: true,
  companyNameDisplay: 'ShopFloor.ro',
  logoUrl: null,
  loginBackgroundUrl: null,
};

export function applyTheme(theme) {
  const root = document.documentElement;
  const t = { ...defaultTheme, ...theme };

  root.style.setProperty('--color-primary', t.primaryColor || t.primary_color);
  root.style.setProperty('--color-secondary', t.secondaryColor || t.secondary_color);
  root.style.setProperty('--color-accent', t.accentColor || t.accent_color);
  root.style.setProperty('--color-danger', t.dangerColor || t.danger_color);
  root.style.setProperty('--color-warning', t.warningColor || t.warning_color);
  root.style.setProperty('--color-success', t.successColor || t.success_color);
  root.style.setProperty('--color-sidebar-bg', t.sidebarBg || t.sidebar_bg);
  root.style.setProperty('--color-header-bg', t.headerBg || t.header_bg);

  if (t.fontFamily || t.font_family) {
    root.style.setProperty('--font-family', t.fontFamily || t.font_family);
  }

  // Apply custom CSS if any
  const customCssId = 'tenant-custom-css';
  let styleEl = document.getElementById(customCssId);
  if (t.customCss || t.custom_css) {
    if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = customCssId; document.head.appendChild(styleEl); }
    styleEl.textContent = t.customCss || t.custom_css;
  } else if (styleEl) {
    styleEl.remove();
  }
}

export function toCamel(theme) {
  return {
    primaryColor: theme.primary_color,
    secondaryColor: theme.secondary_color,
    accentColor: theme.accent_color,
    dangerColor: theme.danger_color,
    warningColor: theme.warning_color,
    successColor: theme.success_color,
    sidebarBg: theme.sidebar_bg,
    headerBg: theme.header_bg,
    fontFamily: theme.font_family,
    darkModeEnabled: theme.dark_mode_enabled,
    companyNameDisplay: theme.company_name_display,
    logoUrl: theme.logo_url,
    logoDarkUrl: theme.logo_dark_url,
    loginBackgroundUrl: theme.login_background_url,
    customCss: theme.custom_css,
  };
}
