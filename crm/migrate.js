'use strict';
require('dotenv').config();
const { pool } = require('./db');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS crm_users (
        email       VARCHAR(255) PRIMARY KEY,
        name        VARCHAR(255),
        created_at  TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS crm_customers (
        id                     SERIAL PRIMARY KEY,
        user_email             VARCHAR(255) NOT NULL,
        email                  VARCHAR(255) NOT NULL,
        name                   VARCHAR(255),
        company                VARCHAR(255),
        phone                  VARCHAR(50),
        customer_since         TIMESTAMP DEFAULT NOW(),
        ai_summary             TEXT,
        ai_summary_updated_at  TIMESTAMP,
        created_at             TIMESTAMP DEFAULT NOW(),
        updated_at             TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_email, email)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS crm_emails (
        id             SERIAL PRIMARY KEY,
        user_email     VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255) NOT NULL,
        direction      VARCHAR(10)  NOT NULL CHECK (direction IN ('received','sent')),
        subject        VARCHAR(1000),
        body           TEXT,
        email_date     TIMESTAMP,
        outlook_id     VARCHAR(1000),
        created_at     TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS crm_follow_ups (
        id             SERIAL PRIMARY KEY,
        user_email     VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255) NOT NULL,
        subject        VARCHAR(500),
        note           TEXT,
        due_at         TIMESTAMP NOT NULL,
        status         VARCHAR(20) DEFAULT 'pending',
        created_at     TIMESTAMP DEFAULT NOW(),
        updated_at     TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS crm_drafts (
        id             SERIAL PRIMARY KEY,
        user_email     VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255) NOT NULL,
        customer_name  VARCHAR(255),
        in_reply_to    VARCHAR(500),
        subject        VARCHAR(1000),
        body           TEXT,
        status         VARCHAR(20) DEFAULT 'pending',
        created_at     TIMESTAMP DEFAULT NOW(),
        updated_at     TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS crm_notes (
        id             SERIAL PRIMARY KEY,
        user_email     VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255) NOT NULL,
        text           TEXT NOT NULL,
        created_at     TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS crm_quotations (
        id             SERIAL PRIMARY KEY,
        user_email     VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255) NOT NULL,
        reference      VARCHAR(255) NOT NULL,
        description    TEXT,
        amount         VARCHAR(100),
        currency       VARCHAR(10) DEFAULT 'USD',
        valid_until    DATE,
        created_at     TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS crm_settings (
        user_email     VARCHAR(255) PRIMARY KEY,
        followup_days  INTEGER DEFAULT 3,
        updated_at     TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS crm_tokens (
        user_email       VARCHAR(255) PRIMARY KEY,
        access_token     TEXT,
        refresh_token    TEXT,
        token_expires_at BIGINT,
        last_inbox_sync  TIMESTAMP,
        last_sent_sync   TIMESTAMP,
        updated_at       TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS crm_api_keys (
        id           SERIAL PRIMARY KEY,
        user_email   VARCHAR(255) NOT NULL,
        key_hash     VARCHAR(64)  NOT NULL UNIQUE,
        name         VARCHAR(255) NOT NULL DEFAULT 'My App',
        created_at   TIMESTAMP DEFAULT NOW(),
        last_used_at TIMESTAMP,
        revoked_at   TIMESTAMP
      )
    `);

    // express-session store table
    await client.query(`
      CREATE TABLE IF NOT EXISTS session (
        sid     VARCHAR NOT NULL COLLATE "default",
        sess    JSON    NOT NULL,
        expire  TIMESTAMP(6) NOT NULL,
        PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE
      ) WITH (OIDS=FALSE)
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS IDX_session_expire ON session (expire)`);

    // Ollama draft metadata columns (idempotent ALTERs for existing deployments)
    await client.query(`ALTER TABLE crm_drafts ADD COLUMN IF NOT EXISTS source_subject     TEXT`);
    await client.query(`ALTER TABLE crm_drafts ADD COLUMN IF NOT EXISTS source_body        TEXT`);
    await client.query(`ALTER TABLE crm_drafts ADD COLUMN IF NOT EXISTS generated_by       TEXT`);
    await client.query(`ALTER TABLE crm_drafts ADD COLUMN IF NOT EXISTS ollama_model       TEXT`);
    await client.query(`ALTER TABLE crm_drafts ADD COLUMN IF NOT EXISTS generation_status  VARCHAR(20) DEFAULT 'pending'`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS crm_escalations (
        id             SERIAL PRIMARY KEY,
        user_email     VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255) NOT NULL,
        draft_id       INTEGER,
        escalate_to    VARCHAR(255) NOT NULL,
        note           TEXT,
        email_sent     BOOLEAN NOT NULL DEFAULT FALSE,
        send_error     TEXT,
        created_at     TIMESTAMP DEFAULT NOW()
      )
    `);

    // Indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_crm_cust_user       ON crm_customers(user_email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_crm_emails_uc       ON crm_emails(user_email, customer_email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_crm_fu_user_status  ON crm_follow_ups(user_email, status, due_at)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_crm_drafts_user     ON crm_drafts(user_email, status, generation_status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_crm_notes_uc        ON crm_notes(user_email, customer_email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_crm_quotes_uc       ON crm_quotations(user_email, customer_email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_crm_api_keys_user   ON crm_api_keys(user_email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_crm_api_keys_hash   ON crm_api_keys(key_hash)`);

    await client.query('COMMIT');
    console.log('Migration complete — all tables created.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
