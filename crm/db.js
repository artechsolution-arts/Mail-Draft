'use strict';

const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL ||
  `postgresql://${process.env.PGUSER || 'postgres'}:${process.env.PGPASSWORD || ''}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || 'outlook_crm'}`;

const pool = new Pool({ connectionString, max: 10 });

pool.on('error', err => console.error('PostgreSQL pool error:', err.message));

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
