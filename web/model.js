// Pure data rules shared by the UI and Node regression tests.
export const TYPE_LABELS = { internship: '인턴', work_experience: '일경험·실습', volunteer: '자원봉사', project: '프로젝트', counseling: '상담·취업지원', training: '교육·훈련', financial_support: '비용지원', fair: '박람회', recurring_program: '정기 사업' };
export const EVENT_LABELS = { posted: '등록', application_start: '접수 시작', application_end: '접수 마감', program_start: '활동 시작', program_end: '활동 종료', interview: '면접', result: '발표', orientation: '사전교육', other: '기타' };
export const legacyKey = p => `${p.siteId}::${p.title}`;
export const identity = p => p.stableId || (p.postingId ? `${p.siteId}:id:${p.postingId}` : p.url ? `${p.siteId}:url:${p.url}` : legacyKey(p));
export const todayKST = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !isNaN(d) && d.toISOString().slice(0, 10) === value;
}
export function scheduleOf(p, includePosted = false) {
  const events = (p.scheduleEvents || []).filter(e => validDate(e.date) && e.precision !== 'month' && e.precision !== 'approximate' && e.source !== 'inferred').map(e => ({ ...e }));
  const inferredStart = p.scheduleEvents?.some(e => e.type === 'application_start' && e.source === 'inferred' && e.date === p.applicationStartAt);
  const fields = { posted: p.postedAt === null ? null : p.postedAt || p.regDate, application_start: inferredStart ? null : p.applicationStartAt, application_end: p.applicationEndAt || p.deadlineDate, program_start: p.programStartAt, program_end: p.programEndAt };
  for (const [type, date] of Object.entries(fields)) if (validDate(date) && !events.some(e => e.type === type && e.date === date)) events.push({ type, date });
  return events.filter((e, i) => (includePosted || e.type !== 'posted') && events.findIndex(x => x.type === e.type && x.date === e.date && x.label === e.label) === i)
    .map(e => ({ ...e, label: e.label || EVENT_LABELS[e.type] || '일정' })).sort((a, b) => a.date.localeCompare(b.date));
}
export function emptyFavorites() { return { version: 2, records: {}, unresolved: [] }; }
export function syncFavorites(store, postings, legacy = [], now = new Date().toISOString()) {
  const next = JSON.parse(JSON.stringify(store?.version === 2 ? store : emptyFavorites()));
  const byLegacy = new Map(postings.map(p => [legacyKey(p), p]));
  for (const key of new Set([...(next.unresolved || []), ...legacy])) {
    const p = byLegacy.get(key);
    if (p && !next.records[identity(p)]) next.records[identity(p)] = { posting: p, savedAt: now };
  }
  next.unresolved = [...new Set([...(next.unresolved || []), ...legacy])].filter(key => !byLegacy.has(key));
  const current = new Map(postings.map(p => [identity(p), p]));
  for (const [id, record] of Object.entries(next.records)) {
    const p = current.get(id) || byLegacy.get(legacyKey(record.posting));
    if (p) {
      const merged = { ...record.posting, ...p };
      // Do not erase previously confirmed schedule on a partial crawl.
      for (const field of ['applicationStartAt', 'applicationEndAt', 'deadlineDate', 'programStartAt', 'programEndAt']) if (!p[field] && record.posting[field]) merged[field] = record.posting[field];
      if (p.applicationEndAt || p.deadlineDate) merged.applicationEndAt = merged.deadlineDate = p.applicationEndAt || p.deadlineDate;
      const old = scheduleOf(record.posting, true);
      const fresh = scheduleOf(p, true);
      merged.scheduleEvents = [...fresh, ...old.filter(e => !fresh.some(n => n.type === e.type))];
      next.records[id] = { ...record, posting: merged, lastSeenAt: now, missingFromLatest: false, retainedDates: old.some(e => !fresh.some(n => n.type === e.type)) };
    } else next.records[id] = { ...record, missingFromLatest: true };
  }
  return next;
}
export function isActive(p, today = todayKST()) {
  if (p.lifecycleStatus === 'closed' || p.lifecycleStatus === 'stale_unknown') return false;
  const end = p.applicationEndAt || p.deadlineDate;
  return !validDate(end) || end >= today;
}
export function flattenResults(results) {
  return results.flatMap(r => r.error ? [] : r.postings.map(p => ({ ...p, siteId: r.site.id, siteName: r.site.name, siteUrl: r.site.url, postingType: p.postingType || r.site.type || 'job' })));
}
export function safeUrl(value) { try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } }
