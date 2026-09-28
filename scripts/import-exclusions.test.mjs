import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, copyFile, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
import { emptyHidden, toggleHiddenRecord, exportRules } from '../web/exclusions.js';

test('가져오기: 검증 후 교체·백업, 오류 시 보존, 빈 파일로 규칙 해제', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'work-finder-exclusions-test-'));
  try {
    for (const name of ['web', 'data', 'scripts']) await mkdir(join(directory, name));
    for (const file of ['scripts/import-exclusions.mjs', 'web/exclusions.js', 'web/model.js']) await copyFile(file, join(directory, file));
    await writeFile(join(directory, 'package.json'), '{"type":"module"}');
    const target = join(directory, 'data/learned-exclusions.json'), input = join(directory, 'input.json');
    const original = JSON.stringify({ version: 1, generatedAt: '', rules: [] }); await writeFile(target, original);
    const state = [1, 2, 3].reduce((s, n) => toggleHiddenRecord(s, { title: `특수장비검사관 ${n}차 모집`, organization: `기관${n}`, stableId: `test-${n}`, siteId: 'test', postingType: 'job' }), emptyHidden());
    await writeFile(input, JSON.stringify(exportRules(state)));
    const run = () => spawnSync(process.execPath, [join(directory, 'scripts/import-exclusions.mjs'), input], { encoding: 'utf8', windowsHide: true });
    assert.equal(run().status, 0);
    assert.equal(JSON.parse(await readFile(target, 'utf8')).rules.length, 1);
    assert.equal(await readFile(`${target}.previous.local`, 'utf8'), original);
    const before = await readFile(target, 'utf8');
    await writeFile(input, '{"version":1,"rules":[{"keyword":"박물관"}]}');
    assert.equal(run().status, 1); assert.equal(await readFile(target, 'utf8'), before);
    await writeFile(input, original); assert.equal(run().status, 0);
    assert.equal(JSON.parse(await readFile(target, 'utf8')).rules.length, 0);
    assert.equal(await readFile(`${target}.previous.local`, 'utf8'), before);
  } finally {
    // Only the exact isolated directory returned by mkdtemp is eligible for removal.
    assert.equal(resolve(directory).startsWith(resolve(tmpdir())), true);
    assert.equal(basename(directory).startsWith('work-finder-exclusions-test-'), true);
    await rm(directory, { recursive: true, force: true });
  }
});
