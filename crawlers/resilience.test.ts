import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcileResults } from './resilience.js';
import { analyzeSources } from './diff.js';
import { flattenResults, isActive } from '../web/model.js';
import type { CrawlResult, JobPosting } from './types.js';

const now = new Date('2026-09-28T07:00:00Z');
const p: JobPosting = { title: '박물관 학예 보조 모집', organization: '박물관', regDate: '2026-09-21', deadlineDate: '2026-10-05', url: 'https://example.org/1' };
const source = (postings: JobPosting[], error?: string): CrawlResult => ({ site: { id: 'museum', name: '박물관', url: 'https://example.org' }, postings, crawledAt: '2026-09-28T01:00:00Z', error });
const good = source([p]);

test('연속 수집 실패에도 마지막 성공값과 원래 확인시각 유지, 오류 은폐 없음', () => {
  const first = reconcileResults([source([], 'timeout')], [good], [], now);
  const second = reconcileResults([source([], 'timeout again')], first.results, first.cache, now);
  const r = second.results[0];
  assert.equal(r.error, 'timeout again');
  assert.equal(r.observedCount, 0); assert.equal(r.retainedCount, 1);
  assert.equal(r.postings[0].verificationStatus, 'retained');
  assert.equal(r.postings[0].lastConfirmedAt, good.crawledAt);
  assert.equal(flattenResults(second.results).length, 1);
  const h = analyzeSources(second.results, first.results)[0];
  assert.equal(h.status, 'ERROR'); assert.equal(h.currentCount, 0); assert.equal(h.retainedCount, 1);
});

test('부분 성공은 현재 자료 우선, 나머지만 보존하고 부분 실패 경보', () => {
  const old = source([p, { ...p, title: '박물관 기록관리 보조 모집', url: 'https://example.org/2' }]);
  const merged = reconcileResults([source([{ ...p, deadlineDate: '2026-10-10' }], '경기 실패')], [old], [], now);
  assert.equal(merged.results[0].postings.length, 2);
  assert.equal(merged.results[0].postings[0].deadlineDate, '2026-10-10');
  assert.equal(merged.results[0].postings[0].verificationStatus, 'current');
  assert.equal(merged.results[0].retainedCount, 1);
  assert.equal(analyzeSources(merged.results, [old])[0].status, 'PARTIAL');
  const later = reconcileResults([source([], 'all failed')], merged.results, merged.cache, now);
  assert.equal(later.results[0].postings[0].deadlineDate, '2026-10-10');
});

test('정상 0건은 과거 결과로 덮어쓰지 않고 마지막 정상 상태 갱신', () => {
  const merged = reconcileResults([source([])], [good], [], now);
  assert.equal(merged.results[0].postings.length, 0);
  assert.equal(merged.cache[0].postings.length, 0);
  assert.equal(analyzeSources(merged.results, [good])[0].status, 'ZERO_ANOMALY');
});

test('보존 시에도 제외어·지원 불가 관문 유지하고 확정 마감은 노출 안 함', () => {
  const excluded = { ...p, title: '박물관 상임이사 학예본부장 모집' };
  const closed = { ...p, url: 'https://example.org/closed', deadlineDate: '2026-09-27' };
  const merged = reconcileResults([source([], 'timeout')], [source([p, excluded, closed])], [], now);
  assert.equal(merged.results[0].postings.length, 2);
  assert.equal(merged.results[0].postings.filter(x => isActive(x, '2026-09-28')).length, 1);
});

test('날짜 없는 보존 공고는 7일 지나면 기본 목록 제외, 검토 보기와 이력은 유지', () => {
  const undated = { ...p, deadlineDate: null, verificationStatus: 'retained' as const, lastConfirmedAt: '2026-09-19T00:00:00Z' };
  assert.equal(isActive(undated, '2026-09-28'), false);
  assert.equal(isActive(undated, '2026-09-28', true), true);
  assert.equal(isActive({ ...undated, deadlineDate: '2026-10-05' }, '2026-09-28'), true);
  assert.equal(isActive({ ...undated, deadlineDate: '2026-09-27' }, '2026-09-28', true), false);
});

test('대상 한 소스만 실행해도 다른 소스 기록을 지우지 않음', () => {
  const other = { ...good, site: { ...good.site, id: 'other' } };
  assert.equal(reconcileResults([source([])], [good, other], [], now).results.length, 2);
});

test('본문 날짜 수집 실패 시 이전 확정 일정을 경고와 함께 보존, 명시적 연장은 최신값 우선', () => {
  const missing = reconcileResults([source([{ ...p, deadlineDate: null, detailStatus: 'failed' }])], [good], [], now).results[0].postings[0];
  assert.equal(missing.deadlineDate, p.deadlineDate); assert.equal(missing.retainedSchedule, true);
  const extended = reconcileResults([source([{ ...p, deadlineDate: '2026-10-15' }])], [good], [], now).results[0].postings[0];
  assert.equal(extended.deadlineDate, '2026-10-15'); assert.equal(extended.retainedSchedule, false);
});

test('첫 실행 부분 성공을 전체 성공 시각으로 바꾸지 않음', () => {
  const first = reconcileResults([source([p], '일부 실패')], [], [], now);
  const next = reconcileResults([source([], '전체 실패')], first.results, first.cache, now);
  assert.equal(next.results[0].lastSuccessfulAt, null);
  assert.equal(next.results[0].retainedCount, 1);
});

test('부분 수집에서 확인한 종료 공고는 이전 모집중 사본으로 되살리지 않음', () => {
  const closed = { ...p, deadlineDate: '2026-09-27' };
  const first = reconcileResults([source([closed], '다음 페이지 실패')], [good], [], now);
  assert.equal(first.results[0].retainedCount, 0);
  assert.equal(isActive(first.results[0].postings[0], '2026-09-28'), false);
  const next = reconcileResults([source([], '전체 실패')], first.results, first.cache, now);
  assert.equal(isActive(next.results[0].postings[0], '2026-09-28'), false);
});
