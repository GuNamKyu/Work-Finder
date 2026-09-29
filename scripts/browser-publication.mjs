import { readFile, writeFile, mkdir, copyFile, cp, readdir, lstat } from 'node:fs/promises';
import { resolve, join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discover, hash } from './inventory.mjs';

const webFiles = ['index.html', 'app.css', 'app.js', 'model.js', 'exclusions.js', 'results.json', 'experience-results.json', 'new-postings.json', 'source-health.json', 'learned-exclusions.json'];
const runtimeFiles = ['crawlers/results.json', 'crawlers/experience-results.json', 'crawlers/results.last-good.json', 'crawlers/experience-results.last-good.json', 'crawlers/new-postings.json', 'crawlers/source-health.json', 'crawlers/opportunity-events.json', 'crawlers/notification-summary.json', 'data/opportunity-state.json', 'data/program-series.json'];
const assert = (ok, message) => { if (!ok) throw new Error(message); };
async function walk(path, prefix = '') {
  const files = [];
  for (const name of await readdir(path)) {
    const sub = join(path, name), rel = prefix ? `${prefix}/${name}` : name;
    const stat = await lstat(sub);
    assert(!stat.isSymbolicLink(), 'Publication cannot contain symlinks');
    if (stat.isDirectory()) files.push(...await walk(sub, rel));
    else if (stat.isFile()) files.push(rel);
    else throw new Error(`Unsupported publication entry: ${rel}`);
  }
  return files;
}
async function parse(path) { return JSON.parse(await readFile(path, 'utf8')); }

export async function seal(repo, output, runId) {
  repo = resolve(repo); output = resolve(output);
  assert(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(runId), 'Invalid collection ID');
  const auditRoot = join(repo, 'data', 'browser-collection', runId);
  const audit = await parse(join(auditRoot, 'audit.json'));
  const observations = await parse(join(auditRoot, 'observations.json'));
  const inventory = await discover(repo, false);
  assert(audit.runId === runId && observations.runId === runId && observations.inventoryFingerprint === inventory.fingerprint, 'Collection audit/policy mismatch');
  // A seal is a new immutable snapshot, not an overwrite of a prior review.
  await mkdir(output);
  for (const name of webFiles) {
    await mkdir(join(output, 'web'), { recursive: true });
    await copyFile(join(repo, 'web', name), join(output, 'web', name));
  }
  for (const name of runtimeFiles) {
    const destination = join(output, 'runtime', name);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(join(repo, name), destination);
  }
  await cp(join(repo, 'data/history'), join(output, 'runtime/data/history'), { recursive: true, errorOnExist: true, force: false });
  await cp(auditRoot, join(output, 'collection'), { recursive: true, errorOnExist: true, force: false });
  const files = {};
  for (const path of await walk(output)) files[path] = hash(await readFile(join(output, path)));
  const manifest = { schemaVersion: 1, runId, sealedAt: new Date().toISOString(), finishedAt: observations.finishedAt, inventoryFingerprint: inventory.fingerprint, files };
  await writeFile(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  await verify(repo, output);
  return manifest;
}

export async function verify(repo, folder, now = new Date()) {
  repo = resolve(repo); folder = resolve(folder);
  const manifest = await parse(join(folder, 'manifest.json'));
  assert(manifest.schemaVersion === 1 && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(manifest.runId), 'Invalid manifest');
  const age = now.getTime() - Date.parse(manifest.finishedAt);
  assert(Number.isFinite(age) && age >= -300000 && age <= 36 * 3600000, 'Collection stale/future: recheck and reseal');
  assert(manifest.inventoryFingerprint === (await discover(repo, false)).fingerprint, 'Source/exclusion/policy changed after review');
  assert(manifest.files && typeof manifest.files === 'object', 'Missing file manifest');
  const actual = (await walk(folder)).filter(p => p !== 'manifest.json').sort();
  assert(JSON.stringify(actual) === JSON.stringify(Object.keys(manifest.files).sort()), 'Publication file set changed');
  for (const path of actual) {
    assert(!path.includes('..') && !relative(folder, resolve(folder, path)).startsWith('..'), 'Unsafe snapshot path');
    assert(hash(await readFile(join(folder, path))) === manifest.files[path], `Changed snapshot file: ${path}`);
  }
  for (const name of webFiles) assert(manifest.files[`web/${name}`], `Missing web file: ${name}`);
  for (const name of webFiles.filter(n => !n.endsWith('.json'))) {
    assert(hash(await readFile(join(repo, 'web', name))) === manifest.files[`web/${name}`], `Website code changed after review: ${name}`);
  }
  assert(hash(await readFile(join(repo, 'data/learned-exclusions.json'))) === manifest.files['web/learned-exclusions.json'], 'Prepared learned exclusions are out of date');
  for (const name of runtimeFiles) assert(manifest.files[`runtime/${name}`], `Missing runtime file: ${name}`);
  const audit = await parse(join(folder, 'collection/audit.json'));
  const observations = await parse(join(folder, 'collection/observations.json'));
  assert(audit.runId === manifest.runId && observations.runId === manifest.runId && observations.inventoryFingerprint === manifest.inventoryFingerprint, 'Audit identity mismatch');
  for (const name of ['results.json', 'experience-results.json', 'new-postings.json', 'source-health.json']) {
    assert(manifest.files[`web/${name}`] === manifest.files[`runtime/crawlers/${name}`], `Web/runtime data differ: ${name}`);
    assert(Array.isArray(await parse(join(folder, 'web', name))), `Invalid web JSON: ${name}`);
  }
  return manifest;
}

export function ensureNotSuperseded(manifest, publicResults) {
  assert(Array.isArray(publicResults), 'Invalid public collection JSON');
  for (const result of publicResults) {
    assert(result?.site?.id && Number.isFinite(Date.parse(result.crawledAt)), 'Invalid public source timestamp');
    assert(Date.parse(result.crawledAt) <= Date.parse(manifest.finishedAt), `Newer public collection exists: ${result.site.id}; rebase and recheck before publishing`);
  }
}

export async function checkPublic(manifest) {
  for (const name of ['results.json', 'experience-results.json']) {
    const response = await fetch(`https://gunamkyu.github.io/Work-Finder/${name}?browserReview=${encodeURIComponent(manifest.runId)}`, { cache: 'no-store', signal: AbortSignal.timeout(20000) });
    assert(response.ok, `Cannot verify live baseline: HTTP ${response.status}`);
    ensureNotSuperseded(manifest, await response.json());
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, repo, folder, runId] = process.argv.slice(2);
  assert(repo && folder && ['seal', 'verify'].includes(mode), 'Usage: node publication.mjs seal <repo> <new-folder> <runId> | verify <repo> <folder>');
  const result = mode === 'seal' ? await seal(repo, folder, runId) : await verify(repo, folder);
  if (mode === 'verify' && runId === '--check-public') await checkPublic(result);
  else if (mode === 'verify') assert(!runId, 'Unknown verify option');
  console.log(JSON.stringify({ runId: result.runId, files: Object.keys(result.files).length, folder: resolve(folder), verified: true }));
}
