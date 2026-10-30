const assert = require('assert/strict');
const lib = require('../libs/unalib');
const validate = mensaje => JSON.parse(lib.validarMensaje(JSON.stringify({ mensaje, nombre: 'Prueba' })));
describe('Validación segura de mensajes y medios', () => {
  for (const url of ['https://example.com/a.PNG?x=1', 'http://example.com/a.jpeg', 'https://example.com/a.webp'])
    it('acepta imagen ' + url, () => assert.equal(validate(url).tipo, 'imagen'));
  for (const url of ['https://example.com/a.mp4', 'https://example.com/a.webm?token=1', 'http://example.com/a.ogg'])
    it('acepta video ' + url, () => assert.equal(validate(url).tipo, 'video'));
  for (const value of ["<script>alert('Inyección de script');</script>", '<img src=x onerror=alert(1)>', '&lt;script&gt;', 'javascript:alert(1)', 'data:text/html,test', 'ftp://example.com/a.png', 'https://user:pass@example.com/a.png', 'https://example.com/a.png.exe', 'https://example.com/page.html', 'https://example.com/a%22.png', 'https://example.com/a.png\" onerror=alert(1)', '', 'https://example.com/a.svg'])
    it('rechaza ' + JSON.stringify(value), () => assert.equal(validate(value).ok, false));
  it('conserva texto ordinario', () => assert.equal(validate('Hola UNA').mensaje, 'Hola UNA'));
  for (const raw of ['{bad', 'null', '[]', null, 5, JSON.stringify({ mensaje: 3 })])
    it('rechaza formato ' + JSON.stringify(raw), () => assert.equal(JSON.parse(lib.validarMensaje(raw)).ok, false));
  it('mantiene el alias compatible', () => assert.equal(lib.validateMessage, lib.validarMensaje));
  it('impide inyección en color', () => assert.equal(JSON.parse(lib.validarMensaje(JSON.stringify({ mensaje: 'hola', color: 'red;' }))).color, '#166534'));
});
