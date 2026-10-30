'use strict';

// Classify URLs without converting user input into executable HTML.
function classifyMedia(value) {
  if (typeof value !== 'string' || /[\s<>"'`\x00-\x1f]/.test(value)) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    const path = decodeURIComponent(url.pathname);
    if (/[<>"'`\x00-\x1f]/.test(path)) return null;
    if (/\.(png|jpe?g|gif|webp|bmp)$/i.test(path)) return { tipo: 'imagen', url: url.href };
    if (/\.(mp4|webm|ogg)$/i.test(path)) return { tipo: 'video', url: url.href };
    if (['youtube.com', 'www.youtube.com', 'youtu.be'].includes(url.hostname)) {
      const id = url.hostname === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v');
      if (/^[\w-]{11}$/.test(id || '')) return { tipo: 'youtube', url: `https://www.youtube-nocookie.com/embed/${id}` };
    }
  } catch { /* Malformed URL or percent encoding. */ }
  return null;
}

function validarMensaje(raw) {
  try {
    if (typeof raw !== 'string' || raw.length > 10000) throw Error('Formato inválido');
    const message = JSON.parse(raw);
    if (!message || typeof message.mensaje !== 'string' || !message.mensaje.trim() || message.mensaje.length > 4000) throw Error('Mensaje inválido');
    const text = message.mensaje.trim();
    // Reject markup and dangerous schemes; the frontend also renders plain text safely.
    if (/[<>]|&(?:lt|gt|#0*60|#x0*3c);|\b(?:javascript|data|vbscript)\s*:/i.test(text)) throw Error('Contenido no permitido');
    const media = classifyMedia(text);
    if (!media && /(?:https?:\/\/|www\.|^[a-z][a-z0-9+.-]*:)/i.test(text)) throw Error('URL no permitida');
    return JSON.stringify({
      ok: true,
      nombre: typeof message.nombre === 'string' ? message.nombre.slice(0, 80) : 'Anónimo',
      mensaje: text,
      color: /^#[0-9a-f]{6}$/i.test(message.color) ? message.color : '#166534',
      tipo: media?.tipo || 'texto',
      ...(media ? { url: media.url } : {})
    });
  } catch (error) {
    return JSON.stringify({ ok: false, error: error.message || 'Entrada inválida' });
  }
}

module.exports = {
  is_valid_phone: value => typeof value === 'string' && /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/.test(value),
  is_valid_url_image: value => classifyMedia(value)?.tipo === 'imagen',
  is_valid_video: value => classifyMedia(value)?.tipo === 'video',
  is_valid_yt_video: value => classifyMedia(value)?.tipo === 'youtube',
  getYTVideoId: value => { const media = classifyMedia(value); return media?.tipo === 'youtube' ? media.url.split('/').pop() : null; },
  classifyMedia,
  validarMensaje,
  validateMessage: validarMensaje
};
