const { io: client } = require('socket.io-client');
const lib = require('../../libs/unalib');
const { createChatServer } = require('../../server');
describe('Backend real y UNA Lib por Socket.IO', () => {
  let chat, socket, spy;
  beforeAll(async () => {
    chat = createChatServer({ allowUnauthenticated: true });
    await new Promise(resolve => chat.server.listen(0, '127.0.0.1', resolve));
    socket = client(`http://127.0.0.1:${chat.server.address().port}`, { transports: ['websocket'], forceNew: true });
    await new Promise((resolve, reject) => { socket.on('connect', resolve); socket.on('connect_error', reject); });
  });
  afterAll(async () => { socket?.disconnect(); if (chat) await new Promise(resolve => chat.io.close(resolve)); });
  beforeEach(() => spy = jest.spyOn(lib, 'validarMensaje'));
  afterEach(() => spy?.mockRestore());
  test.each([['imagen', 'https://example.com/a.png'], ['video', 'https://example.com/a.mp4']])('acepta %s y emite el mensaje real', async (tipo, mensaje) => {
    const received = new Promise(resolve => socket.once('Evento-Mensaje-Server', raw => resolve(JSON.parse(raw))));
    const raw = JSON.stringify({ nombre: 'Prueba', mensaje });
    const result = await socket.timeout(3000).emitWithAck('Evento-Mensaje-Server', raw);
    expect(result).toMatchObject({ ok: true, tipo });
    expect(await received).toEqual(result);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('"nombre":"Usuario de prueba"'));
  });
  test.each(['https://example.com/page.html', "<script>alert('Inyección de script');</script>", 'javascript:alert(1)', '{bad json'])('rechaza %s sin difusión', async mensaje => {
    const broadcasts = []; const handler = raw => broadcasts.push(raw);
    socket.on('Evento-Mensaje-Server', handler);
    const rejected = new Promise(resolve => socket.once('mensaje-rechazado', raw => resolve(JSON.parse(raw))));
    const raw = mensaje === '{bad json' ? mensaje : JSON.stringify({ mensaje });
    const result = await socket.timeout(3000).emitWithAck('Evento-Mensaje-Server', raw);
    expect(result.ok).toBe(false); expect((await rejected).ok).toBe(false);
    expect(spy).toHaveBeenCalled();
    await new Promise(resolve => setTimeout(resolve, 80));
    expect(broadcasts).toEqual([]); socket.off('Evento-Mensaje-Server', handler);
  });
});
