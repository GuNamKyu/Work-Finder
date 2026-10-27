import test from 'node:test';
import assert from 'node:assert/strict';
import { isSamePosting, dropSecondaryDuplicates, actualOrganization } from './secondary-sources.js';
import { reconcileResults } from './resilience.js';
import type { CrawlResult, JobPosting } from './types.js';

const p = (title: string, organization: string, regDate = '2026-10-20', extra: Partial<JobPosting> = {}): JobPosting =>
  ({ title, organization, regDate, deadlineDate: null, url: null, ...extra });
const site = (id: string) => ({ id, name: id, url: `https://example.com/${id}` });

// 2026-10-27 사람인 '직업 박물관' 검색에서 실제로 겹친 공고들
test('portal copies match the original board despite group suffix and title variants', () => {
  assert.ok(isSamePosting(
    p('2026년 제6차 직원 채용(일반직 4급/5급 - 학예)', '국립농업박물관 농림축산식품부그룹', '2026-10-24'),
    p('국립농업박물관 2026년 제6차 직원 채용(일반직 5급 - 학예)', '국립농업박물관', '2026-10-21')));
});

test('an original without date fields falls back to the application period in its title', () => {
  // namuk 크롤러는 regDate를 비우고 접수기간을 제목에 남긴다
  assert.ok(isSamePosting(
    p('2026년 제6차 직원 채용(일반운영직 - 방호)', '국립농업박물관 농림축산식품부그룹', '2026-10-24'),
    p('접수전국립농업박물관 2026년 제6차 직원 채용(일반운영직 - 방호)D-82026.10.27 ~ 2026.11.03 17:00', '국립농업박물관', '')));
});

test('agency postings use the bracketed institution as the organization', () => {
  const copy = p('[국립한글박물관] 한시임기제6호 (학예일반/ 전시기획) 채용공고', '(주)커리어넷 파견·도급·대행', '2026-10-22');
  assert.equal(actualOrganization(copy), '국립한글박물관');
  assert.ok(isSamePosting(copy, p('국립한글박물관 한시임기제공무원 채용 공고', '국립한글박물관', '2026-10-19')));
});

test('different jobs of the same institution and other institutions stay separate', () => {
  // 같은 차수라도 괄호 안 직무가 다르면 다른 공고
  assert.ok(!isSamePosting(
    p('2026년 제6차 직원 채용(일반운영직 - 방호)', '국립농업박물관 농림축산식품부그룹'),
    p('국립농업박물관 2026년 제6차 직원 채용(일반운영직 상당 기간제 직원 - 전시운영)', '국립농업박물관')));
  assert.ok(!isSamePosting(
    p('2026년 제6차 직원 채용(일반운영직 - 방호)', '국립농업박물관 농림축산식품부그룹'),
    p('국립농업박물관 2026년 제6차 직원 채용(일반직 5급 - 학예)', '국립농업박물관')));
  assert.ok(!isSamePosting(p('갤러리문 큐레이터 채용 공고', '갤러리문'), p('서울공예박물관 큐레이터 채용', '서울공예박물관')));
});

test('same title far apart in time is a new round, not a copy', () => {
  assert.ok(!isSamePosting(
    p('국립한글박물관 한시임기제공무원 채용 공고', '국립한글박물관', '2026-10-19'),
    p('국립한글박물관 한시임기제공무원 채용 공고', '국립한글박물관', '2026-03-02')));
});

test('missing dates, generic titles and short region names never count as duplicates', () => {
  // 날짜 없는 포털 공고 vs 작년 공고: 연도를 지운 제목이 같아도 제외하지 않음
  assert.ok(!isSamePosting(p('경기도박물관 교육강사 모집', '경기도박물관', ''), p('2025년 경기도박물관 교육강사 모집', '경기도박물관', '2025-02-10')));
  // 핵심어가 '직원'뿐인 제목
  assert.ok(!isSamePosting(p('제3회 직원 채용 공고', '안산문화재단', '2026-10-20'), p('2026년 제2회 직원 채용', '안산문화재단', '2026-10-18')));
  // 짧은 지역명은 다른 기관명에 부분 일치하지 않음
  assert.ok(!isSamePosting(p('간호사 기간제 채용 모집 공고', '경기도', '2026-10-20'), p('간호사 기간제 채용 모집 공고', '경기도의료원', '2026-10-20')));
});

test('only the secondary source loses duplicates and the removal is recorded', () => {
  const results: CrawlResult[] = [
    { site: site('hangeul'), crawledAt: '2026-10-27T00:00:00Z', postings: [p('국립한글박물관 한시임기제공무원 채용 공고', '국립한글박물관', '2026-10-19')] },
    { site: site('saramin'), crawledAt: '2026-10-27T00:00:00Z', postings: [
      p('[국립한글박물관] 한시임기제6호 (학예일반/ 전시기획) 채용공고', '(주)커리어넷 파견·도급·대행', '2026-10-22'),
      p('갤러리문 큐레이터 채용 공고', '갤러리문', '2026-10-22'),
    ] },
  ];
  const out = dropSecondaryDuplicates(results);
  assert.equal(out[0].postings.length, 1);
  assert.deepEqual(out[1].postings.map(x => x.title), ['갤러리문 큐레이터 채용 공고']);
  assert.equal(out[1].secondaryDuplicates?.[0].matchedSiteId, 'hangeul');
});

test('retained original postings still suppress the portal copy when the original source fails', () => {
  const now = new Date('2026-10-27T03:00:00Z');
  const original = { site: site('hangeul'), crawledAt: '2026-10-26T00:00:00Z', lastSuccessfulAt: '2026-10-26T00:00:00Z',
    postings: [p('국립한글박물관 한시임기제공무원 채용 학예 모집', '국립한글박물관', '2026-10-19')] };
  const current: CrawlResult[] = [
    { site: site('hangeul'), crawledAt: '2026-10-27T00:00:00Z', postings: [], error: '접속 실패' },
    { site: site('saramin'), crawledAt: '2026-10-27T00:00:00Z', postings: [p('[국립한글박물관] 한시임기제 학예 채용', '(주)커리어넷 파견·도급·대행', '2026-10-22')] },
  ];
  const { results } = reconcileResults(current, [original], [original], now);
  assert.equal(results.find(r => r.site.id === 'hangeul')!.postings.length, 1);
  assert.equal(results.find(r => r.site.id === 'saramin')!.postings.length, 0);
});
