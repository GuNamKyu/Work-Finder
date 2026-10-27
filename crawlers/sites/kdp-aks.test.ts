import assert from 'node:assert/strict';
import test from 'node:test';
import { deadlineFromTitle } from './kdp-aks.js';

test('한국학자료통합플랫폼 제목 끝 "(11.6 금)"을 접수 마감일로 읽는다', () => {
  assert.equal(deadlineFromTitle('[서울공예박물관] 기간제노동자(전시기획 및 운영지원) 채용공고(11.6 금)', '2026-10-27'), '2026-11-06');
  assert.equal(deadlineFromTitle('[서대문자연사박물관] 일반임기제공무원(학예연구분야) 채용 공고(11.5. 목)', '2026-10-23'), '2026-11-05');
  assert.equal(deadlineFromTitle('[한국개발연구원 KDI] 위촉직원 채용 공고(연구직)(11.6 금)', '2026-10-26'), '2026-11-06');
  // 연말 등록, 다음 해 1월 마감
  assert.equal(deadlineFromTitle('[기관] 연구원 채용(1.8 목)', '2026-12-28'), '2027-01-08');
  // 괄호가 제목 끝이 아니거나 요일이 없으면 마감일로 보지 않는다
  assert.equal(deadlineFromTitle('[기관] 2026년(10.30) 채용 공고', '2026-10-27'), null);
  assert.equal(deadlineFromTitle('[기관] 채용 공고(11.6 금)', ''), null);
});
