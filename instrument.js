const Sentry = require("@sentry/node");

Sentry.init({
  dsn: process.env.SENTRY_DSN ||
    "https://0e45300248137054c5f106b9fe537631@o4512347935080448.ingest.us.sentry.io/4512347942944768",
  environment: process.env.NODE_ENV || "production",
});

module.exports = Sentry;
