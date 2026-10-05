import assert from 'node:assert/strict';
import test from 'node:test';
import { passesExclusions } from './base.js';
import type { JobPosting } from './types.js';
import type { LearnedRule } from '../web/exclusions.js';
const p: JobPosting = { title: '박물관 특수장비검사관 모집', organization: '테스트박물관', regDate: '2026-09-20', deadlineDate: null, url: null };
const rules: LearnedRule[] = [{ keyword: '특수장비검사관', postingType: 'job', experienceType: null, count: 3, examples: ['특수장비검사관 1차', '특수장비검사관 2차', '특수장비검사관 3차'] }];
test('박물관 항목은 수동 및 학습 제외어보다 우선 수집한다', () => {
  assert.equal(passesExclusions(p, 'job', []), true);
  assert.equal(passesExclusions(p, 'job', rules), true);
  assert.equal(passesExclusions({ ...p, title: '장애인 제한 채용', organization: '국립농업박물관' }, 'job', []), true);
  assert.equal(passesExclusions({ ...p, title: '박물관 기간제교사 미술 모집', organization: '일반 기관' }, 'job', []), true);
  assert.equal(passesExclusions({ ...p, title: '특수장비검사관 모집', organization: '일반 기관', roleText: '박물관 전시 지원 업무' }, 'job', rules), true);
  assert.equal(passesExclusions({ ...p, postingType: 'experience', experienceType: 'internship' }, 'experience', rules), true);
});

test('뮤지엄 기관은 기관명 노이즈어와 무관하게 박물관 경험으로 수집한다', () => {
  const posting: JobPosting = {
    title: '인당뮤지엄 전시 자원봉사자 모집',
    organization: '대구보건대학교 인당뮤지엄',
    regDate: '2026-10-02',
    deadlineDate: null,
    url: null,
    postingType: 'experience',
    experienceType: 'volunteer',
  };
  assert.equal(passesExclusions(posting, 'experience', rules), true);
  assert.equal(passesExclusions({ ...posting, title: '보건소 자원봉사 모집', organization: '대구보건대학교' }, 'experience', rules), false);
});
test('박물관 키워드가 없는 공고에는 기존 수동·학습 제외어를 적용한다', () => {
  assert.equal(passesExclusions({ ...p, title: '기간제교사 미술 모집', organization: '일반 기관' }, 'job', []), false);
  assert.equal(passesExclusions({ ...p, title: '특수장비검사관 채용', organization: '일반 기관' }, 'job', rules), false);
  assert.equal(passesExclusions({ ...p, title: '장애인 제한 채용', organization: '일반 기관' }, 'job', []), true);
});
