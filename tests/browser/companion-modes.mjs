import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const browser = await chromium.launch();
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const button = name => page.getByRole('button', { name, exact: true });
    async function send(text) {
      await page.getByLabel('Design brief or change').fill(text);
      await button('Send').click();
    }
    await page.goto(process.env.STUDIO_URL || 'http://localhost:4739/studio/');
    await button('Write a brief').click();
    assert.equal(await button('Guide me').getAttribute('aria-pressed'), 'true');
    await button('Build end-to-end').click();
    await send('A record shelf for vinyl collectors');
    await page.getByText(/Should this be a landing page/).waitFor();
    assert.equal(await page.getByLabel('Delivered design').count(), 0);
    await send('A landing page called Side B');
    await page.getByLabel('Delivered design').waitFor();
    const preview = page.frameLocator('iframe[title="Delivered interface"]');
    await preview.getByRole('heading', { name: 'Side B', exact: true }).waitFor();
    await button('Guide me').click();
    await send('Set title to Sleeve Notes');
    await page.getByRole('button', { name: 'Apply plan', exact: true, disabled: false }).click();
    await preview.getByRole('heading', { name: 'Sleeve Notes' }).waitFor();
    await button('Dismiss companion').click();
    if (width > 700) {
      await preview.getByRole('link', { name: 'Opening bars' }).click();
    } else {
      await preview.locator('[data-primary]').click();
      await preview.locator('#entry-0').click();
    }
    assert.equal(await preview.locator('.entry details[open] p').evaluate(p => getComputedStyle(p).animationName), 'none');
    await page.getByLabel('Restore saved version').selectOption('1');
    await preview.getByRole('heading', { name: 'Side B' }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.close();
  }
} finally {
  await browser.close();
}
