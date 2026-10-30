const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const validation = require('./libs/unalib');

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
      const result = validation.validarMensaje(raw);
      if (JSON.parse(result).ok) io.emit('Evento-Mensaje-Server', result);
      else socket.emit('mensaje-rechazado', result);
      if (typeof acknowledge === 'function') acknowledge(JSON.parse(result));
    });
  });
  return { app, server, io };
}

if (require.main === module) {
  const { server } = createChatServer();
  const port = process.env.PORT || 3000;
  server.listen(port, '127.0.0.1', () => console.log(`UNA Chat http://127.0.0.1:${port}`));
}
module.exports = { createChatServer };
