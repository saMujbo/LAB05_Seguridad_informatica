// Screenshots of actual command logs and source files, displayed in a browser.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const escape = text => text.replace(/[&<>]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[char]));
const root = path.resolve(__dirname, '..');
const records = [
  ['paso03-evidencia1', 'Evidencia 1 Resultado de la inyección original', 'Registro de eventos reales del navegador. El listener de Playwright detectó y cerró el alert después del envío.', 'evidence/inyeccion-original.json'],
  ['paso06-pruebas-originales', 'Paso 6 Pruebas existentes antes de la corrección', 'Salida real de npm test en la versión inicial. Se muestran el error y el resumen final.', 'evidence/pruebas-originales.txt'],
  ['paso07-unitarias-codigo', 'Paso 7 Nuevas pruebas unitarias', 'Archivo test/security.test.js. Casos de imágenes, videos, scripts y entradas malformadas.', 'test/security.test.js'],
  ['paso08-evidencia2', 'Evidencia 2 Pruebas unitarias', 'Salida real de npm test -- --reporter dot después de la corrección. Incluye las pruebas originales y las nuevas.', 'evidence/unitarias-resumen.txt'],
  ['paso09-evidencia3', 'Evidencia 3 Pruebas de integración', 'Salida real de npx jest tests/integration --runInBand --env=node --verbose. Backend y cliente Socket.IO reales.', 'evidence/integracion.txt'],
  ['paso10-evidencia4', 'Evidencia 4 Pruebas end-to-end', 'Salida real de npx playwright test --project=chromium --headed. Frontend y backend reales.', 'evidence/e2e.txt'],
  ['paso11-entrega', 'Paso 11 Repositorio de referencia', 'Contenido real de repositorio.txt. La publicación del código y la entrega en ProfeLink son acciones posteriores.', 'repositorio.txt']
];
(async () => {
  const browser = await chromium.launch({channel: process.env.PW_CHANNEL || undefined,headless:true});
  const page = await browser.newPage({viewport:{width:1500,height:1000},deviceScaleFactor:1});
  for (const [name,title,description,file] of records) {
    let content = fs.readFileSync(path.join(root,file),'utf8').replace(/\x1b\[[0-9;]*m/g,'');
    if(name==='paso06-pruebas-originales') content=content.slice(content.indexOf('  2 passing')).split('\n').filter(line=> !line.match(/^\s+at /)).join('\n');
    if(name==='paso07-unitarias-codigo') content='Extracto del archivo de pruebas\n\n'+content.split('\n').slice(0,14).join('\n');
    if(name==='paso09-evidencia3') { const results=JSON.parse(fs.readFileSync(path.join(root,'evidence/integration-results.json'),'utf8'));content+='\nCasos del reporte JSON real\n'+results.testResults.flatMap(s=>s.assertionResults.map(t=>t.status.toUpperCase()+' '+t.title)).join('\n'); }
    const html=`<!doctype html><meta charset="utf-8"><title>${title}</title><style>body{font:24px Arial;margin:32px;color:#18283b;background:#f5f7fa}h1{font-size:32px}p{line-height:1.4}pre{font:23px/1.4 Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere;background:white;padding:24px;border:1px solid #d1d5db}small{font-size:21px}</style><h1>${title}</h1><p>${description}</p><small>Fuente local: ${file}</small><pre>${escape(content)}</pre>`;
    fs.writeFileSync(path.join(root,'evidence',name+'.html'),html);
    await page.goto('file:///'+path.join(root,'evidence',name+'.html').replace(/\\/g,'/'));
    await page.locator('body').screenshot({path:path.join(root,'evidence',name+'.jpg'),type:'jpeg',quality:95});
  }
  await page.goto('file:///'+path.join(root,'playwright-report/index.html').replace(/\\/g,'/'));
  await page.waitForTimeout(1500);
  await page.screenshot({path:path.join(root,'evidence/paso10-reporte-playwright.jpg'),type:'jpeg',quality:95,clip:{x:250,y:0,width:1000,height:400}});
  await browser.close();
})();
