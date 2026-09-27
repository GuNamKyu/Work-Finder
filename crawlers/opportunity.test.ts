import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyLifecycle, enrichPosting, stablePostingId } from './opportunity.js';
import type { JobPosting } from './types.js';

const base: JobPosting = {
  title: '박물관 학예 보조 모집', organization: '테스트박물관', regDate: '2026-01-01',
  deadlineDate: null, url: 'https://example.com/view?id=10&utm_source=test',
};

test('같은 상세 URL은 추적 파라미터와 무관하게 같은 ID를 만든다', () => {
  const a = stablePostingId('museum', base);
  const b = stablePostingId('museum', { ...base, url: 'https://example.com/view?id=10&utm_campaign=other' });
  assert.equal(a, b);
});

test('오래됐지만 미래 마감일이 있으면 장기 모집으로 보존한다', () => {
  const status = classifyLifecycle({ ...base, deadlineDate: '2026-12-31' }, new Date('2026-09-27T00:00:00+09:00'));
  assert.equal(status, 'active_long');
});

test('마감일이 없는 오래된 공고는 삭제 대신 상태로 구분한다', () => {
  const status = classifyLifecycle(base, new Date('2026-09-27T00:00:00+09:00'));
  assert.equal(status, 'stale_unknown');
});

test('일정과 적합도·긴급도를 파생한다', () => {
  const posting = enrichPosting({ ...base, regDate: '2026-09-20', deadlineDate: '2026-09-30' }, 'museum', new Date('2026-09-27T00:00:00+09:00'));
  assert.ok(posting.scheduleEvents?.some(event => event.type === 'application_end'));
  assert.ok((posting.fitScore || 0) > 0);
  assert.equal(posting.urgencyScore, 90);
});
