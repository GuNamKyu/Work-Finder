import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DATA_FILES, PUBLIC_FILES, UI_FILES, comparePublic, prepareUiOnly, verifyUiOnly } from './ui-publication.mjs';

const baseUrl = 'https://pages.example.test/Work-Finder/';
function publicFixture() {
  const files = new Map();
  for (const name of UI_FILES) files.set(name, Buffer.from(`public:${name}\n`));
  for (const name of DATA_FILES) {
    const payload = name === 'learned-exclusions.json' ? { version: 1, generatedAt: '', rules: [] } : [];
    files.set(name, Buffer.from(JSON.stringify(payload) + '\n'));
  }
  return files;
}
function fetchFixture(files) {
  return async input => {
    const name = new URL(String(input)).pathname.split('/').at(-1);
    const bytes = files.get(name);
    return new Response(bytes || 'missing', { status: bytes ? 200 : 404, headers: { 'content-type': name.endsWith('.json') ? 'application/json' : 'text/plain' } });
  };
}
async function repoFixture(t, files) {
  const root = await mkdtemp(join(tmpdir(), 'workfinder-ui-publication-'));
  const repo = join(root, 'repo');
  await mkdir(join(repo, 'web'), { recursive: true });
  for (const name of PUBLIC_FILES) {
    const bytes = files.get(name);
    await writeFile(join(repo, 'web', name), UI_FILES.includes(name) ? bytes : Buffer.from(`local-stale:${name}`));
  }
  t.after(() => rm(root, { recursive: true, force: true }));
  return repo;
}

test('public comparison distinguishes data changes from UI changes', async t => {
  const live = publicFixture();
  const repo = await repoFixture(t, live);
  for (const name of DATA_FILES) await writeFile(join(repo, 'web', name), live.get(name));
  assert.deepEqual(await comparePublic(repo, join(repo, 'web'), { baseUrl, fetchImpl: fetchFixture(live) }), {
    dataChanged: false, uiChanged: false, changedDataFiles: [], changedUiFiles: [], recommendedMode: 'none',
  });
  await writeFile(join(repo, 'web', 'app.js'), 'changed UI');
  const ui = await comparePublic(repo, join(repo, 'web'), { baseUrl, fetchImpl: fetchFixture(live) });
  assert.equal(ui.dataChanged, false); assert.equal(ui.uiChanged, true); assert.equal(ui.recommendedMode, 'ui-only');
  await writeFile(join(repo, 'web', 'results.json'), '[{"new":"candidate"}]');
  const data = await comparePublic(repo, join(repo, 'web'), { baseUrl, fetchImpl: fetchFixture(live) });
  assert.equal(data.dataChanged, true); assert.equal(data.recommendedMode, 'data-and-ui');
});

test('UI-only artifact carries local UI code and byte-identical public data', async t => {
  const live = publicFixture();
  const repo = await repoFixture(t, live);
  await writeFile(join(repo, 'web', 'index.html'), '<main>new UI</main>');
  const fetchImpl = fetchFixture(live);
  const prepared = await prepareUiOnly(repo, 'ui-test-1', { baseUrl, fetchImpl });
  assert.equal(prepared.shouldDeploy, true);
  assert.equal(await readFile(join(repo, prepared.webPath, 'index.html'), 'utf8'), '<main>new UI</main>');
  for (const name of DATA_FILES) assert.deepEqual(await readFile(join(repo, prepared.webPath, name)), live.get(name));
  assert.deepEqual(await verifyUiOnly(repo, 'ui-test-1', { baseUrl, fetchImpl }), { verified: true, mode: 'ui-only', runId: 'ui-test-1', preservedDataFiles: DATA_FILES.length });
});

test('UI-only does not write a snapshot when public UI already matches', async t => {
  const live = publicFixture();
  const repo = await repoFixture(t, live);
  for (const name of DATA_FILES) await writeFile(join(repo, 'web', name), live.get(name));
  for (const name of UI_FILES) await writeFile(join(repo, 'web', name), live.get(name));
  const prepared = await prepareUiOnly(repo, 'ui-test-noop', { baseUrl, fetchImpl: fetchFixture(live) });
  assert.equal(prepared.shouldDeploy, false);
  await assert.rejects(readFile(join(repo, 'data', 'ui-publications', 'ui-test-noop', 'manifest.json')));
});

test('UI-only verification stops if the live JSON changes after preparation', async t => {
  const live = publicFixture();
  const repo = await repoFixture(t, live);
  await writeFile(join(repo, 'web', 'app.css'), 'changed UI');
  await prepareUiOnly(repo, 'ui-test-race', { baseUrl, fetchImpl: fetchFixture(live) });
  live.set('results.json', Buffer.from('[{"later":"publication"}]'));
  await assert.rejects(verifyUiOnly(repo, 'ui-test-race', { baseUrl, fetchImpl: fetchFixture(live) }), /Public site changed since UI-only preparation/);
});
