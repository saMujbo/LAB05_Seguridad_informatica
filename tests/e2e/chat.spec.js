const { test, expect } = require('@playwright/test');
test.beforeEach(async ({ page }) => { await page.goto('/'); await expect(page.getByRole('status')).toContainText('Conectado'); });
async function send(page, value) { await page.getByPlaceholder('Escriba un mensaje').fill(value); await page.getByRole('button', { name: 'Enviar', exact: true }).click(); }
test('imagen real termina de cargar', async ({ page }) => {
  await send(page, 'http://127.0.0.1:3106/assets/prueba.png');
  const image = page.getByRole('img', { name: 'Imagen compartida' });
  await expect(image).toBeVisible(); await expect.poll(() => image.evaluate(i => i.complete && i.naturalWidth > 0)).toBe(true);
  await page.screenshot({ path: 'evidence/paso04-imagen.jpg', type: 'jpeg', quality: 92 });
});
test('video real carga metadatos y contenido', async ({ page }) => {
  await send(page, 'http://127.0.0.1:3106/assets/prueba.mp4');
  const video = page.getByLabel('Video compartido'); await expect(video).toBeVisible();
  await expect.poll(() => video.evaluate(v => v.readyState >= 2 && v.videoWidth > 0 && v.duration > 0), { timeout: 15000 }).toBe(true);
  await page.screenshot({ path: 'evidence/paso04-video.jpg', type: 'jpeg', quality: 92 });
});
test('script bloqueado sin alert ni difusión', async ({ page }) => {
  const dialogs = []; page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.dismiss(); });
  await send(page, "<script>alert('Inyección de script');</script>");
  await expect(page.getByRole('alert')).toContainText('Mensaje rechazado'); await expect(page.locator('#messages li')).toHaveCount(0);
  await page.waitForTimeout(300); expect(dialogs).toEqual([]);
  await page.screenshot({ path: 'evidence/paso05-script-bloqueado.jpg', type: 'jpeg', quality: 92 });
});
test('la identidad del servidor se muestra en el mensaje', async ({ page }) => {
  await send(page, 'Hola UNA');
  await expect(page.locator('#messages')).toContainText('Usuario de prueba:');
});
