import assert from 'node:assert/strict';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const browser = await chromium.launch(process.env.CHROME_CHANNEL ? {channel:process.env.CHROME_CHANNEL} : {});
const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, reducedMotion: 'reduce' });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const out = await mkdtemp(join(tmpdir(), 'second-cursor-review-'));
page.setDefaultTimeout(8000);
const button = name => page.getByRole('button', { name, exact: true });
const frame = page.frameLocator('iframe[title="Delivered interface"]');
const brief = page.getByRole('textbox', {name:'Design brief or change'});
async function send(text) {
  await brief.fill(text);
  await button('Send').click();
}
async function build(revision = false) {
  const action = page.getByRole('button', {name: revision ? 'Apply plan' : 'Build plan', exact:true, disabled:false}).last();
  await action.click();
}
async function inspect(width, file) {
  await page.setViewportSize({width, height: width < 500 ? 844 : 960});
  await page.evaluate(() => document.querySelector('.workspace').scrollTo(0,0));
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Overflow at '+width);
  assert.ok(await page.locator('img').evaluateAll(imgs=>imgs.every(i=>!i.complete || i.naturalWidth>0)), 'Broken image');
  await page.screenshot({path:join(out,file)});
}
try {
  await page.goto(process.env.STUDIO_URL || 'http://localhost:4739/studio/');
  await button('Write a brief').waitFor();
  await inspect(1440,'studio-desktop.png');
  await inspect(390,'studio-mobile.png');
  await page.setViewportSize({width:1280,height:900});
  const files = [];
  for (const [name,tag,asset] of [['Search index','search','desktop'],['Annual poster','typography','mobile']]) {
    files.push({ name: name+'.md', mimeType:'text/markdown', buffer:Buffer.from('---\ntitle: '+name+'\nfeatures: ['+tag+']\n---\n# '+name+'\n\n## Adaptation\nUse '+tag+' to make the collection easier to use.\n\n![Preview]('+asset+'.png)') });
    files.push({ name:asset+'.png',mimeType:'image/png',buffer:await readFile(new URL('../../design-vault/assets/after-hours-'+asset+'.png',import.meta.url)) });
  }
  await page.locator('.vault-library input[type=file]').first().setInputFiles(files);
  await page.getByLabel('Filter by tag').selectOption('search');
  assert.equal(await page.locator('.vault-card').count(),1);
  await button('Open Search index').click();
  await page.locator('dialog img').waitFor();
  assert.equal(await page.locator('dialog img').count(),1);
  await button('Close').click();
  await page.getByLabel('Select Search index').check();
  await page.getByLabel('Filter by tag').selectOption('');
  await button('Open Annual poster').click();
  await page.locator('dialog img').waitFor();
  assert.equal(await page.locator('dialog img').count(),1);
  await button('Close').click();
  await page.reload();
  await page.getByLabel('Select Search index').waitFor();
  assert.ok(await page.getByLabel('Select Search index').isChecked());
  await button('Write a brief').click();
  await page.getByRole('button',{name:/Selected notes/}).click();
  await send('Build a searchable app named "Field Index" for design references');
  await build();
  await frame.getByRole('heading',{name:'Field Index',exact:true}).waitFor();
  await button('Dismiss companion').click();
  await frame.locator('[data-primary]').click();
  await frame.locator('#entry-title, #entry-name, #new-entry').first().fill('Hansel print study');
  await frame.getByRole('button',{name:'Add to list'}).click();
  await frame.getByText('Hansel print study',{exact:true}).waitFor();
  await inspect(1280,'app-v1-desktop.png');
  await button('Request a revision').click();
  await send('Set title to Reference Atlas');
  await build(true);
  await frame.getByRole('heading',{name:'Reference Atlas',exact:true}).waitFor();
  await button('Dismiss companion').click();
  await page.reload();
  await frame.getByRole('heading',{name:'Reference Atlas',exact:true}).waitFor();
  await inspect(390,'app-v2-mobile.png');
  await page.getByLabel('Restore saved version').selectOption('1');
  await frame.getByRole('heading',{name:'Field Index',exact:true}).waitFor();
  await page.reload();
  await frame.getByRole('heading',{name:'Field Index',exact:true}).waitFor();
  assert.equal(await page.getByLabel('Restore saved version').inputValue(),'1');
  const download = page.waitForEvent('download');
  await button('Download HTML ↓').click();
  const artifact = await readFile(await (await download).path(),'utf8');
  assert.ok(!artifact.includes("'nonce-") && artifact.includes("'sha256-"));
  await button('Load design-vault demo').focus();
  await page.keyboard.press('Enter');
  await page.getByLabel('Select Founder audience · YC').waitFor();
  await page.getByLabel('Select Founder audience · YC').check();
  await button('New design').click();
  await send('Build a landing page named "Founder Workshop" for a startup accelerator');
  await build();
  await frame.getByRole('heading',{name:'Founder Workshop',exact:true}).waitFor();
  await button('Dismiss companion').click();
  await frame.getByRole('button',{name:'Apply',exact:true}).click();
  await frame.locator('#pitch').fill('A reference studio for founders.');
  await frame.getByRole('button',{name:'Prepare draft'}).click();
  assert.match(await frame.locator('#draft').innerText(),/reference studio/i);
  await inspect(1440,'founder-landing.png');
  for (const width of [1024,768,390,320]) await inspect(width,'review-'+width+'.png');
  assert.deepEqual(errors,[]);
  console.log('Passed import, image association, filter, reload, attachment, app build, interaction, revision, restore isolated HTML download, and a founder landing page with an application draft. Screenshots in '+out);
} catch (e) {
  await page.screenshot({path:join(out,'failure.png')});
  console.error('Browser errors',errors,'\n', (await page.locator('body').innerText()).slice(-3500),'\nScreenshots:',out);
  throw e;
} finally { await browser.close(); }
