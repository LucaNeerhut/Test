import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const fixture = path.resolve('public/photos/canoe.jpg');

async function navigate(page: Page, name: string) {
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: name === 'Year in review' ? /^Year in review/ : name, exact: true }).click();
}

async function waitForSavedState(page: Page, predicate: string) {
  await expect.poll(() => page.evaluate(async condition => {
    const stored = await new Promise<any>((resolve, reject) => {
      const open = indexedDB.open('gather-albums', 1);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const transaction = db.transaction('app', 'readonly');
        const request = transaction.objectStore('app').get('state');
        transaction.oncomplete = () => { db.close(); resolve(request.result?.state); };
        transaction.onerror = () => { db.close(); reject(transaction.error); };
      };
    });
    return Function('state', `return (${condition});`)(stored);
  }, predicate)).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Life lately.' })).toBeVisible();
});

test('sample feed loads bundled photos, filters circles, and searches albums', async ({ page }) => {
  await expect(page.locator('.album-card')).toHaveCount(5);
  for (const image of await page.locator('main img').all()) {
    await image.scrollIntoViewIfNeeded();
    await expect(image).toHaveJSProperty('complete', true);
    await expect.poll(() => image.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  }
  await page.getByRole('button', { name: 'Besties', exact: true }).click();
  await expect(page.locator('.album-card')).toHaveCount(2);
  await page.getByRole('button', { name: 'All updates', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search albums' }).fill('sea');
  await expect(page.locator('.album-card')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Somewhere by the sea' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Search albums' }).fill('nonexistent story');
  await expect(page.getByRole('heading', { name: 'No moments found' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(page.locator('.album-card')).toHaveCount(5);
});

test('saved albums and personal notes survive a refresh', async ({ page }) => {
  await page.getByRole('button', { name: 'Save A little bit of October', exact: true }).click();
  await navigate(page, 'Saved albums');
  await expect(page.locator('.album-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Open album: A little bit of October', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Personal note' }).fill('Let’s take the long way home next weekend.');
  await dialog.getByRole('button', { name: 'Keep this note' }).click();
  await expect(dialog.locator('.personal-note')).toHaveText(/Let’s take the long way home next weekend/);
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await waitForSavedState(page, "state.savedAlbumIds.includes('sophie-october') && state.notes['sophie-october']?.length === 1");
  await page.reload();
  await navigate(page, 'Saved albums');
  await expect(page.locator('.album-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Open album: A little bit of October', exact: true }).click();
  await expect(page.getByRole('dialog').locator('.personal-note')).toHaveText(/Let’s take the long way home next weekend/);
  await page.getByRole('dialog').getByRole('button', { name: 'Unsave album', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.getByRole('heading', { name: 'Keep the ones you love.' })).toBeVisible();
});

test('uploads and creates a family album with a yearbook highlight, then restores it', async ({ page }) => {
  await page.getByRole('button', { name: 'Make an album', exact: true }).click();
  const editor = page.getByRole('dialog');
  await expect(editor.getByRole('button', { name: 'Create album', exact: true })).toBeDisabled();
  await editor.getByLabel('Album title', { exact: true }).fill('November with the family');
  await editor.getByLabel('A moment in time', { exact: true }).fill('2026-11');
  await editor.getByRole('combobox', { name: 'Who’s this for?', exact: true }).selectOption('family');
  await editor.getByPlaceholder('What made this chapter yours?').fill('A weekend away, all together.');
  await editor.getByLabel('Choose album photos').setInputFiles(fixture);
  await expect(editor.locator('.editor-photo')).toHaveCount(1);
  await editor.getByLabel('Caption for photo 1', { exact: true }).fill('A quiet paddle with everyone.');
  await expect(editor.getByRole('button', { name: 'Remove photo 1 from yearbook highlights', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await editor.getByRole('button', { name: 'Create album', exact: true }).click();
  const viewer = page.getByRole('dialog', { name: 'November with the family' });
  await expect(viewer).toBeVisible();
  await expect(viewer.getByRole('img', { name: 'A quiet paddle with everyone.', exact: true })).toBeVisible();
  await expect(viewer.getByRole('button', { name: 'Remove from yearbook', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await viewer.getByRole('combobox', { name: 'Preview album as' }).selectOption('public');
  await expect(viewer.getByRole('heading', { name: 'Kept a little closer.' })).toBeVisible();
  await viewer.getByRole('button', { name: 'Close dialog' }).click();
  await waitForSavedState(page, "state.albums.some(album => album.title === 'November with the family' && album.photos[0].src.startsWith('data:image/') && album.photos[0].highlight)");
  await page.reload();
  await navigate(page, 'My albums');
  await expect(page.getByRole('heading', { name: 'November with the family', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open album: November with the family', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('A weekend away, all together.', { exact: true })).toBeVisible();
});

test('editing narrows photo audiences and audience previews exclude private photos', async ({ page }) => {
  await navigate(page, 'My albums');
  await page.getByRole('button', { name: 'Open album: September’s golden hours', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Edit album', exact: true }).click();
  const editor = page.getByRole('dialog');
  await editor.getByRole('combobox', { name: 'Who’s this for?', exact: true }).selectOption('family');
  const expectedAudiences = ['family', 'family', 'private', 'family'];
  for (const [index, select] of (await editor.getByRole('combobox', { name: /Audience for photo/ }).all()).entries()) {
    await expect(select).toHaveValue(expectedAudiences[index]);
    expect(await select.locator('option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value))).toEqual(['family', 'private']);
  }
  await editor.getByLabel('Caption for photo 1', { exact: true }).fill('A memory just for me.');
  await editor.getByRole('combobox', { name: 'Audience for photo 1', exact: true }).selectOption('private');
  await editor.getByRole('button', { name: 'Save changes', exact: true }).click();
  const viewer = page.getByRole('dialog');
  await viewer.getByRole('combobox', { name: 'Preview album as' }).selectOption('family');
  await expect(viewer.getByText('Audience preview · 2 of 4 photos hidden.', { exact: false })).toBeVisible();
  await expect(viewer.getByRole('img', { name: 'A memory just for me.', exact: true })).toHaveCount(0);
  await expect(viewer.getByRole('button', { name: /View photo/ })).toHaveCount(2);
  await viewer.getByRole('combobox', { name: 'Preview album as' }).selectOption('besties');
  await expect(viewer.getByRole('heading', { name: 'Kept a little closer.' })).toBeVisible();
  await viewer.getByRole('combobox', { name: 'Preview album as' }).selectOption('private');
  await expect(viewer.getByRole('img', { name: 'A memory just for me.', exact: true })).toBeVisible();
  await expect(viewer.getByRole('button', { name: /View photo/ })).toHaveCount(4);
});

test('circle membership persists and controls the people shown by its feed filter', async ({ page }) => {
  await navigate(page, 'My circles');
  await page.locator('.circle-family').getByRole('button', { name: 'Manage circle' }).click();
  const dialog = page.getByRole('dialog', { name: 'Your family circle' });
  await dialog.getByRole('checkbox', { name: /Mum/ }).uncheck();
  await dialog.getByRole('checkbox', { name: /James Wilson/ }).check();
  await dialog.getByRole('button', { name: 'Save circle' }).click();
  await waitForSavedState(page, "state.circles.find(circle => circle.id === 'family').members.some(member => member.id === 'james') && !state.circles.find(circle => circle.id === 'family').members.some(member => member.id === 'mum')");
  await page.reload();
  await navigate(page, 'My circles');
  await page.locator('.circle-family').getByRole('button', { name: 'Manage circle' }).click();
  await expect(page.getByRole('dialog').getByRole('checkbox', { name: /Mum/ })).not.toBeChecked();
  await expect(page.getByRole('dialog').getByRole('checkbox', { name: /James Wilson/ })).toBeChecked();
  await page.getByRole('dialog').getByRole('button', { name: 'Close dialog' }).click();
  await navigate(page, 'Your people');
  await page.getByRole('button', { name: 'Family', exact: true }).click();
  await expect(page.locator('.album-card')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Somewhere by the sea' })).toBeVisible();
});

test('yearbook editions and exported HTML preserve restrictive photo audiences', async ({ page }) => {
  await page.getByRole('button', { name: 'Make an album', exact: true }).click();
  const editor = page.getByRole('dialog');
  await editor.getByLabel('Album title', { exact: true }).fill('Three ways to remember');
  await editor.getByLabel('A moment in time', { exact: true }).fill('2026-11');
  await editor.getByRole('combobox', { name: 'Who’s this for?', exact: true }).selectOption('public');
  await editor.getByLabel('Choose album photos').setInputFiles([fixture, fixture, fixture]);
  await expect(editor.locator('.editor-photo')).toHaveCount(3);
  for (const [index, caption, audience] of [[1, 'An open little memory.', 'public'], [2, 'A family-only little memory.', 'family'], [3, 'A secret little memory.', 'private']] as const) {
    await editor.getByLabel(`Caption for photo ${index}`, { exact: true }).fill(caption);
    await editor.getByRole('combobox', { name: `Audience for photo ${index}`, exact: true }).selectOption(audience);
    if (index > 1) await editor.getByRole('button', { name: `Add photo ${index} to yearbook highlights`, exact: true }).click();
  }
  await editor.getByRole('button', { name: 'Create album', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Close dialog' }).click();
  await navigate(page, 'Year in review');
  await page.getByRole('combobox', { name: 'Yearbook year' }).selectOption('2026');
  await page.getByRole('combobox', { name: 'Yearbook audience' }).selectOption('family');
  await expect(page.getByRole('heading', { name: 'An open little memory.', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'A family-only little memory.', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'A secret little memory.', exact: true })).toHaveCount(0);
  const familyCount = await page.locator('.yearbook-memory').count();
  const familyDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export yearbook', exact: true }).click();
  const familyFile = await familyDownload;
  expect(familyFile.suggestedFilename()).toBe('gather-2026-family-yearbook.html');
  const familyHtml = await readFile((await familyFile.path())!, 'utf8');
  expect((familyHtml.match(/<figure>/g) ?? []).length).toBe(familyCount);
  expect(familyHtml).toContain('A family-only little memory.');
  expect(familyHtml).not.toContain('A secret little memory.');
  expect((familyHtml.match(/<img src="data:image\//g) ?? []).length).toBe(familyCount);
  await page.getByRole('combobox', { name: 'Yearbook audience' }).selectOption('public');
  await expect(page.locator('.yearbook-memory')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'A family-only little memory.', exact: true })).toHaveCount(0);
  const publicDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export yearbook', exact: true }).click();
  const publicFile = await publicDownload;
  const publicHtml = await readFile((await publicFile.path())!, 'utf8');
  expect((publicHtml.match(/<figure>/g) ?? []).length).toBe(1);
  expect(publicHtml).toContain('An open little memory.');
  expect(publicHtml).not.toContain('A family-only little memory.');
  expect(publicHtml).not.toContain('A secret little memory.');
  expect(publicHtml).not.toContain('Our family catch-up');
});

test('mobile navigation works without horizontal page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Open navigation', exact: true })).toBeVisible();
  for (const [name, heading] of [['My albums', 'My albums.'], ['My circles', 'Good company.'], ['Year in review', 'Your year, gathered.'], ['Saved albums', 'The ones you kept.'], ['Your people', 'Life lately.']]) {
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
    await navigate(page, name);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close navigation', exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.getByRole('button', { name: 'Make an album', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('a stale tab warns before it can overwrite newer saved changes', async ({ page, context }) => {
  const staleTab = await context.newPage();
  await staleTab.goto('/');
  await expect(staleTab.getByRole('heading', { name: 'Life lately.' })).toBeVisible();
  await page.getByRole('button', { name: 'Save A little bit of October', exact: true }).click();
  await waitForSavedState(page, "state.savedAlbumIds.includes('sophie-october')");
  await staleTab.getByRole('button', { name: 'Save Somewhere by the sea', exact: true }).click();
  await expect(staleTab.getByRole('alert')).toContainText('Gather changed in another tab.');
  await waitForSavedState(page, "state.savedAlbumIds.includes('sophie-october') && !state.savedAlbumIds.includes('james-coast')");
  await staleTab.getByRole('button', { name: 'Reload the saved version', exact: true }).click();
  await expect(staleTab.getByRole('heading', { name: 'Life lately.' })).toBeVisible();
  await expect(staleTab.getByRole('alert')).toHaveCount(0);
  await navigate(staleTab, 'Saved albums');
  await expect(staleTab.locator('.album-card')).toHaveCount(1);
  await expect(staleTab.getByRole('heading', { name: 'A little bit of October', exact: true })).toBeVisible();
  await staleTab.close();
});
