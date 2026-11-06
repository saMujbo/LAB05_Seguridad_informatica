# Laboratorio 05 UNA Chat

Repositorio: https://github.com/saMujbo/LAB05_Seguridad_informatica

## Ejecución

Requiere Node.js y npm. Instalar dependencias con `npm ci` y ejecutar `npm start`.
Abrir http://127.0.0.1:3000. El mismo servidor sirve el frontend y el backend Socket.IO.

Para logs, métricas y trazas locales por OTLP, ver [GRAFANA.md](GRAFANA.md).
El comando `npm run start:grafana` usa una configuración separada de Sentry/Render.

## Pruebas separadas

- Unitarias originales y nuevas: `npm test` (Mocha, carpeta test).
- Integración real: `npx jest tests/integration --runInBand --env=node`.
- Instalar navegador: `npx playwright install chromium`.
- End-to-end: `npx playwright test --project=chromium --headed`.
- Reporte: `npx playwright show-report`.

El proyecto chromium utiliza el motor Chromium de Microsoft Edge (channel msedge).
Se eligió el navegador instalado porque la descarga de Chrome for Testing no avanzó.

Playwright inicia el servidor en http://127.0.0.1:3106 y lo detiene al terminar.
Las pruebas de integración abren un puerto libre y cierran el cliente y servidor.
Jest excluye tests/e2e; Mocha solo ejecuta test/**/*.js.

## Cambios

UNA Lib valida JSON, tamaño, texto y URLs con URL y expresiones regulares.
Rechaza HTML, scripts, credenciales en URLs y protocolos distintos de HTTP y HTTPS.
Admite imágenes PNG, JPEG, GIF, WEBP y BMP; videos MP4, WEBM y OGG.
Conserva la validación de enlaces de YouTube con identificador de 11 caracteres.
El frontend usa textContent y createElement en lugar de insertar HTML del usuario.
El backend valida el evento Evento-Mensaje-Server con validarMensaje y devuelve
mensaje-rechazado ante entradas inválidas. validateMessage es un alias compatible.

## Medios de prueba

public/prueba.png es una imagen creada localmente para probar la carga.
public/prueba.mp4 es flower.mp4 (CC0), descargado de MDN:
https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4
Los medios se sirven localmente y no se intercepta ni simula la red en las pruebas E2E.
La extensión sirve para clasificar una URL; no demuestra por sí sola su disponibilidad
ni el contenido remoto. Las pruebas E2E comprueban naturalWidth y readyState.

## Evidencias

Las capturas JPG y registros de ejecución se guardan en evidence.
Las capturas de pruebas muestran el registro real en un visor HTML, no una terminal.
El Word reúne los pasos, los resultados y las capturas.
repositorio.txt contiene la dirección del remoto del proyecto.
