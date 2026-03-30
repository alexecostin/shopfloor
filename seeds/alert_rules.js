export async function seed(knex) {
  await knex('alerts.rule_definitions').del();
  await knex('alerts.rule_definitions').insert([
    { code: 'stock_low', name: 'Stoc sub minim', description: 'Stocul unui articol a scazut sub nivelul minim.', severity: 'warning', is_predefined: true, parameters: JSON.stringify({ check_min_stock: true }) },
    { code: 'stock_days_remaining', name: 'Stoc pentru mai putin de X zile', description: 'Stocul va fi epuizat in mai putin de X zile la ritmul curent.', severity: 'warning', is_predefined: true, parameters: JSON.stringify({ days_threshold: 7 }) },
    { code: 'order_at_risk', name: 'Comanda la risc de intarziere', description: 'Comanda risca sa nu fie finalizata pana la deadline.', severity: 'critical', is_predefined: true, parameters: JSON.stringify({}) },
    { code: 'oee_low', name: 'OEE sub 60% pe 3 ture consecutive', description: 'OEE-ul masinii a scazut sub pragul critic.', severity: 'warning', is_predefined: true, parameters: JSON.stringify({ oee_threshold: 60, consecutive_shifts: 3 }) },
    { code: 'machine_maintenance_due', name: 'Mentenanta masina aproape', description: 'Masina se apropie de urmatoarea mentenanta planificata.', severity: 'info', is_predefined: true, parameters: JSON.stringify({ days_before: 7 }) },
    { code: 'tool_cycles_high', name: 'Scula aproape de limita cicluri', description: 'Scula a ajuns la 90% din intervalul de mentenanta.', severity: 'warning', is_predefined: true, parameters: JSON.stringify({ threshold_pct: 90 }) },
    { code: 'cost_overrun', name: 'Cost depaseste planificatul cu >15%', description: 'Costul actual al comenzii depaseste planificatul cu mai mult de 15%.', severity: 'warning', is_predefined: true, parameters: JSON.stringify({ overrun_pct: 15 }) },
    { code: 'operator_unavailable', name: 'Lipsa operator certificat pe masina planificata', description: 'Niciun operator certificat nu este disponibil pentru masina planificata.', severity: 'critical', is_predefined: true, parameters: JSON.stringify({}) },
  ]);
}
