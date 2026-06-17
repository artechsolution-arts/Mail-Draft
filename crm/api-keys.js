'use strict';

const crypto = require('crypto');
const { query } = require('./db');

function generateKey() {
  return 'crm_live_' + crypto.randomBytes(24).toString('hex');
}

function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

async function createApiKey(userEmail, name) {
  const key  = generateKey();
  const hash = hashKey(key);
  const { rows } = await query(
    `INSERT INTO crm_api_keys (user_email, key_hash, name)
     VALUES ($1, $2, $3)
     RETURNING id, name, created_at`,
    [userEmail.toLowerCase(), hash, name || 'My App']
  );
  // Raw key returned ONCE — never retrievable again
  return { ...rows[0], key };
}

async function validateApiKey(rawKey) {
  if (!rawKey || !rawKey.startsWith('crm_live_')) return null;
  const hash = hashKey(rawKey);
  const { rows } = await query(
    `UPDATE crm_api_keys
     SET last_used_at = NOW()
     WHERE key_hash = $1 AND revoked_at IS NULL
     RETURNING user_email, id, name`,
    [hash]
  );
  return rows[0] || null;
}

async function listApiKeys(userEmail) {
  const { rows } = await query(
    `SELECT id, name, created_at, last_used_at,
            CASE WHEN revoked_at IS NOT NULL THEN true ELSE false END AS revoked
     FROM crm_api_keys
     WHERE user_email = $1
     ORDER BY created_at DESC`,
    [userEmail.toLowerCase()]
  );
  return rows;
}

async function revokeApiKey(userEmail, id) {
  const { rows } = await query(
    `UPDATE crm_api_keys
     SET revoked_at = NOW()
     WHERE user_email = $1 AND id = $2 AND revoked_at IS NULL
     RETURNING id`,
    [userEmail.toLowerCase(), parseInt(id, 10)]
  );
  return rows.length > 0;
}

module.exports = { createApiKey, validateApiKey, listApiKeys, revokeApiKey };
