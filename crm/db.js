'use strict';

const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL ||
  `postgresql://${process.env.PGUSER || 'postgres'}:${process.env.PGPASSWORD || ''}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || 'outlook_crm'}`;

// Railway (and most managed PG providers) require SSL; disable cert verification
// because managed certs are self-signed from the pool's perspective.
const sslConfig = process.env.DATABASE_URL ? { rejectUnauthorized: false } : false;

const pool = new Pool({ connectionString, max: 10, ssl: sslConfig });

pool.on('error', err => console.error('PostgreSQL pool error:', err.message));

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
