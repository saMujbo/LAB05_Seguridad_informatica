if (globalThis[Symbol.for('una-chat.grafana')]) {
  throw new Error('Iniciá Sentry y Grafana en procesos separados.');
}
const Sentry = require("@sentry/node");

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || "production",
});

module.exports = Sentry;
