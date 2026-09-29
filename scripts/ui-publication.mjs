import { appendFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PUBLIC_BASE_URL = 'https://gunamkyu.github.io/Work-Finder/';
export const UI_FILES = ['index.html', 'app.css', 'app.js', 'model.js', 'exclusions.js'];
export const DATA_FILES = ['results.json', 'experience-results.json', 'new-postings.json', 'source-health.json', 'learned-exclusions.json'];
export const PUBLIC_FILES = [...UI_FILES, ...DATA_FILES];
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

function validateJson(name, bytes) {
  let value;
  try { value = JSON.parse(bytes.toString('utf8')); }
  catch { throw new Error(`Public JSON is invalid: ${name}`); }
  if (name === 'learned-exclusions.json') assert(value && value.version === 1 && Array.isArray(value.rules), `Invalid public exclusions: ${name}`);
  else assert(Array.isArray(value), `Invalid public list: ${name}`);
}

async function fetchPublicFile(name, baseUrl, fetchImpl) {
  const base = new URL(baseUrl);
  assert(base.protocol === 'https:', 'Public baseline must use HTTPS');
  const url = new URL(name, base);
  url.searchParams.set('_ui_check', randomUUID());
  const response = await fetchImpl(url, { cache: 'no-store', signal: AbortSignal.timeout(20000) });
  assert(response.ok, `Cannot read current public ${name}: HTTP ${response.status}`);
  const finalUrl = response.url ? new URL(response.url) : url;
  assert(finalUrl.origin === base.origin && finalUrl.pathname === url.pathname, `Unexpected redirect for public ${name}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (name.endsWith('.json')) validateJson(name, bytes);
  return bytes;
}

async function readPublic(baseUrl, fetchImpl = fetch) {
  const entries = await Promise.all(PUBLIC_FILES.map(async name => [name, await fetchPublicFile(name, baseUrl, fetchImpl)]));
  return Object.fromEntries(entries);
}

async function readLocalWeb(webRoot) {
  const entries = await Promise.all(PUBLIC_FILES.map(async name => [name, await readFile(join(webRoot, name))]));
  for (const name of DATA_FILES) validateJson(name, entries.find(([key]) => key === name)[1]);
  return Object.fromEntries(entries);
}

function diffBytes(local, live) {
  const changedUiFiles = UI_FILES.filter(name => digest(local[name]) !== digest(live[name]));
  const changedDataFiles = DATA_FILES.filter(name => digest(local[name]) !== digest(live[name]));
  const dataChanged = changedDataFiles.length > 0;
  const uiChanged = changedUiFiles.length > 0;
  return {
    dataChanged, uiChanged, changedDataFiles, changedUiFiles,
    recommendedMode: dataChanged ? 'data-and-ui' : uiChanged ? 'ui-only' : 'none',
  };
}

export async function comparePublic(repo, candidateWeb = join(repo, 'web'), { baseUrl = PUBLIC_BASE_URL, fetchImpl = fetch } = {}) {
  repo = resolve(repo);
  const [local, live] = await Promise.all([readLocalWeb(resolve(candidateWeb)), readPublic(baseUrl, fetchImpl)]);
  return diffBytes(local, live);
}

function safeRunId(runId) {
  assert(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(runId || ''), 'Invalid UI publication ID');
}

function uiOutputPath(repo, runId) {
  const root = resolve(repo, 'data', 'ui-publications');
  const output = resolve(root, runId);
  const fromRoot = relative(root, output);
  assert(fromRoot && fromRoot !== '..' && !fromRoot.startsWith(`..${sep}`) && !isAbsolute(fromRoot), 'Unsafe UI publication path');
  return output;
}

async function writeGithubOutput(values) {
  const path = process.env.GITHUB_OUTPUT;
  if (!path) return;
  const content = Object.entries(values).map(([key, value]) => `${key}=${String(value)}\n`).join('');
  await appendFile(path, content, 'utf8');
}

/** Prepare a UI-only Pages artifact, sourcing every live JSON byte from the current public site. */
export async function prepareUiOnly(repo, runId, { baseUrl = PUBLIC_BASE_URL, fetchImpl = fetch } = {}) {
  repo = resolve(repo); safeRunId(runId);
  const localCode = Object.fromEntries(await Promise.all(UI_FILES.map(async name => [name, await readFile(join(repo, 'web', name))])));
  const live = await readPublic(baseUrl, fetchImpl);
  const changedUiFiles = UI_FILES.filter(name => digest(localCode[name]) !== digest(live[name]));
  if (!changedUiFiles.length) {
    const result = { shouldDeploy: false, runId, changedUiFiles, reason: 'No public UI change.' };
    await writeGithubOutput({ should_deploy: false, web_path: '' });
    return result;
  }

  const output = uiOutputPath(repo, runId);
  await mkdir(dirname(output), { recursive: true });
  await mkdir(output, { recursive: false });
  const webRoot = join(output, 'web');
  await mkdir(webRoot);
  for (const name of UI_FILES) await writeFile(join(webRoot, name), localCode[name], { flag: 'wx' });
  for (const name of DATA_FILES) await writeFile(join(webRoot, name), live[name], { flag: 'wx' });

  const baselineHashes = Object.fromEntries(PUBLIC_FILES.map(name => [name, digest(live[name])]));
  const files = Object.fromEntries(PUBLIC_FILES.map(name => [name, digest(name in localCode ? localCode[name] : live[name])]));
  const manifest = { schemaVersion: 1, mode: 'ui-only', runId, baselineUrl: baseUrl, createdAt: new Date().toISOString(), baselineHashes, files };
  await writeFile(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  const result = { shouldDeploy: true, runId, changedUiFiles, webPath: `data/ui-publications/${runId}/web` };
  await writeGithubOutput({ should_deploy: true, web_path: result.webPath });
  return result;
}

/** Recheck immutable snapshot bytes and ensure the live site has not moved since preparation. */
export async function verifyUiOnly(repo, runId, { baseUrl = PUBLIC_BASE_URL, fetchImpl = fetch } = {}) {
  repo = resolve(repo); safeRunId(runId);
  const output = uiOutputPath(repo, runId);
  const manifest = JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8'));
  assert(manifest.schemaVersion === 1 && manifest.mode === 'ui-only' && manifest.runId === runId && manifest.baselineUrl === baseUrl, 'Invalid UI-only manifest');
  const webRoot = join(output, 'web');
  const names = (await readdir(webRoot)).sort();
  assert(JSON.stringify(names) === JSON.stringify([...PUBLIC_FILES].sort()), 'Unexpected UI-only artifact file set');
  const snapshot = await readLocalWeb(webRoot);
  const localCode = Object.fromEntries(await Promise.all(UI_FILES.map(async name => [name, await readFile(join(repo, 'web', name))])));
  const live = await readPublic(baseUrl, fetchImpl);
  for (const name of PUBLIC_FILES) {
    assert(digest(snapshot[name]) === manifest.files?.[name], `UI-only artifact changed: ${name}`);
    assert(digest(live[name]) === manifest.baselineHashes?.[name], `Public site changed since UI-only preparation: ${name}`);
  }
  for (const name of UI_FILES) assert(digest(snapshot[name]) === digest(localCode[name]), `UI code changed after UI-only preparation: ${name}`);
  for (const name of DATA_FILES) assert(digest(snapshot[name]) === digest(live[name]), `UI-only mode must preserve live data: ${name}`);
  return { verified: true, mode: 'ui-only', runId, preservedDataFiles: DATA_FILES.length };
}

async function main() {
  const [command, repoArg, subject, requestedMode = 'auto'] = process.argv.slice(2);
  assert(repoArg && ['compare', 'prepare-ui', 'verify-ui'].includes(command), 'Usage: ui-publication.mjs compare <repo> [candidate-web] [auto|data-and-ui|ui-only] | prepare-ui <repo> <runId> | verify-ui <repo> <runId>');
  const repo = resolve(repoArg);
  if (command === 'compare') {
    const mode = ['auto', 'data-and-ui', 'ui-only'].includes(requestedMode) ? requestedMode : null;
    assert(mode, `Invalid comparison mode: ${requestedMode}`);
    const report = await comparePublic(repo, subject ? resolve(repo, subject) : join(repo, 'web'));
    const shouldDeploy = mode === 'auto' ? report.recommendedMode !== 'none' : mode === 'data-and-ui' ? report.dataChanged : report.uiChanged;
    await writeGithubOutput({ should_deploy: shouldDeploy, recommended_mode: report.recommendedMode, data_changed: report.dataChanged, ui_changed: report.uiChanged });
    console.log(JSON.stringify({ ...report, shouldDeploy }));
    return;
  }
  const result = command === 'prepare-ui' ? await prepareUiOnly(repo, subject) : await verifyUiOnly(repo, subject);
  if (command === 'verify-ui') await writeGithubOutput({ verified: result.verified });
  console.log(JSON.stringify(result));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
