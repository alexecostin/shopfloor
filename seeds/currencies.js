export async function seed(knex) {
  await knex('system.currencies').delete().catch(() => {});

  await knex('system.currencies').insert([
    { code: 'RON', name: 'Leu romanesc', symbol: 'lei', decimal_places: 2, is_active: true },
    { code: 'EUR', name: 'Euro', symbol: '€', decimal_places: 2, is_active: true },
    { code: 'USD', name: 'Dolar american', symbol: '$', decimal_places: 2, is_active: true },
    { code: 'GBP', name: 'Lira sterlina', symbol: '£', decimal_places: 2, is_active: true },
    { code: 'HUF', name: 'Forint maghiar', symbol: 'Ft', decimal_places: 0, is_active: true },
  ]);

  // Seed some exchange rates (approximate, 2026 rates)
  const today = new Date().toISOString().slice(0, 10);
  await knex('system.exchange_rates').delete().catch(() => {});
  await knex('system.exchange_rates').insert([
    { from_currency: 'EUR', to_currency: 'RON', rate: 4.97, valid_date: today, source: 'seed' },
    { from_currency: 'RON', to_currency: 'EUR', rate: 0.201, valid_date: today, source: 'seed' },
    { from_currency: 'USD', to_currency: 'RON', rate: 4.55, valid_date: today, source: 'seed' },
    { from_currency: 'RON', to_currency: 'USD', rate: 0.220, valid_date: today, source: 'seed' },
    { from_currency: 'EUR', to_currency: 'USD', rate: 1.09, valid_date: today, source: 'seed' },
    { from_currency: 'USD', to_currency: 'EUR', rate: 0.917, valid_date: today, source: 'seed' },
    { from_currency: 'GBP', to_currency: 'RON', rate: 5.77, valid_date: today, source: 'seed' },
    { from_currency: 'HUF', to_currency: 'RON', rate: 0.0130, valid_date: today, source: 'seed' },
  ]);

  console.log('[seed:currencies] 5 currencies + 8 exchange rates seeded');
}
