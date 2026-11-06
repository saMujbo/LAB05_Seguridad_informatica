# Grafana Cloud para UNA Chat local

Node instalado: v24.18.0. Las dependencias están instaladas y fijadas en package-lock.json.

## Dos modos de inicio

- `npm start`: Render/Sentry, precarga instrument.js y usa SENTRY_DSN.
- `npm run start:grafana`: laboratorio local, precarga telemetry.js y lee .env.grafana.

No cargar los dos archivos de instrumentación en el mismo proceso. El modo Grafana
rechaza Render y NODE_ENV=production. Configurar variables OTEL por sí solo no activa
Grafana cuando se usa npm start.

## Conectar Grafana Cloud

El archivo local .env.grafana ya está creado, sin credenciales, y está excluido de Git.
La plantilla pública es .env.grafana.example.

En el stack de Grafana Cloud, abrir Connections → Add new connection → OpenTelemetry,
o la opción Configure del tile OpenTelemetry en el portal. Obtener los valores OTLP
para escribir trazas, métricas y logs en ese stack y completar .env.grafana:

```dotenv
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_EXPORTER_OTLP_ENDPOINT=https://ENDPOINT-DEL-STACK/otlp
OTEL_EXPORTER_OTLP_HEADERS="Authorization=Basic VALOR-DEL-PORTAL"
OTEL_SERVICE_NAME=una-chat
OTEL_RESOURCE_ATTRIBUTES=deployment.environment=local,deployment.environment.name=local
OTEL_SEMCONV_STABILITY_OPT_IN=http
```

Usar el endpoint completo del portal, sin agregar /v1/traces, /v1/logs o /v1/metrics:
los exportadores agregan esos sufijos. No guardar tokens en README, capturas o commits.

Ejecutar `npm run start:grafana` y abrir http://127.0.0.1:3000. Enviar un texto normal
y luego una URL no permitida, por ejemplo https://example.com/page.html. Esperar al
menos un ciclo de exportación de métricas (10 segundos). Detener con Ctrl+C permite
vaciar los lotes pendientes antes de terminar.

## Qué comprobar en Grafana

- Logs (Loki/Explore): `{service_name="una-chat"}`. Se registran mensajes aceptados o
  motivos de rechazo de validación y el contexto de traza, sin nombres ni contenido.
- Trazas (Tempo/Explore): filtrar por `service.name=una-chat`. El span
  Evento-Mensaje-Server contiene el span validarMensaje. Cada evento de Socket.IO
  inicia una traza propia; no implica una traza distribuida desde el navegador.
- Métricas (Prometheus/Mimir): buscar `una_chat_messages_accepted_total`,
  `una_chat_messages_rejected_total` y el histograma de procesamiento. Grafana puede
  agregar sufijos de unidad a los histogramas; buscar por prefijo
  `una_chat_message_processing_duration`. La instrumentación HTTP también emite
  http.server.request.duration, convertido a nombre Prometheus por Grafana.

Los logs tienen fecha/hora y trace_id/span_id. Guardar evidencias reales de cada
señal recibida en el stack, con filtros y período de tiempo visibles. No confundir
los resultados del receptor local de pruebas con recepción en Grafana Cloud.

## Verificación local

```text
npm test
npm run test:integration
npm run test:telemetry
```

test:telemetry inicia un receptor OTLP HTTP local y otro proceso con el chat. Verifica
exportación protobuf de las tres señales, autenticación de prueba, métricas de HTTP
y mensajes, jerarquía de spans, correlación de logs y exclusión del contenido privado.
No requiere ni utiliza credenciales reales de Grafana.

## Referencias

- https://grafana.com/docs/grafana-cloud/send-data/otlp/send-data-otlp/
- https://opentelemetry.io/docs/languages/js/
- https://open-telemetry.github.io/opentelemetry-js/interfaces/_opentelemetry_sdk-node.NodeSDKConfiguration.html
