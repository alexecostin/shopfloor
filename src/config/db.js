import 'dotenv/config';
import knex from 'knex';

const env = process.env.NODE_ENV || 'development';

const connection = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'shopfloor',
  user: process.env.DB_USER || 'shopfloor',
  password: process.env.DB_PASSWORD || 'shopfloor_password',
};

const db = knex({
  client: 'pg',
  connection,
  migrations: { directory: './migrations', extension: 'js' },
  seeds: { directory: './seeds' },
});

export default db;
