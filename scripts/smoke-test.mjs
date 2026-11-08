import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import JSZip from 'jszip';

const baseURL = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const email = `smoke-${Date.now()}@farhangpt-test.example`;
const password = 'OnlyForSmokeTest-2026!';
const changedPassword = 'ChangedForSmokeTest-2026!';
let accountCreated = false;
const post = (url, data, ctx = context) => ctx.request.post(url, { data });
const json = async response => { assert.ok(response.ok(), `HTTP ${response.status()}: ${await response.text()}`); return response.json(); };
try {
  await fs.mkdir('artifacts', { recursive: true });
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: 'artifacts/desktop-final.png', fullPage: true });
  console.log('PASS desktop workspace, hydration, and layout');

  await page.getByRole('button', { name: 'Prompt library', exact: false }).click();
  const library = page.getByRole('dialog');
  await library.getByLabel('Search prompts').fill('story');
  await library.getByRole('button', { name: 'Save Start a story worth telling', exact: true }).click();
  await library.getByRole('button', { name: /^Saved/ }).click();
  await expect(library.getByRole('heading', { name: 'Start a story worth telling' })).toBeVisible();
  await library.getByRole('button', { name: 'Try this prompt' }).click();
  await expect(page.getByRole('textbox', { name: 'Message FarhanGPT' })).toHaveValue(/short story/);
  await page.getByRole('textbox', { name: 'Message FarhanGPT' }).fill('');
  console.log('PASS prompt library search, bookmarks, and composer insertion');
  await page.locator('input[type="file"]').setInputFiles({ name: 'a-little-idea.txt', mimeType: 'text/plain', buffer: Buffer.from('A little curiosity. Endless possibilities.') });
  await expect(page.locator('.attachment-chip')).toContainText('a-little-idea.txt');
  await page.getByRole('button', { name: 'Remove attachment', exact: true }).click();
  await expect(page.locator('.attachment-chip')).toHaveCount(0);
  console.log('PASS text attachment selection and removal');

  await page.getByRole('button', { name: 'Choose AI model', exact: true }).click();
  await page.locator('.model-popover').getByRole('button', { name: /Gemini 2.5 Flash/ }).click();
  await expect(page.getByRole('button', { name: 'Choose AI model', exact: true })).toContainText('Gemini 2.5 Flash');
  await page.getByRole('button', { name: 'Choose AI model', exact: true }).click();
  await page.locator('.model-popover').getByRole('button', { name: /FarhanGPT/ }).click();
  await page.getByRole('button', { name: 'Deep think', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Deep think', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Deep think', exact: true }).click();
  await page.getByRole('button', { name: 'Search web', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Search web', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Search web', exact: true }).click();
  console.log('PASS multi-model picker and reasoning/search controls');

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('dialog');
  await settings.getByRole('button', { name: 'Light', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await settings.getByRole('button', { name: 'Dark', exact: true }).click();
  await settings.getByRole('switch', { name: 'Animated background' }).click();
  await expect(settings.getByRole('switch', { name: 'Animated background' })).toHaveAttribute('aria-checked', 'false');
  await settings.getByRole('switch', { name: 'Animated background' }).click();
  await settings.getByRole('button', { name: 'Close dialog' }).click();
  console.log('PASS themes and animation preferences');

  await page.getByRole('button', { name: 'Dismiss app announcement' }).click();
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByRole('button', { name: 'Dismiss app announcement' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Get the mobile app', exact: true }).click();
  const install = page.getByRole('dialog');
  await expect(install.getByRole('link', { name: 'Download Android APK' })).toHaveAttribute('href', '/downloads/farhangpt.apk');
  await expect(install.getByRole('link', { name: 'Source ZIP' })).toHaveAttribute('href', '/downloads/farhangpt-source.zip');
  await install.getByRole('button', { name: 'iPhone & iPad' }).click();
  await expect(install.getByText('Add to Home Screen', { exact: true })).toBeVisible();
  await install.getByRole('button', { name: 'Close dialog' }).click();
  for (const [url, signature] of [['/downloads/farhangpt.apk', 'PK'], ['/downloads/farhangpt-source.zip', 'PK']]) {
    const response = await context.request.get(url); assert.equal(response.status(), 200); const bytes = await response.body(); assert.equal(bytes.subarray(0, 2).toString(), signature); assert.ok(bytes.length > 10000);
  }
  const source = await context.request.get('/downloads/farhangpt-source.zip');
  const sourceZip = await JSZip.loadAsync(await source.body());
  const paths = Object.keys(sourceZip.files);
  assert.ok(paths.includes('farhangpt/README.md'));
  assert.ok(paths.includes('farhangpt/android/src/com/farhan/farhangpt/MainActivity.java'));
  assert.ok(!paths.some(p => /\/\.env(?:$|\.(?!example$))/.test(p)));
  const secretPattern = new RegExp(['sk', 'or', 'v1'].join('-') + '-[a-f0-9]{48,}', 'i');
  for (const [name, file] of Object.entries(sourceZip.files)) if (!file.dir && /\.(tsx?|jsx?|md|json|jsonc|env|example)$/.test(name)) assert.equal(secretPattern.test(await file.async('string')), false, `Credential found in ${name}`);
  console.log('PASS persistent banner dismissal, platform install instructions, APK/ZIP downloads, and source privacy');

  const aiResponsePromise = page.waitForResponse(response => response.url().endsWith('/api/chat') && response.request().method() === 'POST', { timeout: 120000 });
  await page.getByRole('textbox', { name: 'Message FarhanGPT' }).fill('Reply with exactly these two words: Hello Farhan!');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  const aiResponse = await aiResponsePromise;
  const aiText = await aiResponse.text();
  await expect(page.getByRole('button', { name: 'Send message', exact: true })).toBeVisible({ timeout: 120000 });
  if (aiResponse.ok()) { assert.ok(aiText.includes('"type":"meta"')); assert.ok(aiText.includes('"type":"done"')); console.log('PASS live AI request and streamed response'); }
  else { assert.ok([429, 502, 503].includes(aiResponse.status())); console.log('PROVIDER NOTICE:', aiResponse.status(), JSON.parse(aiText).error); }
  const bootstrap = await json(await context.request.get('/api/bootstrap'));
  assert.ok(bootstrap.conversations.length > 0);
  const conversationId = bootstrap.conversations[0].id;
  const ownChat = await json(await context.request.get(`/api/conversations/${conversationId}`));
  assert.ok(ownChat.messages.some(message => message.content.includes('Hello Farhan')));
  const stranger = await browser.newContext({ baseURL });
  await json(await stranger.request.get('/api/bootstrap'));
  assert.equal((await stranger.request.get(`/api/conversations/${conversationId}`)).status(), 404);
  assert.equal((await stranger.request.patch(`/api/conversations/${conversationId}`, { data: { title: 'Not allowed' } })).status(), 404);
  assert.equal((await stranger.request.delete(`/api/conversations/${conversationId}`)).status(), 404);
  await stranger.close();
  console.log('PASS database persistence and cross-session conversation isolation');

  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Your name', { exact: true }).fill('Smoke Tester');
  await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create your free account' }).click();
  await expect(page.getByRole('button', { name: 'Smoke', exact: false }).first()).toBeVisible();
  accountCreated = true;
  const signedIn = await json(await context.request.get('/api/bootstrap'));
  assert.equal(signedIn.user.email, email); assert.ok(signedIn.conversations.some(chat => chat.id === conversationId));
  const exported = await json(await context.request.get('/api/account/export'));
  assert.equal(exported.user.email, email); assert.ok(exported.conversations.length > 0); assert.equal(JSON.stringify(exported).includes('passwordHash'), false); assert.equal(JSON.stringify(exported).includes('tokenHash'), false);
  assert.equal((await post('/api/auth', { action: 'change-password', currentPassword: 'WrongPassword!', password: changedPassword })).status(), 400);
  await json(await post('/api/auth', { action: 'change-password', currentPassword: password, password: changedPassword }));
  await json(await post('/api/auth', { action: 'logout' }));
  assert.equal((await json(await context.request.get('/api/bootstrap'))).user, null);
  assert.equal((await post('/api/auth', { action: 'login', email, password })).status(), 401);
  const relogin = await json(await post('/api/auth', { action: 'login', email, password: changedPassword })); assert.equal(relogin.user.email, email);
  assert.ok((await json(await context.request.get('/api/bootstrap'))).conversations.some(chat => chat.id === conversationId));
  console.log('PASS UI registration, guest-chat claiming, private data export, password change, logout, and login');

  const rejectedOrigin = await context.request.post('/api/auth', { headers: { Origin: 'https://untrusted.example' }, data: { action: 'logout' } }); assert.equal(rejectedOrigin.status(), 403);
  await json(await context.request.patch(`/api/conversations/${conversationId}`, { data: { title: 'A verified private idea' } }));
  assert.equal((await json(await context.request.get(`/api/conversations/${conversationId}`))).conversation.title, 'A verified private idea');
  await json(await context.request.delete(`/api/conversations/${conversationId}`));
  assert.equal((await context.request.get(`/api/conversations/${conversationId}`)).status(), 404);
  await json(await post('/api/auth', { action: 'delete-account', password: changedPassword })); accountCreated = false;
  assert.equal((await json(await context.request.get('/api/bootstrap'))).user, null);
  console.log('PASS CSRF protection, rename/delete, account deletion, and test-data cleanup');

  const mobileContext = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mobile = await mobileContext.newPage(); await mobile.goto('/', { waitUntil: 'networkidle' });
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await mobile.screenshot({ path: 'artifacts/mobile-final.png', fullPage: true });
  await mobile.getByRole('button', { name: 'Toggle navigation' }).click();
  await expect(mobile.getByRole('button', { name: 'Prompt library', exact: false })).toBeVisible();
  await mobile.getByRole('button', { name: 'Close navigation', exact: true }).click();
  await mobileContext.close();
  assert.deepEqual(errors, []);
  console.log('PASS mobile layout and navigation; no JavaScript errors');
  console.log('ALL APPLICATION SMOKE TESTS PASSED');
} finally {
  if (accountCreated) { try { await post('/api/auth', { action: 'delete-account', password: changedPassword }); } catch {} }
  await browser.close();
}
