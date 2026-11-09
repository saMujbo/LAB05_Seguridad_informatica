require('dotenv').config({ quiet: true });
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const validation = require('./libs/unalib');
const { observeMessage, observeValidation } = require('./libs/chat-telemetry');
const { createWebAuth } = require('./libs/web-auth');

function createChatServer(options = {}) {
  const app = express();
  const auth0Domain = process.env.AUTH0_DOMAIN || 'dev-d6zmp4lkksvbyfz5.us.auth0.com';
  const clientId = process.env.AUTH0_CLIENT_ID || '1EospfgNNGpfrmFKJH1fVxMQ1l11XLVX';
  const baseURL = process.env.APP_BASE_URL || 'http://localhost:3000';
  const testMode = options.allowUnauthenticated === true || process.env.AUTH0_TEST_MODE === 'true';
  const enabled = !testMode && !!(options.loadSecret || process.env.VAULT_DATABASE_URL || process.env.AUTH0_CLIENT_SECRET);
  app.set('trust proxy', 1);
  let authentication;
  let authFailed = false;
  const ready = enabled ? createWebAuth({ domain: auth0Domain, clientId, baseURL, loadSecret: options.loadSecret })
    .then(middleware => { authentication = middleware; })
    .catch(() => { authFailed = true; }) : Promise.resolve();
  const sessionMiddleware = async (req, res, next) => {
    await ready;
    if (authFailed) return res.status(503).json({ error: 'No se pudo configurar Auth0. Revisa el secreto y la conexión a Vault en el servidor.' });
    if (!authentication) return next();
    authentication(req, res, next);
  };
  app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', `default-src 'self'; script-src 'self'; connect-src 'self' https://${auth0Domain} ws: wss:; img-src 'self' http: https:; media-src 'self' http: https:; frame-src https://${auth0Domain} https://www.youtube-nocookie.com; style-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self' https://${auth0Domain}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });
  app.use(sessionMiddleware);
  app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));
  app.get('/auth/config', (req, res) => res.set('Cache-Control', 'no-store').json({ enabled, domain: auth0Domain, clientId }));
  app.get('/auth/session', (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (testMode) return res.json({ authenticated: true, user: { name: 'Usuario de prueba', sub: 'test-user' } });
    const authenticated = req.oidc?.isAuthenticated() === true;
    const profile = authenticated ? req.oidc.user : null;
    res.json({ authenticated, user: profile ? { name: profile.name, email: profile.email, sub: profile.sub } : null });
  });
  app.get('/sala', (req, res) => {
    if (!testMode && !req.oidc?.isAuthenticated()) return res.status(401).json({ error: 'Inicia sesión para entrar a la sala' });
    res.sendFile(__dirname + '/index.html');
  });
  app.get('/auth/login', (req, res, next) => {
    if (!req.oidc) return res.status(503).json({ error: 'Configura AUTH0_CLIENT_SECRET en el servidor para habilitar Auth0' });
    Promise.resolve(res.oidc.login({ returnTo: '/sala' })).catch(next);
  });
  app.get('/auth/logout', (req, res) => res.status(503).json({ error: 'Configura AUTH0_CLIENT_SECRET en el servidor para habilitar Auth0' }));
  app.get('/auth-config.js', (req, res) => {
    const config = {
      domain: auth0Domain,
      clientId,
      enabled,
      testMode
    };
    res.type('application/javascript').set('Cache-Control', 'no-store').send(`window.UNA_AUTH0_CONFIG = ${JSON.stringify(config)};`);
  });
  app.use('/assets', express.static(__dirname + '/public'));
  app.use((cause, req, res, next) => {
    if (res.headersSent) return next(cause);
    // Do not expose tokens, connection strings or provider error bodies.
    res.status(400).type('text/plain').send('No se pudo iniciar la sesión con Auth0. Revisa el tipo Regular Web Application, Client Secret (Post), el secreto y las URLs permitidas.');
  });
  const server = http.createServer(app);
  const io = new Server(server, { maxHttpBufferSize: 10000 });
  io.engine.use(async (req, res, next) => {
    if (req._query.sid !== undefined) return next();
    await ready;
    if (authFailed) return next(new Error('Auth0 no disponible'));
    if (!authentication) return next();
    // Add Express request helpers without replacing Engine.IO's upgrade response.
    Object.setPrototypeOf(req, app.request);
    req.res = res;
    res.req = req;
    for (const method of ['cookie', 'clearCookie', 'append', 'get', 'set', 'header']) {
      res[method] = express.response[method];
    }
    authentication(req, res, next);
  });
  io.use(async (socket, next) => {
    if (testMode) {
      socket.data.user = { name: 'Usuario de prueba', sub: 'test-user' };
      return next();
    }
    try {
      if (!socket.request.oidc?.isAuthenticated()) return next(new Error('No autorizado'));
      const profile = socket.request.oidc.user;
      socket.data.user = { name: String(profile.name || profile.email || profile.sub).slice(0, 80), sub: profile.sub };
      next();
    } catch {
      next(new Error('No autorizado'));
    }
  });
  io.on('connection', socket => {
    socket.on('Evento-Mensaje-Server', (raw, acknowledge) => {
      observeMessage(() => {
        let authenticatedRaw = raw;
        try {
          const input = JSON.parse(raw);
          if (input && typeof input === 'object' && !Array.isArray(input)) {
            authenticatedRaw = JSON.stringify({ ...input, nombre: socket.data.user.name });
          }
        } catch {
          // Let the message validator return the standard invalid-format response.
        }
        const result = observeValidation(() => validation.validarMensaje(authenticatedRaw));
        const parsed = JSON.parse(result);
        if (parsed.ok) io.emit('Evento-Mensaje-Server', result);
        else socket.emit('mensaje-rechazado', result);
        if (typeof acknowledge === 'function') acknowledge(parsed);
        return parsed;
      });
    });
  });
  return { app, server, io, ready };
}

if (require.main === module) {
  const { server, io } = createChatServer();
  const port = process.env.PORT || 3000;
  server.listen(port, '0.0.0.0', () => console.log(`UNA Chat ${port}`));
  const telemetry = globalThis[Symbol.for('una-chat.grafana')];
  if (telemetry) {
    let stopping = false;
    const stop = async () => {
      if (stopping) return;
      stopping = true;
      const timeout = setTimeout(() => process.exit(1), 10000);
      try {
        await new Promise(resolve => io.close(resolve));
        await telemetry.shutdown();
        clearTimeout(timeout);
        process.exit(0);
      } catch {
        clearTimeout(timeout);
        console.error('No se pudo completar el cierre de la telemetría.');
        process.exit(1);
      }
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  }
}
module.exports = { createChatServer };
