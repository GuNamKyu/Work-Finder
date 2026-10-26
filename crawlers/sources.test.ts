import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-ignore 저장소 스크립트(JS) — workfinder 스킬과 같은 AST 기반 수집 대상 목록
import { discover } from '../scripts/inventory.mjs';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const excluded = JSON.parse(await readFile(join(repo, 'excluded-sources.json'), 'utf8')).sources as any[];
const inventory = await discover(repo, false);
const decode = (u: string) => u.replaceAll('&amp;', '&').trim();

test('excluded-sources entries carry status and reason', () => {
  assert.equal(new Set(excluded.map(s => s.id)).size, excluded.length, 'duplicate excluded id');
  for (const s of excluded) {
    assert.ok(s.id && s.name && /^https?:\/\//.test(s.url), `incomplete entry: ${s.id}`);
    assert.ok(['excluded', 'held'].includes(s.status), `invalid status: ${s.id}`);
    assert.ok(typeof s.reason === 'string' && s.reason.trim(), `missing reason: ${s.id}`);
    assert.match(s.decidedAt, /^\d{4}-\d{2}-\d{2}$/, `missing decidedAt: ${s.id}`);
  }
});

test('excluded or held sources are not registered or listed in url.txt', async () => {
  const active = new Set(inventory.sources.map((s: any) => s.id));
  const activeUrls = new Set(inventory.sources.map((s: any) => decode(s.url)));
  const urlFile = new Set((await readFile(join(repo, 'url.txt'), 'utf8')).split(/\r?\n/).filter(Boolean).map(decode));
  for (const s of excluded) {
    assert.ok(!active.has(s.id), `excluded source still registered: ${s.id}`);
    assert.ok(!activeUrls.has(decode(s.url)), `excluded URL still registered: ${s.id}`);
    assert.ok(!urlFile.has(decode(s.url)), `excluded URL still in url.txt: ${s.id}`);
  }
});

test('aggregators that cover excluded sources stay active', () => {
  const active = new Set(inventory.sources.map((s: any) => s.id));
  for (const s of excluded) for (const id of s.coveredBy || []) {
    assert.ok(active.has(id), `${s.id} is covered by inactive source ${id}`);
  }
});
