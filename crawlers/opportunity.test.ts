import assert from 'node:assert/strict';
import test from 'node:test';
import { assessEligibility, classifyLifecycle, enrichPosting, stablePostingId } from './opportunity.js';
import { filterJobPostings } from './base.js';
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

test('학교 기간제교사는 제외 키워드 1차 관문에서 제거한다', () => {
  const postings = filterJobPostings([{
    ...base, title: '기간제교사(미술) 채용 공고', organization: '테스트고등학교',
  }], 'school');
  assert.equal(postings.length, 0);
});

test('긍정 분야명이 함께 있어도 제외 키워드를 우선한다', () => {
  const postings = filterJobPostings([{
    ...base, title: '미술관 교육강사 모집', organization: '테스트미술관',
  }], 'museum');
  assert.equal(postings.length, 0);
});

test('문화기관의 비대상 직무와 전형 후속 공지는 화면에서 제외한다', () => {
  const cleaner = enrichPosting({ ...base, title: '박물관 환경미화원 채용' }, 'museum');
  const result = enrichPosting({ ...base, title: '박물관 학예직 최종 합격자 발표' }, 'museum');
  assert.equal(cleaner.relevanceTier, 'low_relevance');
  assert.equal(cleaner.userVisible, false);
  assert.equal(result.relevanceTier, 'administrative_notice');
  assert.equal(result.userVisible, false);
});

test('제외 키워드는 박물관·학예 적합도보다 먼저 적용한다', () => {
  const filtered = filterJobPostings([{
    ...base,
    title: '[국립항공박물관] 상임이사(학예본부장) 모집공고',
    organization: '국립항공박물관',
  }], 'museum');
  assert.equal(filtered.length, 0);
});

test('임원급과 고경력 필수요건은 지원 가능성에서 별도로 탈락시킨다', () => {
  assert.equal(assessEligibility({ ...base, title: '상임이사 모집' }).status, 'ineligible');
  assert.equal(assessEligibility({ ...base, title: '학예직 경력 3년 이상 채용' }).status, 'needs_review');
  assert.equal(assessEligibility({ ...base, title: '학예 보조 신입 채용' }).status, 'likely_eligible');
});
