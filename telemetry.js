'use strict';

// Este archivo se precarga exclusivamente con npm run start:grafana.
if (process.env.RENDER || process.env.NODE_ENV === 'production') {
  throw new Error('Grafana local no se puede iniciar en Render ni en producción. Usá npm start.');
}
if (require.cache[require.resolve('./instrument')]) {
  throw new Error('Iniciá Sentry y Grafana en procesos separados.');
}
if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT || !process.env.OTEL_EXPORTER_OTLP_HEADERS) {
  throw new Error('Completá el endpoint y los headers OTLP en .env.grafana.');
}
if (process.env.OTEL_EXPORTER_OTLP_PROTOCOL !== 'http/protobuf') {
  throw new Error('Esta configuración requiere OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf.');
}

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-proto');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-proto');
const { OTLPLogExporter } = require('@opentelemetry/exporter-logs-otlp-proto');
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');
const { BatchLogRecordProcessor } = require('@opentelemetry/sdk-logs');
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');

process.env.OTEL_SERVICE_NAME ||= 'una-chat';
process.env.OTEL_SEMCONV_STABILITY_OPT_IN ||= 'http';

const sdk = new NodeSDK({
  // Solo detectamos atributos declarados explícitamente en las variables OTEL.
  resourceDetectors: [require('@opentelemetry/resources').envDetector],
  traceExporter: new OTLPTraceExporter(),
  metricReaders: [new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter(),
    exportIntervalMillis: 10000,
    exportTimeoutMillis: 5000
  })],
  logRecordProcessors: [new BatchLogRecordProcessor({ exporter: new OTLPLogExporter() })],
  instrumentations: [
    new HttpInstrumentation({
      disableOutgoingRequestInstrumentation: true,
      requestHook(span, request) {
        // No exportar parámetros de consulta (incluidos IDs de Socket.IO).
        const path = (request.url || '/').split('?')[0];
        span.setAttributes({ 'url.full': path, 'url.query': '', 'http.target': path, 'http.url': path });
      }
    }),
    new ExpressInstrumentation()
  ]
});

sdk.start();
globalThis[Symbol.for('una-chat.grafana')] = sdk;
console.log('Grafana local: logs, métricas y trazas activados para UNA Chat.');

module.exports = sdk;
