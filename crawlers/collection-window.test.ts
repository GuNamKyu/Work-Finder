import assert from 'node:assert/strict';
import test from 'node:test';
import { isWithinCollectionWindow, reconcileResults } from './resilience.js';
import type { CrawlResult, JobPosting } from './types.js';

// 2026-10-27 16:00 KST
const now = new Date('2026-10-27T07:00:00Z');
const p = (extra: Partial<JobPosting>): JobPosting => ({ title: '박물관 학예 보조 모집', organization: '박물관', regDate: '', deadlineDate: null, url: 'https://example.org/1', ...extra });
const source = (postings: JobPosting[], error?: string): CrawlResult => ({ site: { id: 'museum', name: '박물관', url: 'https://example.org' }, postings, crawledAt: '2026-10-27T06:00:00Z', error });

test('등록일이 한 달을 넘었거나 접수 마감이 지난 공고는 수집 기간 밖', () => {
  assert.equal(isWithinCollectionWindow(p({ regDate: '2026-09-27' }), now), true);
  assert.equal(isWithinCollectionWindow(p({ regDate: '2026-09-26' }), now), false);
  assert.equal(isWithinCollectionWindow(p({ regDate: '2024-08-21' }), now), false);
  // 오늘 마감은 아직 접수 중, 어제 마감은 제외
  assert.equal(isWithinCollectionWindow(p({ regDate: '2026-10-20', deadlineDate: '2026-10-27' }), now), true);
  assert.equal(isWithinCollectionWindow(p({ regDate: '2026-10-20', deadlineDate: '2026-10-26' }), now), false);
  assert.equal(isWithinCollectionWindow(p({ applicationEndAt: '2026-10-26' }), now), false);
  // 날짜가 없는 사업 안내는 이 규칙으로 빼지 않는다
  assert.equal(isWithinCollectionWindow(p({}), now), true);
});

test('reconcile은 기간 밖 공고를 현재·보존·미시도 소스 모두에서 뺀다', () => {
  const fresh = p({ regDate: '2026-10-20', url: 'https://example.org/new' });
  const old = p({ title: '2024년 임기제공무원 채용', regDate: '2024-08-21', url: 'https://example.org/old' });
  const closed = p({ title: '접수 끝난 공고', regDate: '2026-10-10', deadlineDate: '2026-10-20', url: 'https://example.org/closed' });
  const merged = reconcileResults([source([fresh, old, closed])], [], [], now);
  assert.deepEqual(merged.results[0].postings.map(x => x.title), [fresh.title]);
  const retained = reconcileResults([source([], 'timeout')], [source([fresh, old])], [], now);
  assert.deepEqual(retained.results[0].postings.map(x => x.title), [fresh.title]);
  const other = { ...source([fresh, old]), site: { id: 'other', name: '다른 기관', url: 'https://example.com' } };
  const untouched = reconcileResults([source([fresh])], [other], [], now);
  assert.deepEqual(untouched.results.find(r => r.site.id === 'other')!.postings.map(x => x.title), [fresh.title]);
});

test('URL 형식만 바뀐 같은 공고는 이번에 본 것만 남긴다', () => {
  const before = p({ regDate: '2026-10-20', url: 'https://example.org/view?uid=7044&kboard=1' });
  const now2 = p({ regDate: '2026-10-20', url: 'https://example.org/view?idx=7044' });
  const merged = reconcileResults([source([now2], '2페이지 미확인')], [source([before])], [], now);
  assert.deepEqual(merged.results[0].postings.map(x => x.url), [now2.url]);
});
