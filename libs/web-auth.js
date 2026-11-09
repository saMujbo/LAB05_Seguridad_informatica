const { auth } = require('express-openid-connect');
const { hkdfSync } = require('node:crypto');
const { getAuth0ClientSecret } = require('../server/vault');

async function loadConfiguredSecret() {
  // Once Vault is configured, never silently fall back to an old environment secret.
  if (process.env.VAULT_DATABASE_URL) return getAuth0ClientSecret();
  if (process.env.AUTH0_CLIENT_SECRET) return process.env.AUTH0_CLIENT_SECRET;
  throw new Error('Falta AUTH0_CLIENT_SECRET o VAULT_DATABASE_URL');
}

async function createWebAuth({ domain, clientId, baseURL, loadSecret = loadConfiguredSecret }) {
  const clientSecret = await loadSecret();
  // A stable, separate key keeps cookies valid across restarts with the same Vault secret.
  const sessionSecret = process.env.SESSION_SECRET || Buffer.from(
    hkdfSync('sha256', clientSecret, clientId, 'una-chat-session', 32)
  ).toString('hex');
  return auth({
    issuerBaseURL: `https://${domain}`,
    baseURL,
    clientID: clientId,
    clientSecret,
    clientAuthMethod: 'client_secret_post',
    secret: sessionSecret,
    authRequired: false,
    auth0Logout: true,
    authorizationParams: { response_type: 'code', response_mode: 'query', scope: 'openid profile email' },
    routes: { login: false, logout: '/auth/logout', callback: '/auth/callback' },
    session: { cookie: { httpOnly: true, sameSite: 'Lax', secure: baseURL.startsWith('https:') } }
  });
}

module.exports = { createWebAuth };
