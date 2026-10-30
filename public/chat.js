const socket = io();
const messages = document.querySelector('#messages');
const error = document.querySelector('#error');
socket.on('connect', () => document.querySelector('#connection').textContent = 'Conectado al backend por Socket.IO');
socket.on('disconnect', () => document.querySelector('#connection').textContent = 'Desconectado');
document.querySelector('form').addEventListener('submit', event => {
  event.preventDefault();
  error.textContent = '';
  socket.emit('Evento-Mensaje-Server', JSON.stringify({ nombre: document.querySelector('#nombre').value || 'Anónimo', mensaje: document.querySelector('#m').value, color: '#166534' }));
  document.querySelector('#m').value = '';
});
socket.on('mensaje-rechazado', raw => error.textContent = 'Mensaje rechazado: ' + JSON.parse(raw).error);
socket.on('Evento-Mensaje-Server', raw => {
  const message = JSON.parse(raw);
  if (!message.ok) return;
  const item = document.createElement('li');
  const name = document.createElement('strong');
  name.textContent = message.nombre + ': ';
  item.append(name);
  if (message.tipo === 'imagen') {
    const image = document.createElement('img');
    image.src = message.url; image.alt = 'Imagen compartida';
    image.addEventListener('error', () => image.replaceWith(document.createTextNode('No se pudo cargar la imagen')));
    item.append(image);
  } else if (message.tipo === 'video') {
    const video = document.createElement('video');
    video.src = message.url; video.controls = true; video.preload = 'auto';
    video.setAttribute('aria-label', 'Video compartido');
    item.append(video);
  } else if (message.tipo === 'youtube') {
    const frame = document.createElement('iframe');
    frame.src = message.url; frame.title = 'Video de YouTube'; frame.referrerPolicy = 'no-referrer';
    item.append(frame);
  } else item.append(document.createTextNode(message.mensaje));
  messages.append(item);
});
