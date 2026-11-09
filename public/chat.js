const messages = document.querySelector('#messages');
const error = document.querySelector('#error');
const connection = document.querySelector('#connection');
const login = document.querySelector('#login');
const logout = document.querySelector('#logout');
const user = document.querySelector('#user');
let socket;

async function updateSession() {
  const response = await fetch('/auth/session', { cache: 'no-store', credentials: 'same-origin' });
  if (!response.ok) throw new Error('No se pudo comprobar la sesión en el servidor');
  const { authenticated, user: profile } = await response.json();
  login.hidden = authenticated;
  logout.hidden = !authenticated;
  if (!authenticated) {
    user.textContent = '';
    connection.textContent = 'Inicia sesión para conectarte';
    return;
  }
  user.textContent = profile?.name || profile?.email || '';
  socket = io();
  socket.on('connect', () => connection.textContent = 'Conectado al backend por Socket.IO');
  socket.on('connect_error', () => connection.textContent = 'No se pudo autenticar la conexión');
  socket.on('disconnect', () => connection.textContent = 'Desconectado');
  socket.on('mensaje-rechazado', raw => error.textContent = 'Mensaje rechazado: ' + JSON.parse(raw).error);
  socket.on('Evento-Mensaje-Server', raw => renderMessage(raw));
}

function renderMessage(raw) {
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
}

login.addEventListener('click', () => {
  window.location.assign('/auth/login');
});
logout.addEventListener('click', () => {
  socket?.disconnect();
  window.location.assign('/auth/logout');
});
document.querySelector('form').addEventListener('submit', event => {
  event.preventDefault();
  if (!socket?.connected) {
    error.textContent = 'Inicia sesión antes de enviar mensajes';
    return;
  }
  error.textContent = '';
  socket.emit('Evento-Mensaje-Server', JSON.stringify({ mensaje: document.querySelector('#m').value, color: '#166534' }));
  document.querySelector('#m').value = '';
});

function showAuthError(cause) {
  connection.textContent = 'No se pudo iniciar la sesión';
  error.textContent = 'Auth0: ' + (cause?.message || 'Revisa la configuración de Auth0');
}

updateSession().catch(showAuthError);
