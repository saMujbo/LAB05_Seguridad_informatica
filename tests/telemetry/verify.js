'use strict';

// Receptor OTLP local de prueba: no usa credenciales ni envía datos a Grafana Cloud.
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { fork } = require('node:child_process');
const { once } = require('node:events');
const { io: connect } = require('socket.io-client');

// Lector mínimo de campos protobuf para verificar correlación sin depender del SDK.
function fields(buffer, number) {
  const found = [];
  let offset = 0;
  function varint() {
    let value = 0, shift = 0, byte;
    do { byte = buffer[offset++]; value += (byte & 127) * 2 ** shift; shift += 7; } while (byte & 128);
    return value;
  }
  while (offset < buffer.length) {
    const tag = varint(), wire = tag & 7;
    let value;
    if (wire === 0) value = varint();
    else if (wire === 1 || wire === 5) { const size = wire === 1 ? 8 : 4; value = buffer.subarray(offset, offset + size); offset += size; }
    else if (wire === 2) { const size = varint(); value = buffer.subarray(offset, offset + size); offset += size; }
    else throw Error(`Wire protobuf no soportado: ${wire}`);
    if (tag >>> 3 === number) found.push(value);
  }
  return found;
}

(async () => {
  const received = [];
  const collector = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    received.push({ path: req.url, auth: req.headers.authorization, body: Buffer.concat(chunks) });
    res.writeHead(200, { 'Content-Type': 'application/x-protobuf' });
    res.end();
  });
  let child, socket;
  const timeout = setTimeout(() => { console.error('Timeout de prueba OTLP'); process.exit(1); }, 20000);
  try {
    await new Promise(resolve => collector.listen(0, '127.0.0.1', resolve));
    child = fork(path.join(__dirname, 'fixture.js'), [], {
      execArgv: ['--require', path.resolve(__dirname, '../../telemetry.js')],
      env: {
        ...process.env, NODE_ENV: 'test', RENDER: '',
        OTEL_EXPORTER_OTLP_PROTOCOL: 'http/protobuf',
        OTEL_EXPORTER_OTLP_ENDPOINT: `http://127.0.0.1:${collector.address().port}/otlp`,
        OTEL_EXPORTER_OTLP_HEADERS: 'Authorization=Basic local-test-only',
        OTEL_RESOURCE_ATTRIBUTES: 'deployment.environment=local',
        OTEL_SERVICE_NAME: 'una-chat', OTEL_SDK_DISABLED: 'false'
      },
      stdio: ['ignore', 'inherit', 'inherit', 'ipc']
    });
    const [{ port }] = await Promise.race([
      once(child, 'message'),
      once(child, 'exit').then(([code]) => { throw Error(`Servidor terminó antes de iniciar (${code})`); })
    ]);
    const url = `http://127.0.0.1:${port}`;
    assert.equal((await fetch(url)).status, 200);
    assert.equal((await fetch(`${url}/debug-sentry`)).status, 404);
    socket = connect(url, { transports: ['websocket'], forceNew: true });
    await Promise.race([once(socket, 'connect'), once(socket, 'connect_error').then(([error]) => { throw error; })]);
    const send = raw => socket.timeout(3000).emitWithAck('Evento-Mensaje-Server', raw);
    const privateMarker = 'contenido-privado-no-exportar-123';
    assert.equal((await send(JSON.stringify({ nombre: privateMarker, mensaje: privateMarker }))).ok, true);
    assert.equal((await send(JSON.stringify({ mensaje: '<script>alert(1)</script>' }))).ok, false);
    socket.disconnect();
    const exited = once(child, 'exit');
    child.send('shutdown');
    assert.equal((await exited)[0], 0);
    for (const signal of ['traces', 'metrics', 'logs']) {
      assert(received.some(item => item.path === `/otlp/v1/${signal}`), `No llegó ${signal}`);
    }
    assert(received.every(item => item.auth === 'Basic local-test-only'));
    assert(received.every(item => !item.body.includes(Buffer.from(privateMarker))));
    const bodies = signal => received.filter(item => item.path.endsWith(signal)).map(item => item.body);
    const metricBytes = Buffer.concat(bodies('metrics'));
    for (const name of ['una_chat.messages.accepted', 'una_chat.messages.rejected', 'una_chat.message.processing.duration', 'http.server.request.duration']) {
      assert(metricBytes.includes(Buffer.from(name)), `Falta métrica ${name}`);
    }
    const records = signal => bodies(signal).flatMap(body => fields(body, 1))
      .flatMap(resource => fields(resource, 2)).flatMap(scope => fields(scope, 2));
    const spans = records('traces');
    const messages = spans.filter(span => fields(span, 5)[0]?.toString() === 'Evento-Mensaje-Server');
    assert.equal(messages.length, 2);
    const validations = spans.filter(span => fields(span, 5)[0]?.toString() === 'validarMensaje');
    assert.equal(validations.length, 2);
    for (const span of validations) {
      assert(messages.some(parent => fields(parent, 2)[0].equals(fields(span, 4)[0])));
    }
    const logs = records('logs');
    assert.equal(logs.length, 2);
    for (const log of logs) {
      assert(messages.some(span => fields(span, 1)[0].equals(fields(log, 9)[0]) && fields(span, 2)[0].equals(fields(log, 10)[0])));
    }
    console.log('OK: tres señales OTLP, autenticación, métricas HTTP/chat, spans padre-hijo, logs con trace_id/span_id y contenido privado excluido.');
  } finally {
    clearTimeout(timeout);
    socket?.disconnect();
    if (child && child.exitCode === null) child.kill();
    collector.closeAllConnections();
    await new Promise(resolve => collector.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
