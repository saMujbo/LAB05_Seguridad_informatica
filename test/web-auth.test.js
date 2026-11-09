const assert = require('node:assert/strict');
const http = require('node:http');
const { createRequire } = require('node:module');
const sdkRequire = createRequire(require.resolve('express-openid-connect'));
const { Issuer } = sdkRequire('openid-client');
const { io: connect } = require('socket.io-client');
const { createChatServer } = require('../server');

describe('Login web con el SDK oficial de Auth0', function () {
  this.timeout(10000);
  const clientId = '1EospfgNNGpfrmFKJH1fVxMQ1l11XLVX';
  const issuer = 'https://dev-d6zmp4lkksvbyfz5.us.auth0.com';
  const testSecret = 'test-only-client-secret-not-a-real-credential';
  let chat, provider, origin, originalDiscover, nonce, state, tokenBody, signToken;
  const cookies = new Map();
  const cookieHeader = () => [...cookies].map(([key, value]) => `${key}=${value}`).join('; ');
  async function request(path, withCookies = true) {
    const response = await fetch(origin + path, {
      redirect: 'manual', headers: withCookies ? { Cookie: cookieHeader() } : {}
    });
    if (withCookies) for (const value of response.headers.getSetCookie()) {
      const [name, ...parts] = value.split(';')[0].split('=');
      if (parts.join('=')) cookies.set(name, parts.join('='));
      else cookies.delete(name);
    }
    return response;
  }
  async function socketResult(cookie) {
    const socket = connect(origin, {
      transports: ['websocket'], reconnection: false, timeout: 3000,
      extraHeaders: cookie ? { Cookie: cookie } : {}
    });
    return new Promise(resolve => {
      socket.once('connect', () => resolve({ socket, connected: true }));
      socket.once('connect_error', error => { socket.disconnect(); resolve({ connected: false, error }); });
    });
  }
  before(async () => {
    const { generateKeyPair, exportJWK, SignJWT } = await import('jose');
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = { ...await exportJWK(publicKey), kid: 'test-key', alg: 'RS256', use: 'sig' };
    signToken = () => new SignJWT({ nonce, name: 'Usuario Auth0', email: 'test@example.com' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' }).setIssuer(issuer)
      .setAudience(clientId).setSubject('auth0|web-test').setIssuedAt().setExpirationTime('1h').sign(privateKey);
    provider = http.createServer(async (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/jwks') return res.end(JSON.stringify({ keys: [jwk] }));
      if (req.url === '/token') {
        const chunks = []; for await (const chunk of req) chunks.push(chunk);
        tokenBody = new URLSearchParams(Buffer.concat(chunks).toString());
        return res.end(JSON.stringify({ access_token: 'test-token', token_type: 'Bearer', expires_in: 3600, id_token: await signToken() }));
      }
      res.statusCode = 404; res.end('{}');
    });
    await new Promise(resolve => provider.listen(0, '127.0.0.1', resolve));
    const providerURL = `http://127.0.0.1:${provider.address().port}`;
    originalDiscover = Issuer.discover;
    Issuer.discover = async () => new Issuer({
      issuer, authorization_endpoint: providerURL + '/authorize', token_endpoint: providerURL + '/token',
      jwks_uri: providerURL + '/jwks', response_types_supported: ['code'],
      response_modes_supported: ['query'], id_token_signing_alg_values_supported: ['RS256'],
      token_endpoint_auth_methods_supported: ['client_secret_post']
    });
    chat = createChatServer({ loadSecret: async () => testSecret });
    await chat.ready;
    await new Promise(resolve => chat.server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${chat.server.address().port}`;
  });
  after(async () => {
    Issuer.discover = originalDiscover;
    if (chat) await new Promise(resolve => chat.io.close(resolve));
    if (provider) await new Promise(resolve => provider.close(resolve));
  });
  it('protege la sala y Socket.IO sin cookie', async () => {
    assert.equal((await request('/sala', false)).status, 401);
    assert.equal((await socketResult()).connected, false);
  });
  it('expone solo configuración pública y usa UNA_CHAT_LAB08 sin audience de API', async () => {
    const config = await (await request('/auth/config')).json();
    assert.equal(config.enabled, true);
    assert.equal(config.clientId, clientId);
    assert.ok(!JSON.stringify(config).includes(testSecret));
    const response = await request('/auth/login');
    assert.equal(response.status, 302);
    const redirect = new URL(response.headers.get('location'));
    assert.equal(redirect.searchParams.get('client_id'), clientId);
    assert.equal(redirect.searchParams.get('response_type'), 'code');
    assert.equal(redirect.searchParams.has('audience'), false);
    assert.ok(redirect.searchParams.get('redirect_uri').endsWith('/auth/callback'));
    nonce = redirect.searchParams.get('nonce');
    state = redirect.searchParams.get('state');
  });
  it('canjea el código en el servidor con client_secret_post y conserva la sesión', async () => {
    const response = await request('/auth/callback?code=test-code&state=' + encodeURIComponent(state));
    assert.equal(response.status, 302, await response.text());
    assert.ok(response.headers.get('location').endsWith('/sala'));
    assert.equal(tokenBody.get('client_id'), clientId);
    assert.equal(tokenBody.get('client_secret'), testSecret);
    assert.equal(tokenBody.get('grant_type'), 'authorization_code');
    assert.ok(tokenBody.get('code_verifier'));
    assert.ok(response.headers.getSetCookie().some(value => value.startsWith('appSession=') && /HttpOnly/i.test(value)));
    for (let reload = 0; reload < 2; reload++) {
      const session = await (await request('/auth/session')).json();
      assert.equal(session.authenticated, true);
      assert.equal(session.user.name, 'Usuario Auth0');
      assert.ok(!JSON.stringify(session).includes(testSecret));
      assert.ok(!JSON.stringify(session).includes('test-token'));
    }
    assert.equal((await request('/sala')).status, 200);
  });
  it('autentica Socket.IO con la misma cookie y conserva la identidad del usuario', async () => {
    const result = await socketResult(cookieHeader());
    assert.equal(result.connected, true, result.error?.message);
    try {
      const message = await result.socket.timeout(3000).emitWithAck('Evento-Mensaje-Server', JSON.stringify({ nombre: 'Identidad falsa', mensaje: 'Hola UNA' }));
      assert.equal(message.ok, true);
      assert.equal(message.nombre, 'Usuario Auth0');
    } finally { result.socket.disconnect(); }
  });
  it('rechaza cookies manipuladas', async () => {
    const result = await socketResult('appSession=invalid-cookie');
    assert.equal(result.connected, false);
  });
  it('cierra la sesión local y redirige al logout de Auth0 con la misma aplicación', async () => {
    const response = await request('/auth/logout');
    assert.equal(response.status, 302);
    const target = new URL(response.headers.get('location'));
    assert.equal(target.origin, issuer);
    assert.equal(target.pathname, '/v2/logout');
    assert.equal(target.searchParams.get('client_id'), clientId);
    assert.equal((await (await request('/auth/session')).json()).authenticated, false);
    assert.equal((await request('/sala')).status, 401);
  });
});
