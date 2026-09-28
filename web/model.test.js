import assert from 'node:assert/strict';
import test from 'node:test';
import { scheduleOf, syncFavorites, emptyFavorites, identity, legacyKey, safeUrl, isActive } from './model.js';
const p = { siteId: 'test', title: '박물관 인턴', stableId: 'test:id:123', regDate: '2026-09-27', deadlineDate: '2026-10-03', programStartAt: '2026-10-10', scheduleEvents: [{ type: 'posted', date: '2026-09-27' }] };
test('등록 이벤트만 있어도 접수 마감·활동기간 병합, 등록일 기본 숨김', () => {
  assert.deepEqual(scheduleOf(p).map(e => e.type), ['application_end', 'program_start']);
  assert.equal(scheduleOf(p, true).length, 3);
});
test('즐겨찾기 마이그레이션과 미연결 키 보존', () => {
  const store = syncFavorites(emptyFavorites(), [p], [legacyKey(p), 'gone::이전 공고']);
  assert.ok(store.records[identity(p)]);
  assert.deepEqual(store.unresolved, ['gone::이전 공고']);
});
test('현재 목록에서 사라져도 즐겨찾기 사본·일정 유지', () => {
  const saved = syncFavorites(emptyFavorites(), [p], [legacyKey(p)]);
  const next = syncFavorites(saved, []);
  assert.equal(next.records[identity(p)].missingFromLatest, true);
  assert.equal(scheduleOf(next.records[identity(p)].posting).length, 2);
});
test('같은 ID 제목 변경 및 마감 연장 반영, 날짜 누락은 이전값 보존', () => {
  let saved = syncFavorites(emptyFavorites(), [p], [legacyKey(p)]);
  saved = syncFavorites(saved, [{ ...p, title: '박물관 인턴 수정', deadlineDate: '2026-10-15' }]);
  assert.equal(saved.records[identity(p)].posting.title, '박물관 인턴 수정');
  assert.deepEqual(scheduleOf(saved.records[identity(p)].posting).filter(e => e.type === 'application_end').map(e => e.date), ['2026-10-15']);
  saved = syncFavorites(saved, [{ ...p, deadlineDate: null, programStartAt: null, scheduleEvents: [] }]);
  assert.equal(saved.records[identity(p)].retainedDates, true);
  assert.equal(saved.records[identity(p)].posting.deadlineDate, '2026-10-15');
});
test('추정 접수일 제외, 원문 링크 프로토콜 제한, 명시적 마감 보존', () => {
  assert.equal(scheduleOf({ scheduleEvents: [{ type: 'application_start', date: '2026-09-20', source: 'inferred' }] }).length, 0);
  assert.equal(safeUrl('javascript:alert(1)'), '');
  assert.equal(isActive({ deadlineDate: '2026-09-27' }, '2026-09-27'), true);
  assert.equal(isActive({ deadlineDate: '2026-09-26' }, '2026-09-27'), false);
});

test('보존 공고로 즐겨찾기의 마지막 실제 확인 시각을 새로 늘리지 않음', () => {
  const saved = syncFavorites(emptyFavorites(), [p], [legacyKey(p)], '2026-09-27T00:00:00Z');
  const next = syncFavorites(saved, [{ ...p, verificationStatus: 'retained', lastConfirmedAt: '2026-09-27T00:00:00Z' }], [], '2026-09-28T00:00:00Z');
  assert.equal(next.records[identity(p)].lastSeenAt, '2026-09-27T00:00:00Z');
});
