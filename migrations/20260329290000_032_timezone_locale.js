export async function up(knex) {
  // ─── system.tenants — locale settings ──────────────────────────────────────
  await knex.raw(`ALTER TABLE system.tenants ADD COLUMN IF NOT EXISTS default_timezone  VARCHAR(50)  NOT NULL DEFAULT 'Europe/Bucharest'`);
  await knex.raw(`ALTER TABLE system.tenants ADD COLUMN IF NOT EXISTS default_language   VARCHAR(10)  NOT NULL DEFAULT 'ro'`);
  await knex.raw(`ALTER TABLE system.tenants ADD COLUMN IF NOT EXISTS default_currency   VARCHAR(3)   NOT NULL DEFAULT 'RON'`);
  await knex.raw(`ALTER TABLE system.tenants ADD COLUMN IF NOT EXISTS date_format        VARCHAR(20)  NOT NULL DEFAULT 'DD/MM/YYYY'`);
  await knex.raw(`ALTER TABLE system.tenants ADD COLUMN IF NOT EXISTS time_format        VARCHAR(5)   NOT NULL DEFAULT '24h'`);
  await knex.raw(`ALTER TABLE system.tenants ADD COLUMN IF NOT EXISTS decimal_separator  VARCHAR(1)   NOT NULL DEFAULT ','`);
  await knex.raw(`ALTER TABLE system.tenants ADD COLUMN IF NOT EXISTS thousands_separator VARCHAR(1)  NOT NULL DEFAULT '.'`);
  await knex.raw(`ALTER TABLE system.tenants ADD COLUMN IF NOT EXISTS week_starts_on     SMALLINT     NOT NULL DEFAULT 1`); // 1=Mon

  // ─── org.units — per-unit timezone override ────────────────────────────────
  await knex.raw(`ALTER TABLE org.units ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) NULL`);

  // ─── auth.users — per-user locale prefs ────────────────────────────────────
  await knex.raw(`ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10) NULL`);
  await knex.raw(`ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS preferred_timezone VARCHAR(50) NULL`);
}

export async function down(knex) {
  await knex.raw(`ALTER TABLE system.tenants DROP COLUMN IF EXISTS default_timezone`);
  await knex.raw(`ALTER TABLE system.tenants DROP COLUMN IF EXISTS default_language`);
  await knex.raw(`ALTER TABLE system.tenants DROP COLUMN IF EXISTS default_currency`);
  await knex.raw(`ALTER TABLE system.tenants DROP COLUMN IF EXISTS date_format`);
  await knex.raw(`ALTER TABLE system.tenants DROP COLUMN IF EXISTS time_format`);
  await knex.raw(`ALTER TABLE system.tenants DROP COLUMN IF EXISTS decimal_separator`);
  await knex.raw(`ALTER TABLE system.tenants DROP COLUMN IF EXISTS thousands_separator`);
  await knex.raw(`ALTER TABLE system.tenants DROP COLUMN IF EXISTS week_starts_on`);
  await knex.raw(`ALTER TABLE org.units DROP COLUMN IF EXISTS timezone`);
  await knex.raw(`ALTER TABLE auth.users DROP COLUMN IF EXISTS preferred_language`);
  await knex.raw(`ALTER TABLE auth.users DROP COLUMN IF EXISTS preferred_timezone`);
}
