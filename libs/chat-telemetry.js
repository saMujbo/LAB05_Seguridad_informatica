'use strict';

// npm start no registra instrumentos de Grafana, aunque existan variables OTEL.
const enabled = Boolean(globalThis[Symbol.for('una-chat.grafana')]);
let tracer, logger, accepted, rejected, duration, api, logApi;
if (enabled) {
  api = require('@opentelemetry/api');
  logApi = require('@opentelemetry/api-logs');
  tracer = api.trace.getTracer('una-chat');
  logger = logApi.logs.getLogger('una-chat');
  const meter = api.metrics.getMeter('una-chat');
  accepted = meter.createCounter('una_chat.messages.accepted', { description: 'Mensajes aceptados' });
  rejected = meter.createCounter('una_chat.messages.rejected', { description: 'Mensajes rechazados' });
  duration = meter.createHistogram('una_chat.message.processing.duration', {
    description: 'Tiempo de procesamiento de un mensaje', unit: 's',
    advice: { explicitBucketBoundaries: [0, 0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1] }
  });
}

function observeValidation(work) {
  if (!enabled) return work();
  return tracer.startActiveSpan('validarMensaje', span => {
    try { return work(); } finally { span.end(); }
  });
}

function observeMessage(work) {
  if (!enabled) return work();
  return tracer.startActiveSpan('Evento-Mensaje-Server', { kind: api.SpanKind.CONSUMER }, span => {
    const start = process.hrtime.bigint();
    let outcome = 'error';
    try {
      const result = work();
      outcome = result.ok ? 'accepted' : 'rejected';
      (result.ok ? accepted : rejected).add(1);
      span.setAttribute('una_chat.message.outcome', outcome);
      // Los motivos provienen de la validación; no se exporta la entrada del usuario.
      const reasons = new Set(['Formato inválido', 'Mensaje inválido', 'Contenido no permitido', 'URL no permitida']);
      const reason = reasons.has(result.error) ? result.error : 'Entrada inválida';
      logger.emit({
        context: api.context.active(),
        severityNumber: result.ok ? logApi.SeverityNumber.INFO : logApi.SeverityNumber.WARN,
        severityText: result.ok ? 'INFO' : 'WARN',
        body: result.ok ? 'Mensaje aceptado' : `Mensaje rechazado: ${reason}`,
        attributes: { 'una_chat.message.outcome': outcome }
      });
      return result;
    } catch (error) {
      span.setStatus({ code: api.SpanStatusCode.ERROR, message: 'Error al procesar mensaje' });
      logger.emit({
        context: api.context.active(), severityNumber: logApi.SeverityNumber.ERROR,
        severityText: 'ERROR', body: 'Error al procesar mensaje'
      });
      throw error;
    } finally {
      duration.record(Number(process.hrtime.bigint() - start) / 1e9, { outcome });
      span.end();
    }
  });
}

module.exports = { observeMessage, observeValidation };
