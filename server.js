const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const validation = require('./libs/unalib');
const { observeMessage, observeValidation } = require('./libs/chat-telemetry');

function createChatServer() {
  const app = express();
  app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; connect-src 'self' ws: wss:; img-src 'self' http: https:; media-src 'self' http: https:; frame-src https://www.youtube-nocookie.com; style-src 'self'; object-src 'none'; base-uri 'none'");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });
  app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));
  app.use('/assets', express.static(__dirname + '/public'));
  const server = http.createServer(app);
  const io = new Server(server, { maxHttpBufferSize: 10000 });
  io.on('connection', socket => {
    socket.on('Evento-Mensaje-Server', (raw, acknowledge) => {
      observeMessage(() => {
        const result = observeValidation(() => validation.validarMensaje(raw));
        const parsed = JSON.parse(result);
        if (parsed.ok) io.emit('Evento-Mensaje-Server', result);
        else socket.emit('mensaje-rechazado', result);
        if (typeof acknowledge === 'function') acknowledge(parsed);
        return parsed;
      });
    });
  });
  return { app, server, io };
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
