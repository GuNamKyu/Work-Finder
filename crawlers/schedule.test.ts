import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePeriod, extractSchedule } from './schedule.js';
import { enrichPosting } from './opportunity.js';
import { filterJobPostings } from './base.js';
import { deduplicateResults } from './deduplicate.js';

test('연도·월 생략, 고용24 단축 연도, 잘못된 날짜', () => {
  assert.deepEqual(parsePeriod('26-09-22 ~ 26-10-01'), ['2026-09-22', '2026-10-01']);
  assert.deepEqual(parsePeriod('2026.09.22.(화) ~ 10.01.(목)'), ['2026-09-22', '2026-10-01']);
  assert.deepEqual(parsePeriod('2026-12-20 ~ 27-01-05'), ['2026-12-20', '2027-01-05']);
  assert.deepEqual(parsePeriod('2026-02-30 ~ 2026-03-01'), [null, '2026-03-01']);
  assert.deepEqual(parsePeriod('9월 ~ 10월'), [null, null]);
});
test('사업 운영기간은 접수기간으로 쓰지 않음', () => {
  assert.equal(extractSchedule('사업기간: 2026.03.01 ~ 2027.02.28').applicationEndAt, null);
  assert.equal(extractSchedule('접수기간: 2026.09.01 ~ 2026.10.03').applicationEndAt, '2026-10-03');
});
const base = { title: '박물관 인턴', organization: '문화재단', regDate: '2026-09-01', deadlineDate: '2026-10-03', url: null };
test('등록일을 접수 시작일로 추정하지 않음', () => {
  const p = enrichPosting(base, 'test', new Date('2026-09-27T00:00:00+09:00'));
  assert.equal(p.applicationStartAt, null);
  assert.ok(!p.scheduleEvents?.some(e => e.type === 'application_start'));
});
test('마감 D-day 제목은 종료로 오인하지 않고 KST 오늘 마감은 유지', () => {
  const p = enrichPosting({ ...base, title: '박물관 인턴 마감 D-day', deadlineDate: '2026-09-27' }, 'test', new Date('2026-09-27T23:50:00+09:00'));
  assert.notEqual(p.lifecycleStatus, 'closed');
});
test('직무경험에도 제외어 우선, 범용 제조업 인턴은 추천하지 않음', () => {
  assert.equal(filterJobPostings([{ ...base, title: '기간제교사 미술 일경험', postingType: 'experience' }]).length, 0);
  assert.equal(enrichPosting({ ...base, title: '제조업 일경험', organization: '기업', roleText: '생산', region: '대구', postingType: 'experience' }, 'test').userVisible, false);
  assert.equal(enrichPosting({ ...base, title: '사무 일경험', organization: '기업', roleText: '경영·사무', region: '서울', postingType: 'experience' }, 'test').relevanceTier, 'adjacent');
});

test('기관·회차가 다른 유사 공고는 삭제하지 않고 같은 ID만 중복 처리', () => {
  const results = [{ site: { id: 'x', name: 'x', url: 'https://example.org' }, crawledAt: '2026-09-27', postings: [
    { ...base, organization: '가 연구원', postingId: '1' },
    { ...base, organization: '나 연구원', postingId: '2' },
    { ...base, organization: '가 연구원', postingId: '3' },
    { ...base, organization: '가 연구원', postingId: '1' },
  ] }];
  assert.equal(deduplicateResults(results), 1);
  assert.equal(results[0].postings.length, 3);
});
