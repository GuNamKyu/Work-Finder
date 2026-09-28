import assert from 'node:assert/strict';
import test from 'node:test';
import { passesExclusions } from './base.js';
import type { JobPosting } from './types.js';
import type { LearnedRule } from '../web/exclusions.js';
const p: JobPosting = { title: '박물관 특수장비검사관 모집', organization: '테스트박물관', regDate: '2026-09-20', deadlineDate: null, url: null };
const rules: LearnedRule[] = [{ keyword: '특수장비검사관', postingType: 'job', experienceType: null, count: 3, examples: ['특수장비검사관 1차', '특수장비검사관 2차', '특수장비검사관 3차'] }];
test('수집 관문은 점수 계산 전에 학습 제외어를 적용한다', () => {
  assert.equal(passesExclusions(p, 'job', []), true);
  assert.equal(passesExclusions(p, 'job', rules), false);
  assert.equal(passesExclusions({ ...p, postingType: 'experience', experienceType: 'internship' }, 'experience', rules), true);
});
test('학습 규칙 유무와 무관하게 수동 제외 파일이 최우선이다', () => {
  assert.equal(passesExclusions({ ...p, title: '박물관 기간제교사 미술 모집' }, 'job', []), false);
});
