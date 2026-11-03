import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

test('direct file opening uses normal browser security', async ({ page, context }) => {
  await context.setOffline(true);
  try {
    await page.goto(pathToFileURL(path.resolve('exports/Gather.html')).href);
  } catch (error) {
    if (String(error).includes('ERR_BLOCKED_BY_ADMINISTRATOR')) {
      test.skip(true, 'This environment’s managed Chromium URL policy blocks file:// navigation.');
      return;
    }
    throw error;
  }
  await expect(page.getByRole('heading', { name: 'Life lately.' })).toBeVisible();
});

test('exact portable HTML works offline, decodes photos, saves uploads, and exports a yearbook', async ({ page, context }) => {
  await context.setOffline(true);
  const documentUrl = 'http://127.0.0.1/__gather_portable__.html';
  const html = await readFile(path.resolve('exports/Gather.html'), 'utf8');
  // Serve only the exact document from memory. There is no HTTP server or network.
  await page.route('http://**/*', route => route.request().url() === documentUrl
    ? route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html })
    : route.abort());
  const requests: string[] = [];
  const errors: string[] = [];
  page.on('request', request => requests.push(request.url()));
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(documentUrl);
  await expect(page.getByRole('heading', { name: 'Life lately.' })).toBeVisible();
  const images = page.locator('img');
  expect(await images.count()).toBeGreaterThan(15);
  for (const image of await images.all()) {
    await image.scrollIntoViewIfNeeded();
    await expect(image).toHaveJSProperty('complete', true);
    await expect.poll(() => image.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect(image).toHaveAttribute('src', /^data:image\//);
  }
  await page.getByRole('button', { name: 'Make an album', exact: true }).click();
  const editor = page.getByRole('dialog');
  await editor.getByLabel('Album title', { exact: true }).fill('Offline adventures');
  await editor.getByLabel('A moment in time', { exact: true }).fill('2026-11');
  await editor.getByRole('combobox', { name: 'Who’s this for?', exact: true }).selectOption('family');
  await editor.getByLabel('Choose album photos').setInputFiles(path.resolve('public/photos/canoe.jpg'));
  await expect(editor.locator('.editor-photo')).toHaveCount(1);
  await editor.getByLabel('Caption for photo 1', { exact: true }).fill('An offline canoe memory.');
  await editor.getByRole('button', { name: 'Create album', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Offline adventures' })).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('img', { name: 'An offline canoe memory.', exact: true })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Close dialog' }).click();
  await expect.poll(() => page.evaluate(async () => {
    return new Promise<boolean>((resolve, reject) => {
      const request = indexedDB.open('gather-albums', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('app', 'readonly');
        const get = tx.objectStore('app').get('state');
        tx.oncomplete = () => { db.close(); resolve(get.result?.state.albums.some((album: { title: string }) => album.title === 'Offline adventures')); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      };
    });
  })).toBe(true);
  await page.reload();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'My albums', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Offline adventures', exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: /^Year in review/ }).click();
  await page.getByRole('combobox', { name: 'Yearbook year' }).selectOption('2026');
  await page.getByRole('combobox', { name: 'Yearbook audience' }).selectOption('family');
  await expect(page.getByRole('heading', { name: 'An offline canoe memory.', exact: true })).toBeVisible();
  const count = await page.locator('.yearbook-memory').count();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export yearbook', exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('gather-2026-family-yearbook.html');
  const exported = await readFile((await file.path())!, 'utf8');
  expect(exported).toContain('An offline canoe memory.');
  expect((exported.match(/<img src="data:image\//g) ?? []).length).toBe(count);
  expect(requests.filter(url => url !== documentUrl && !/^(?:file|data|blob):/.test(url))).toEqual([]);
  expect(errors).toEqual([]);
});
