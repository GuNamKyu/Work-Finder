import assert from 'node:assert/strict';
import test from 'node:test';
import { areaFromText, resolveLocation } from './locations.js';
import type { JobPosting } from './types.js';

const base = (o: Partial<JobPosting>): JobPosting => ({ title: '채용 공고', organization: '', regDate: '2026-10-01', deadlineDate: null, url: null, ...o });

test('기관명이 조사표와 맞으면 소재지를 주소와 함께 돌려준다', () => {
  const l = resolveLocation(base({ organization: '국립고궁박물관' }), 'gogung');
  assert.equal(l.status, 'known');
  assert.match(l.text, /서울 종로구 효자로 12/);
  assert.ok(l.sourceUrl && l.checkedAt);
});

test('원문 지역(region)이 있으면 근무지역으로 먼저 보여 주고 기관 소재지를 덧붙인다', () => {
  const l = resolveLocation(base({ organization: '송파책박물관', region: '서울특별시 송파구' }), '1365-volunteer');
  assert.equal(l.workAreaBasis, 'posting_region');
  assert.match(l.text, /근무지역 서울특별시 송파구\(원문 표기\)/);
});

test('조사표에 없는 기관은 제목 머리말·기관명의 지역을 쓰고 아니면 미확인', () => {
  assert.equal(resolveLocation(base({ title: '[수원시] 능실유치원 채용', organization: '경기도교육청' }), 'job-gg').workArea, '수원시');
  assert.equal(resolveLocation(base({ organization: '경기도 안산시' }), 'gojobs').workArea, '경기도 안산시');
  const none = resolveLocation(base({ organization: '모르는회사' }), 'work24-youth');
  assert.equal(none.status, 'unknown');
  assert.match(none.text, /미확인/);
});

test('시 단위만 추정한 기관은 미검증으로 표시한다', () => {
  const l = resolveLocation(base({ organization: '국립경주박물관' }), 'museum-go-kr');
  assert.equal(l.status, 'partial');
  assert.match(l.text, /미검증/);
});

test('게시처 기준 지역(서울특별시 게시판)과 areaFromText', () => {
  assert.equal(resolveLocation(base({ organization: '지하안전과' }), 'seoul').workAreaBasis, 'board');
  assert.equal(areaFromText('경찰청 경기도남부경찰청'), '경기도');
  assert.equal(areaFromText('아무 곳'), null);
});
