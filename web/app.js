import { TYPE_LABELS, EVENT_LABELS, identity, legacyKey, todayKST, scheduleOf, emptyFavorites, syncFavorites, isActive, flattenResults, safeUrl, relevantSources } from './model.js';
import { emptyHidden, validHidden, migrateHidden, toggleHiddenRecord, hasHiddenPosting, learnRules, exportRules, matchesRule, ruleId, validateRules } from './exclusions.js';

const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STORE = 'wf_favorites_v2';
const HIDDEN_STORE = 'wf_hidden_learning_v1';
let hiddenState = emptyHidden(), learnedRules = [], serverRules = [];
let sources = [], health = [], postings = [], newIds = new Set(), favorites = emptyFavorites();
let mode = 'job', previousMode = 'job', activeSite = '', type = 'nonvolunteer', recordKind = 'recruitment', filter = 'all', showHidden = false, includeUnverified = false;
let calDate = new Date(), includePosted = false;
let storageBroken = false;
function read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { storageBroken = true; return fallback; } }
function write(key, value) {
  if (storageBroken) { message('저장된 데이터를 보호하기 위해 덮어쓰기를 중단했습니다. 브라우저 저장 상태를 확인하세요.'); return false; }
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { message('브라우저 저장에 실패했습니다. 백업을 내보낸 뒤 저장 공간·권한을 확인하세요.'); return false; }
}
function message(text) { $('app-message').textContent = text; }
const legacyHidden = read('wf_hidden_postings', []);
let hidden = new Set(Array.isArray(legacyHidden) ? legacyHidden : []);
if (!Array.isArray(legacyHidden) || ![...hidden].every(k => typeof k === 'string')) { storageBroken = true; hidden.clear(); }
hiddenState = read(HIDDEN_STORE, emptyHidden());
if (!validHidden(hiddenState)) { storageBroken = true; hiddenState = emptyHidden(); }
favorites = read(STORE, emptyFavorites());
if (favorites?.version !== 2 || !favorites.records || !Array.isArray(favorites.unresolved)) { storageBroken = true; favorites = emptyFavorites(); }
function favoriteId(p) { return Object.keys(favorites.records).find(id => id === identity(p) || legacyKey(favorites.records[id].posting) === legacyKey(p)); }
function toggleFavorite(p) {
  const next = structuredClone(favorites), id = favoriteId(p);
  if (id) delete next.records[id];
  else next.records[identity(p)] = { posting: p, savedAt: new Date().toISOString(), lastSeenAt: new Date().toISOString() };
  if (write(STORE, next)) { favorites = next; render(); }
}
function toggleHidden(p) {
  saveHidden(toggleHiddenRecord(hiddenState, p));
}
function updateHidden() {
  hidden = new Set(Object.values(hiddenState.records).map(r => legacyKey(r.posting)));
  learnedRules = learnRules(hiddenState);
}
function saveHidden(next) { if (write(HIDDEN_STORE, next)) { hiddenState = next; updateHidden(); render(); } }
function isHidden(p) { return hasHiddenPosting(hiddenState, p); }
function learnedExcluded(p) {
  const rules = [...learnedRules, ...serverRules].filter(r => !hiddenState.disabledRules.includes(ruleId(r)));
  return matchesRule(p, rules);
}
async function json(path) { const r = await fetch(path, { cache: 'no-cache' }); if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`); return r.json(); }
async function init() {
  const results = await Promise.allSettled([json('./results.json'), json('./experience-results.json'), json('./new-postings.json'), json('./source-health.json'), json('./learned-exclusions.json')]);
  const errors = [];
  results.slice(0, 2).forEach((r, i) => { if (r.status === 'fulfilled') sources.push(...r.value); else errors.push(`${i ? '직무경험' : '채용'} 데이터 불러오기 실패`); });
  postings = flattenResults(sources);
  if (results[2].status === 'fulfilled') newIds = new Set(results[2].value.map(identity));
  if (results[3].status === 'fulfilled') health = results[3].value;
  if (results[4].status === 'fulfilled') serverRules = validateRules(results[4].value).rules;
  else errors.push('서버 제외 규칙 불러오기 실패');
  const migratedHidden = migrateHidden(hiddenState, [...hidden], postings);
  if (write(HIDDEN_STORE, migratedHidden)) { hiddenState = migratedHidden; write('wf_hidden_postings', []); }
  updateHidden();
  const migrated = syncFavorites(favorites, postings, read('wf_fav_postings', []));
  if (write(STORE, migrated)) { favorites = migrated; write('wf_fav_postings', []); }
  if (storageBroken) message('저장 데이터 읽기에 실패했습니다. 기존 데이터는 덮어쓰지 않았습니다.');
  else if (errors.length) message(errors.join(' / '));
  render();
}
function baseRows() {
  if (mode === 'favorites') return Object.values(favorites.records).map(r => ({ ...r.posting, savedRecord: r }));
  return postings.filter(p => p.postingType === mode && p.userVisible !== false && isActive(p, todayKST(), includeUnverified));
}
function selectRows(skipType = false) {
  let rows = baseRows();
  if (mode === 'experience') {
    rows = rows.filter(p => (p.recordKind || 'recruitment') === recordKind);
    if (!skipType) rows = rows.filter(p => type === 'all' || (type === 'nonvolunteer' ? p.experienceType !== 'volunteer' : p.experienceType === type));
  }
  const query = $('search').value.trim().toLowerCase();
  const period = Number($('period-select').value);
  const oldest = new Date(Date.parse(`${todayKST()}T00:00:00Z`) - period * 86400000).toISOString().slice(0, 10);
  return rows.filter(p => (!activeSite || p.siteId === activeSite) && (showHidden || (!isHidden(p) && (mode === 'favorites' || !learnedExcluded(p))))
    && (filter !== 'new' || newIds.has(identity(p)))
    && (!period || (p.postedAt || p.regDate || p.applicationStartAt || '') >= oldest)
    && (!query || `${p.title} ${p.organization} ${p.siteName} ${p.roleText || ''} ${p.region || ''}`.toLowerCase().includes(query)))
    .sort((a, b) => (a.relevanceTier === 'target' ? -1 : 0) - (b.relevanceTier === 'target' ? -1 : 0) || (b.fitScore || 0) - (a.fitScore || 0) || (a.applicationEndAt || a.deadlineDate || '9999').localeCompare(b.applicationEndAt || b.deadlineDate || '9999'));
}
function openSource(p) {
  // Only the verified Work24 read-only detail endpoints may be opened through POST.
  const f = p.sourceForm;
  if (f && /^https:\/\/yw\.work24\.go\.kr\/d\/a\/select(?:ItrnPrjtEsg|EntrTrvl)PrgmDtal\.do$/.test(f.action) && /^PG\d+$/.test(f.fields?.untyPrgmCtn || '')) {
    const form = document.createElement('form'); form.action = f.action; form.method = 'POST'; form.target = '_blank'; form.rel = 'noopener noreferrer';
    const input = document.createElement('input'); input.type = 'hidden'; input.name = 'untyPrgmCtn'; input.value = f.fields.untyPrgmCtn; form.append(input); document.body.append(form); form.submit(); form.remove();
  } else { const url = safeUrl(p.url || p.siteUrl); if (url) window.open(url, '_blank', 'noopener,noreferrer'); }
}
function card(p) {
  const el = document.createElement('article'); el.className = 'posting';
  const fav = !!favoriteId(p), dates = scheduleOf(p), deadline = p.applicationEndAt || p.deadlineDate;
  const saved = p.savedRecord;
  const support = p.recordKind === 'program_info';
  const badge = p.postingType === 'experience' ? TYPE_LABELS[p.experienceType] || '직무경험' : '채용';
  const review = p.eligibilityStatus === 'ineligible' ? '지원 불가 신호' : p.eligibilityStatus === 'likely_eligible' ? '초급 직무 신호 · 자격 확정 아님' : '지원요건 미확인';
  el.innerHTML = `<div class="posting-body"><div class="posting-title"><span class="kind-badge">${esc(badge)}</span> ${esc(p.title)} ${newIds.has(identity(p)) ? '<span class="posting-new">NEW</span>' : ''}</div>
    <div class="posting-org">${esc(p.siteName)} · ${esc(p.organization)} ${esc(p.region || '')}</div>
    <div class="posting-note">${support ? '사업 안내 · 현재 모집 여부 미확인' : `${esc(p.roleText || '')} · ${review} · ${p.relevanceTier === 'target' ? '목표 분야' : '인접 분야'}`}${p.lifecycleStatus === 'active_long' ? ' · 장기 모집' : ''}${p.lifecycleStatus === 'rolling' ? ' · 상시 모집' : ''}</div>
    ${p.summary ? `<div class="posting-note">${esc(p.summary)}</div>` : ''}
    ${p.eligibilityText ? `<div class="posting-note">참여대상: ${esc(p.eligibilityText)}</div>` : ''}
    ${p.programPeriodText ? `<div class="posting-note">사업 운영기간 (접수기간 아님): ${esc(p.programPeriodText)}</div>` : ''}
    ${(p.informationLinks || []).filter(l => safeUrl(l.url)).map(l => `<a href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener noreferrer">${esc(l.label)} ↗</a>`).join(' · ')}
    <div class="schedule-summary">${support ? '접수기간 확인 전 — 모집 중으로 표시하지 않음' : deadline ? `접수 ${esc(p.applicationStartAt || '시작일 미확인')} ~ ${esc(deadline)}` : '접수 마감일 미확인'}${p.programStartAt ? `<br>활동 ${esc(p.programStartAt)} ~ ${esc(p.programEndAt || '종료일 미확인')}` : ''}</div>
    ${p.detailWarning ? `<div class="posting-note warning">${esc(p.detailWarning)}</div>` : ''}
    ${p.verificationStatus === 'retained' ? `<div class="warning">이번 수집에서 재확인 못함 · 이전 확인값 보존 · 마지막 확인 ${esc(p.lastConfirmedAt || '시각 미상')} · 현재 모집 여부는 원문 확인 필요</div>` : ''}
    ${p.lifecycleStatus === 'stale_unknown' ? '<div class="warning">오래된 공고 · 마감일 미확인 (모집 중으로 확정하지 않음)</div>' : ''}
    ${p.retainedSchedule ? '<div class="warning">일부 일정은 이전 확인값 보존 · 이번 상세 수집에서 재확인 못함</div>' : ''}
    ${saved?.missingFromLatest ? '<div class="warning">현재 수집에서 미확인 · 저장 당시 사본 보존 (종료 확정 아님)</div>' : ''}
    ${saved?.retainedDates ? '<div class="warning">일부 일정은 이전 확인값 보존 · 원문 재확인 필요</div>' : ''}
    ${saved && !isActive(p) ? '<div class="warning">종료 또는 오래된 공고 · 즐겨찾기 이력으로 보존</div>' : ''}
    ${saved && p.userVisible === false ? '<div class="warning">현재 추천 대상에서 제외됨 · 사용자가 저장한 기록</div>' : ''}
    ${learnedExcluded(p) ? '<div class="warning">숨김 학습 제외 문구에 일치 · 즐겨찾기 사본은 보존</div>' : ''}
    <details><summary>일정·판단 근거</summary><ul>${dates.map(e => `<li>${esc(e.date)} ${esc(e.label)}${e.evidence ? ` — ${esc(e.evidence)}` : ''}</li>`).join('') || '<li>등록일 외 확인된 일정 없음</li>'}</ul><p>${esc([...(p.relevanceReasons || []), ...(p.eligibilityReasons || [])].join(' / '))}</p><p>적합도 ${p.fitScore ?? '-'}점은 정렬 보조값이며 지원자격을 보장하지 않습니다.</p></details></div>
    <div class="posting-actions"><button class="source-btn">원문 열기 ↗</button><button class="fav-btn ${fav ? 'active' : ''}" aria-pressed="${fav}" aria-label="${esc(p.title)} 즐겨찾기 ${fav ? '해제' : '추가'}">${fav ? '★ 저장됨' : '☆ 즐겨찾기'}</button><button class="posting-hide-btn">${isHidden(p) ? '복원' : '숨기기'}</button></div>`;
  el.querySelector('.source-btn').onclick = () => openSource(p);
  el.querySelector('.fav-btn').onclick = () => toggleFavorite(p);
  el.querySelector('.posting-hide-btn').onclick = () => toggleHidden(p);
  return el;
}
function sourceStatus() {
  $('source-status').innerHTML = '<summary>수집 상태·누락 확인</summary>' + sources.map(r => {
    const stale = Date.now() - new Date(r.crawledAt).getTime() > 36 * 3600000;
    const issue = health.find(h => h.siteId === r.site.id && !['OK', 'RECOVERED'].includes(h.status));
    return `<p class="${r.error || stale || issue ? 'warning' : ''}">${esc(r.site.name)}: ${r.error ? `${r.observedCount ? '부분 실패' : '실패'} — ${esc(r.error)} · 이번 확인 ${r.observedCount || 0}건 / 이전 확인값 ${r.retainedCount || 0}건 보존` : `${r.postings.length}건 수집 / ${r.postings.filter(p => p.userVisible !== false && isActive(p)).length}건 노출 대상`}${stale ? ' · 36시간 이상 갱신 없음' : ''}${issue ? ` · ${esc(issue.status)} ${esc(issue.message)}` : ''}<br><small>시도 ${esc(r.crawledAt)}${r.lastSuccessfulAt ? ` · 마지막 전체 성공 ${esc(r.lastSuccessfulAt)}` : ''} ${(r.warnings || []).map(esc).join(' / ')}</small></p>`;
  }).join('');
}
function collectionWarnings() {
  const relevant = relevantSources(sources, mode, activeSite, type);
  return relevant.filter(r => r.error || Date.now() - Date.parse(r.crawledAt) > 36 * 3600000 || health.some(h => h.siteId === r.site.id && !['OK', 'RECOVERED'].includes(h.status))).length;
}
function renderExclusions() {
  $('exclusion-controls').hidden = mode === 'scheduler';
  const rules = new Map(serverRules.map(r => [ruleId(r), { ...r, server: true }]));
  learnedRules.forEach(r => rules.set(ruleId(r), { ...rules.get(ruleId(r)), ...r }));
  $('learned-rule-count').textContent = `(${rules.size}개)`;
  $('learned-rules').replaceChildren();
  for (const [id, r] of rules) {
    const active = !hiddenState.disabledRules.includes(id);
    const row = document.createElement('div'); row.className = 'learned-rule';
    const description = document.createElement('span');
    description.textContent = `“${r.keyword}” · ${r.postingType === 'job' ? '채용' : TYPE_LABELS[r.experienceType]} · 서로 다른 ${r.count}건 · ${active ? '적용' : '해제'}${r.server ? ' · 서버 반영됨' : ' · 이 브라우저에서 학습'} `;
    const button = document.createElement('button'); button.textContent = active ? '규칙 해제' : '규칙 재적용';
    button.onclick = () => { const next = structuredClone(hiddenState); next.disabledRules = active ? [...new Set([...next.disabledRules, id])] : next.disabledRules.filter(k => k !== id); saveHidden(next); };
    const evidence = document.createElement('small'); evidence.textContent = `근거: ${r.examples.join(' / ')}`;
    row.append(description, button, evidence); $('learned-rules').append(row);
  }
  if (!rules.size) $('learned-rules').textContent = '3건 이상 반복된 구체적인 제목 문구가 아직 없습니다.';
  const unresolved = Object.values(hiddenState.records).filter(r => !r.posting.postingType).length;
  $('hidden-unresolved').textContent = unresolved ? `이전 숨김 ${unresolved}건은 유형 미확인으로 보존 중입니다. 다시 수집되어 유형이 확인되면 학습에 포함합니다.` : '';
}
function render() {
  const scheduler = mode === 'scheduler';
  $('page-title').textContent = { job: '문화기관 채용공고', experience: '직무경험·취업지원', favorites: '즐겨찾기', scheduler: '즐겨찾기 스케줄러' }[mode];
  $('page-subtitle').textContent = mode === 'experience' ? '인턴 · 일경험 · 교육 · 상담 · 비용지원 — 자원봉사는 별도 선택' : '제외 키워드 우선 · 지원요건 별도 확인 · 접수 및 활동 일정 보존';
  $('flip-btn').textContent = mode === 'experience' ? '채용공고' : '직무경험';
  $('favorites-btn').textContent = `즐겨찾기 (${Object.keys(favorites.records).length})`;
  document.querySelector('.controls').hidden = scheduler;
  document.querySelector('.site-nav-wrap').hidden = scheduler;
  $('main-content').hidden = scheduler;
  $('scheduler-view').style.display = scheduler ? 'block' : 'none';
  $('experience-controls').hidden = mode !== 'experience';
  $('backup-controls').hidden = !['favorites', 'scheduler'].includes(mode);
  $('loading').style.display = 'none';
  const activeSources = ['favorites', 'scheduler'].includes(mode) ? sources : sources.filter(r => (r.site.type || 'job') === mode);
  $('site-count').textContent = activeSources.length;
  $('crawled-at').textContent = activeSources.length ? new Date(Math.max(...activeSources.map(r => new Date(r.crawledAt).getTime()))).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '미수집';
  $('show-hidden-bar').style.display = (hidden.size || learnedRules.length || serverRules.length) && !scheduler ? 'flex' : 'none';
  $('hidden-count-badge').textContent = `${Object.keys(hiddenState.records).length}건`;
  $('show-hidden-btn').textContent = showHidden ? '숨긴 공고 감추기' : '숨긴 공고 보기';
  document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('active', b.dataset.filter === filter));
  sourceStatus();
  const problemCount = collectionWarnings();
  $('unverified-controls').hidden = !['job', 'experience'].includes(mode);
  renderExclusions();
  if (scheduler) { renderCalendar(); return; }
  const rows = selectRows();
  $('posting-count').textContent = rows.length;
  if (mode === 'experience') {
    const pool = selectRows(true);
    $('experience-type').innerHTML = [['nonvolunteer', '자원봉사 제외'], ['all', '전체 유형'], ...Object.entries(TYPE_LABELS)].map(([key, label]) => `<option value="${key}" ${type === key ? 'selected' : ''}>${label} (${pool.filter(p => key === 'all' || (key === 'nonvolunteer' ? p.experienceType !== 'volunteer' : p.experienceType === key)).length})</option>`).join('');
  }
  $('site-nav').replaceChildren();
  const navSources = relevantSources(sources, mode, '', mode === 'experience' ? type : 'all');
  for (const [id, name] of new Map([...baseRows().map(p => [p.siteId, p.siteName]), ...navSources.filter(r => r.error).map(r => [r.site.id, r.site.name])])) {
    const wrap = document.createElement('span'); wrap.className = 'source-nav-item';
    const b = document.createElement('button'); b.className = `site-tag${activeSite === id ? ' active' : ''}`; b.textContent = `${name} (${baseRows().filter(p => p.siteId === id).length})${sources.find(r => r.site.id === id)?.error ? ' ⚠ 수집 실패' : ''}`; b.onclick = () => { activeSite = activeSite === id ? '' : id; render(); }; wrap.append(b);
    const url = safeUrl(sources.find(r => r.site.id === id)?.site.url);
    if (url) { const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = '↗'; a.title = `${name} 원본 사이트`; wrap.append(a); }
    $('site-nav').append(wrap);
  }
  $('site-nav-toggle').style.display = $('site-nav').scrollHeight > 40 ? 'inline-flex' : 'none';
  $('posting-list').style.display = rows.length ? 'flex' : 'none';
  $('posting-list').replaceChildren(...rows.map(card));
  $('empty-state').style.display = rows.length ? 'none' : 'block';
  $('empty-state').innerHTML = `<p>${problemCount ? '조건에 맞는 공고가 표시되지 않습니다. 수집 실패·불완전 소스가 있어 실제 공고 부재로 판단할 수 없습니다.' : mode === 'experience' ? '선택한 유형의 확인된 공고가 없습니다. 사업 안내 탭과 수집 상태를 확인하세요.' : '조건에 맞는 공고가 없습니다.'}</p>`;
  $('unresolved-favorites').textContent = favorites.unresolved.length ? `이전 즐겨찾기 ${favorites.unresolved.length}건은 현재 자료와 연결되지 않았습니다. 제목을 보존했으며 다시 수집되면 복구합니다: ${favorites.unresolved.join(', ')}` : '';
}
function favoriteEvents() {
  return Object.values(favorites.records).flatMap(r => scheduleOf(r.posting, includePosted).map(e => ({ ...e, posting: r.posting, record: r }))).sort((a, b) => a.date.localeCompare(b.date));
}
function eventButton(e) {
  const b = document.createElement('button'); b.className = `cal-event ${e.type === 'application_end' ? 'deadline' : e.type === 'posted' ? 'regdate' : 'program'}`;
  b.textContent = `${e.label} · ${e.posting.title}`; b.title = `${e.date} ${b.textContent}`; b.onclick = () => openSource(e.posting); return b;
}
function renderCalendar() {
  const year = calDate.getFullYear(), month = calDate.getMonth(), today = todayKST();
  const events = favoriteEvents(), grid = $('calendar-grid'); grid.replaceChildren();
  $('cal-title').textContent = `${year}년 ${month + 1}월`;
  $('posting-count').textContent = Object.keys(favorites.records).length;
  for (const day of ['일', '월', '화', '수', '목', '금', '토']) { const d = document.createElement('div'); d.className = 'cal-day-header'; d.textContent = day; grid.append(d); }
  const offset = new Date(year, month, 1).getDay(), count = new Date(year, month + 1, 0).getDate();
  for (let i = 0; i < offset + count; i++) {
    const cell = document.createElement('div'); cell.className = 'cal-cell'; grid.append(cell); if (i < offset) continue;
    const day = i - offset + 1, key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (key === today) cell.classList.add('today');
    const number = document.createElement('strong'); number.textContent = day; cell.append(number);
    const daily = events.filter(e => e.date === key);
    daily.slice(0, 3).forEach(e => cell.append(eventButton(e)));
    if (daily.length > 3) { const more = document.createElement('details'); more.innerHTML = `<summary>+${daily.length - 3}건 모두 보기</summary>`; daily.slice(3).forEach(e => more.append(eventButton(e))); cell.append(more); }
  }
  const upcoming = events.filter(e => e.date >= today), agenda = $('upcoming-agenda');
  agenda.innerHTML = '<h3>다가오는 일정 (월에 관계없이)</h3>';
  for (const e of upcoming) { const line = document.createElement('div'); line.className = 'agenda-line'; const date = document.createElement('span'); date.textContent = e.date; line.append(date, eventButton(e)); if (e.record.missingFromLatest || e.record.retainedDates) line.append(document.createTextNode(' · 이전 확인값 / 원문 재확인')); agenda.append(line); }
  if (!upcoming.length) agenda.append(document.createTextNode('확인된 향후 일정이 없습니다. 등록일을 대신 표시하지 않습니다.'));
  const undated = Object.values(favorites.records).filter(r => !scheduleOf(r.posting).length);
  $('undated-favorites').innerHTML = '<h3>접수·활동 일정 미확인</h3>';
  for (const r of undated) { const b = document.createElement('button'); b.className = 'source-btn'; b.textContent = `${r.posting.title} — 원문 확인`; b.onclick = () => openSource(r.posting); $('undated-favorites').append(b); }
  if (!undated.length) $('undated-favorites').append(document.createTextNode('없음'));
  $('cal-empty').style.display = Object.keys(favorites.records).length ? 'none' : 'block';
}
function switchMode(next) {
  if (next === 'scheduler' && mode === 'scheduler') next = previousMode;
  if (next === 'scheduler') {
    previousMode = mode;
    const first = favoriteEvents().find(e => e.date >= todayKST());
    calDate = first ? new Date(`${first.date}T12:00:00`) : new Date();
  }
  mode = next; activeSite = ''; filter = 'all'; $('search').value = ''; $('period-select').value = ''; render();
}
$('flip-btn').onclick = () => switchMode(mode === 'experience' ? 'job' : 'experience');
$('favorites-btn').onclick = () => switchMode(mode === 'favorites' ? 'job' : 'favorites');
$('scheduler-btn').onclick = () => switchMode('scheduler');
$('search').oninput = render; $('period-select').onchange = render;
$('include-unverified').onchange = e => { includeUnverified = e.target.checked; render(); };
document.querySelectorAll('[data-filter]').forEach(b => b.onclick = () => { filter = b.dataset.filter; render(); });
$('experience-type').onchange = e => { type = e.target.value; render(); };
$('record-kind').onchange = e => { recordKind = e.target.value; activeSite = ''; render(); };
$('show-hidden-btn').onclick = () => { showHidden = !showHidden; render(); };
$('clear-hidden-btn').onclick = () => saveHidden({ ...hiddenState, records: {} });
$('exclusion-export').onclick = () => {
  const payload = exportRules(hiddenState);
  // Keep previously imported server rules unless explicitly disabled in this browser.
  const rules = new Map(payload.rules.map(r => [ruleId(r), r]));
  serverRules.filter(r => !hiddenState.disabledRules.includes(ruleId(r))).forEach(r => { if (!rules.has(ruleId(r))) rules.set(ruleId(r), r); });
  payload.rules = [...rules.values()];
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = `work-finder-exclusions-${todayKST()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  message(`${payload.rules.length}개 규칙을 내보냈습니다. 서버 수집 반영은 파일 가져오기와 커밋·푸시 후 적용됩니다.`);
};
$('site-nav-toggle').onclick = () => { $('site-nav').classList.toggle('expanded'); };
$('cal-prev').onclick = () => { calDate.setMonth(calDate.getMonth() - 1, 1); renderCalendar(); };
$('cal-next').onclick = () => { calDate.setMonth(calDate.getMonth() + 1, 1); renderCalendar(); };
$('show-posted').onchange = e => { includePosted = e.target.checked; renderCalendar(); };
$('backup-export').onclick = () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(favorites, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = `work-finder-favorites-${todayKST()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$('backup-import').onchange = async e => {
  try {
    const file = e.target.files[0]; if (!file || file.size > 5000000) throw new Error('5MB 이하 JSON 파일을 선택하세요.');
    const data = JSON.parse(await file.text());
    if (data.version !== 2 || !data.records || typeof data.records !== 'object' || !Array.isArray(data.unresolved) || !data.unresolved.every(k => typeof k === 'string') || Object.values(data.records).some(r => !r?.posting || typeof r.posting.title !== 'string' || typeof r.posting.siteId !== 'string' || (r.posting.scheduleEvents && !Array.isArray(r.posting.scheduleEvents)))) throw new Error('유효한 Work-Finder 백업이 아닙니다.');
    const next = syncFavorites({ version: 2, records: { ...data.records, ...favorites.records }, unresolved: [...new Set([...data.unresolved, ...favorites.unresolved])] }, postings);
    if (write(STORE, next)) { favorites = next; message('즐겨찾기 백업을 병합했습니다.'); render(); }
  } catch (error) { message(`가져오기 실패: ${error.message}`); }
  e.target.value = '';
};
init().catch(error => message(`초기화 실패: ${error.message}`));
