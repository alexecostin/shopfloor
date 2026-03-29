import 'dotenv/config';

/** @type {Object.<string, import('knex').Knex.Config>} */
export default {
  development: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'shopfloor',
      user: process.env.DB_USER || 'shopfloor',
      password: process.env.DB_PASSWORD || 'shopfloor_password',
    },
    migrations: {
      directory: './migrations',
      extension: 'js',
    },
    seeds: {
      directory: './seeds',
    },
  },
  production: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: { rejectUnauthorized: false },
    },
    migrations: {
      directory: './migrations',
      extension: 'js',
    },
    seeds: {
      directory: './seeds',
    },
  },
};
