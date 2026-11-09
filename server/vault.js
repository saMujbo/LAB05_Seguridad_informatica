const { Pool } = require('pg');
const { readFileSync } = require('node:fs');

async function getAuth0ClientSecret() {
  if (!process.env.VAULT_DATABASE_URL) throw new Error('Falta VAULT_DATABASE_URL');
  const connection = new URL(process.env.VAULT_DATABASE_URL);
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) connection.searchParams.delete(key);
  const pool = new Pool({
    connectionString: connection.toString(),
    ssl: {
      rejectUnauthorized: true,
      ...(process.env.VAULT_CA_CERT_PATH ? { ca: readFileSync(process.env.VAULT_CA_CERT_PATH, 'utf8') } : {})
    },
    max: 1,
    connectionTimeoutMillis: 10000,
    statement_timeout: 10000
  });
  try {
    const { rows } = await pool.query('select una_chat_private.get_auth0_client_secret() as secret');
    const secret = rows[0]?.secret;
    if (typeof secret !== 'string' || secret.length <= 16) throw new Error('Secreto ausente o inválido en Vault');
    return secret;
  } finally {
    await pool.end();
  }
}

module.exports = { getAuth0ClientSecret };
