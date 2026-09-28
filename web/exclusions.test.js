import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyHidden, toggleHiddenRecord, migrateHidden, learnRules, matchesRule, exportRules, validateRules, ruleId } from './exclusions.js';
const posting = (n, extra = {}) => ({ stableId: `hidden-${n}`, siteId: 'test', postingType: 'job', title: `[기관${n}] 특수장비검사관 ${n}차 모집`, organization: `기관${n}`, regDate: `2026-09-${String(n).padStart(2, '0')}`, ...extra });
const three = () => [1, 2, 3].reduce((state, n) => toggleHiddenRecord(state, posting(n)), emptyHidden());
test('유사한 서로 다른 3건을 숨기면 구체적인 문구를 학습한다', () => {
  let state = toggleHiddenRecord(emptyHidden(), posting(1));
  state = toggleHiddenRecord(state, posting(2)); assert.equal(learnRules(state).length, 0);
  state = toggleHiddenRecord(state, posting(3));
  assert.deepEqual(learnRules(state).map(r => [r.keyword, r.count]), [['특수장비검사관', 3]]);
  assert.equal(matchesRule(posting(4), learnRules(state)), true);
});
test('복원 후 재숨김·새로고침·수집 반복은 3건으로 계산하지 않는다', () => {
  let state = emptyHidden();
  for (let i = 0; i < 5; i++) state = toggleHiddenRecord(state, posting(1));
  assert.equal(Object.keys(state.records).length, 1);
  assert.equal(learnRules(migrateHidden(state, [], [posting(1)])).length, 0);
});
test('수집처가 다른 동일 제목·기관·날짜는 한 공고로 센다', () => {
  const state = [1, 2, 3].reduce((s, n) => toggleHiddenRecord(s, posting(n, { siteId: `source${n}`, title: '특수장비검사관 모집', organization: '같은기관', regDate: '2026-09-01' })), emptyHidden());
  assert.equal(learnRules(state).length, 0);
});
test('제목이 같아도 모집일·ID가 다른 별도 공고 3건은 구분한다', () => {
  const state = [1, 2, 3].reduce((s, n) => toggleHiddenRecord(s, posting(n, { title: '특수장비검사관 모집', organization: '같은기관' })), emptyHidden());
  assert.equal(Object.keys(state.records).length, 3);
  assert.equal(learnRules(state)[0].count, 3);
});
test('박물관·인턴·기관명 같은 넓은 반복어는 제외어로 학습하지 않는다', () => {
  const state = [1, 2, 3].reduce((s, n) => toggleHiddenRecord(s, posting(n, { title: `[어떤박물관] 문화유산 박물관 학예 보조 인턴 ${n}차 모집` })), emptyHidden());
  assert.equal(learnRules(state).length, 0);
});
test('3건 근거가 같으면 더 구체적인 공통 문구만 남긴다', () => {
  const state = [1, 2, 3].reduce((s, n) => toggleHiddenRecord(s, posting(n, { title: `특수장비검사관 원격탐사 ${n}차 모집` })), emptyHidden());
  assert.deepEqual(learnRules(state).map(r => r.keyword), ['특수장비검사관 원격탐사']);
});
test('규칙은 채용·경험 세부 유형별로 분리한다', () => {
  const rules = learnRules(three());
  assert.equal(matchesRule(posting(4, { postingType: 'experience', experienceType: 'volunteer' }), rules), false);
  const state = [1, 2, 3].reduce((s, n) => toggleHiddenRecord(s, posting(n, { postingType: 'experience', experienceType: 'internship' })), emptyHidden());
  assert.equal(matchesRule(posting(4, { postingType: 'experience', experienceType: 'project' }), learnRules(state)), false);
  assert.equal(matchesRule(posting(4, { postingType: 'experience', experienceType: 'internship' }), learnRules(state)), true);
});
test('규칙 해제·공고 복원이 학습 및 내보내기에 반영된다', () => {
  const state = three(); state.disabledRules = [ruleId(learnRules(state)[0])];
  assert.equal(matchesRule(posting(4), learnRules(state)), false);
  assert.equal(exportRules(state).rules.length, 0);
  assert.equal(learnRules(toggleHiddenRecord(state, posting(1))).length, 0);
});
test('이전 숨김은 현재 자료로 유형을 확인하고 미연결 기록은 보존한다', () => {
  const state = migrateHidden(emptyHidden(), ['test::[기관1] 특수장비검사관 1차 모집', 'missing::박물관 인턴 모집'], [posting(1)]);
  assert.equal(Object.values(state.records).filter(r => r.posting.postingType === 'job').length, 1);
  assert.equal(Object.values(state.records).length, 2);
  assert.equal(learnRules(state).length, 0);
});
test('내보내기는 규칙·제목 근거만 포함하며 임의의 광범위 규칙은 거부한다', () => {
  const data = exportRules(three()); assert.deepEqual(validateRules(data), data);
  assert.equal(JSON.stringify(data).includes('stableId'), false);
  assert.throws(() => validateRules({ ...data, rules: [{ ...data.rules[0], keyword: '박물관' }] }));
  assert.throws(() => validateRules({ ...data, rules: [{ ...data.rules[0], count: 2 }] }));
  assert.throws(() => validateRules({ ...data, rules: [{ ...data.rules[0], keyword: '.*' }] }));
});
