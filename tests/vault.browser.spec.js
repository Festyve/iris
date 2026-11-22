const { test, expect } = require('@playwright/test');
const { mkdtemp, writeFile, rm, readFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

test('reload preserves the snapshot, then folder re-import repairs its images in place', async ({ page }) => {
  const dir = await mkdtemp(join(tmpdir(), 'reference-library-'));
  const original = '\uFEFF---\r\nauthor: A. Chen\r\n---\r\n# Field study\r\n  ![[broken.png]]  \r\n![[missing.png]]\r\n';
  try {
    await writeFile(join(dir, 'study.md'), original);
    await writeFile(join(dir, 'broken.png'), 'not an image');
    await page.goto(process.env.STUDIO_URL || 'http://127.0.0.1:5173/studio/');
    const library = page.getByRole('region', { name: 'Reference library' });
    const picker = library.locator('input[webkitdirectory]');
    const card = library.locator('article').filter({ has: page.getByRole('heading', { name: 'Field study' }) });
    await expect(library.getByRole('button', { name: 'Choose folder' })).toBeEnabled();
    await picker.setInputFiles(dir);
    await expect(card.getByText('Imported snapshot')).toBeVisible();
    await card.getByRole('checkbox').click();
    await expect(card.getByRole('checkbox')).toBeChecked();
    await page.reload();
    await expect(card.getByRole('checkbox')).toBeChecked();
    await expect(card.getByText('1 unresolved image link')).toBeVisible();
    await expect(card.getByText('Could not decode image: broken.png')).toBeVisible();
    await card.getByRole('button').click();
    const detail = page.getByRole('dialog');
    await expect(detail.getByText('By A. Chen')).toBeVisible();
    await expect(detail.getByText('missing.png — Image missing from collection')).toBeVisible();
    await detail.getByText('Original Markdown').click();
    expect(await detail.locator('pre').textContent()).toBe(original);
    await detail.getByRole('button', { name: 'Close' }).click();

    const image = await readFile(join(__dirname, '../design-vault/assets/after-hours-mobile.png'));
    await writeFile(join(dir, 'missing.png'), image);
    await writeFile(join(dir, 'broken.png'), image);
    await picker.setInputFiles(dir);
    await expect(card.getByText('1 unresolved image link')).toHaveCount(0);
    await expect(card).toHaveCount(1);
    await expect(card.getByRole('checkbox')).toBeChecked();
    await expect.poll(() => card.locator('img').evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
    await library.getByRole('button', { name: 'Load design-vault demo' }).click();
    await expect(library.locator('article').getByText('Design-vault demo', { exact: true })).toHaveCount(4);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
