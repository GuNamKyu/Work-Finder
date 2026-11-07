// Browser and crawler share literal, category-scoped rules. No fuzzy server matching.
import { identity, legacyKey } from './model.js';

const TYPES = new Set(['internship', 'work_experience', 'volunteer', 'project', 'counseling', 'training', 'financial_support', 'fair', 'recurring_program']);
const GENERIC = new Set(('문화 문화예술 문화유산 국가유산 박물관 미술관 학예 학예사 학예직 사무 행정 경영 교육 연구 조사 전시 기획 보조 청년 청년일경험 미래내일 일경험 직무 직무경험 직무체험 직무체험프로그램 체험 프로그램 인턴 인턴십 실습 자원봉사 자원봉사자 봉사 활동가 직원 신입 경력 계약직 기간제 정규직 공개 신규 모집 모집중 공고 채용 채용공고 모집공고 안내 지원 사업 업무 담당 전문 분야 접수 상시 추가 재공고 최종 합격 발표 결과 서울 경기 인천 전국 온라인').split(' '));
export const normalizePhrase = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
const informative = token => token.length >= 2 && !GENERIC.has(token) && !/\d/u.test(token) && !/(?:박물관|미술관|재단|협회|대학교|학교|센터|기관|위원회|공사|주식회사|도서관)$/.test(token);
export function safeLearnedKeyword(value) {
  const tokens = normalizePhrase(value).split(' ');
  return value === normalizePhrase(value) && value.length <= 80 && tokens.length <= 3 && tokens.every(informative)
    && (tokens.length === 1 ? tokens[0].length >= 4 : tokens.join('').length >= 4);
}
const scope = p => `${p.postingType}:${p.postingType === 'experience' ? p.experienceType || '' : ''}`;
export const ruleId = r => `${scope(r)}:${r.keyword}`;
export function emptyHidden() { return { version: 1, records: {}, disabledRules: [] }; }
const samePosting = (a, b) => identity(a) === identity(b) || (!a.stableId && !a.postingId && !a.url && legacyKey(a) === legacyKey(b));
export const hasHiddenPosting = (store, p) => Object.values(store.records).some(r => samePosting(r.posting, p));
export function validHidden(value) {
  return value?.version === 1 && value.records && !Array.isArray(value.records) && typeof value.records === 'object'
    && Array.isArray(value.disabledRules) && value.disabledRules.every(v => typeof v === 'string')
    && Object.values(value.records).every(r => r?.posting && typeof r.posting.title === 'string' && typeof r.posting.siteId === 'string');
}
// Older hidden keys still contain titles. Unknown categories are preserved, not guessed.
export function migrateHidden(store, legacy, postings, now = new Date().toISOString()) {
  const next = structuredClone(store), byKey = new Map(postings.map(p => [legacyKey(p), p]));
  for (const key of legacy) {
    if (Object.values(next.records).some(r => legacyKey(r.posting) === key)) continue;
    const cut = key.indexOf('::'); if (cut < 0) continue;
    const p = byKey.get(key) || { siteId: key.slice(0, cut), title: key.slice(cut + 2) };
    next.records[identity(p)] = { posting: hiddenSnapshot(p), hiddenAt: now };
  }
  for (const record of Object.values(next.records)) {
    const p = postings.find(p => samePosting(record.posting, p));
    if (p) record.posting = hiddenSnapshot(p);
  }
  return next;
}
function hiddenSnapshot(p) {
  return Object.fromEntries(['title', 'organization', 'siteId', 'postingType', 'experienceType', 'stableId', 'postingId', 'url', 'regDate', 'applicationStartAt'].filter(k => p[k] !== undefined).map(k => [k, p[k]]));
}
export function toggleHiddenRecord(store, p, now = new Date().toISOString()) {
  const next = structuredClone(store);
  const ids = Object.keys(next.records).filter(id => samePosting(next.records[id].posting, p));
  if (ids.length) ids.forEach(id => delete next.records[id]);
  else next.records[identity(p)] = { posting: hiddenSnapshot(p), hiddenAt: now };
  return next;
}
export function learnRules(store) {
  const groups = new Map(), duplicates = new Set();
  for (const { posting: p } of Object.values(store.records)) {
    if (!['job', 'experience'].includes(p.postingType) || (p.postingType === 'experience' && !TYPES.has(p.experienceType))) continue;
    // Same title/org/date syndicated to multiple sources is one rejection, not three.
    const dedupe = `${scope(p)}:${normalizePhrase(p.organization)}:${normalizePhrase(p.title)}:${p.regDate || p.applicationStartAt || ''}`;
    if (duplicates.has(dedupe)) continue; duplicates.add(dedupe);
    const words = normalizePhrase(p.title.replace(/\[[^\]]*\]/g, ' ')).split(' ');
    const organizationWords = new Set(normalizePhrase(p.organization).split(' '));
    const candidates = new Set();
    for (let i = 0; i < words.length; i++) for (let n = 1; n <= 3 && i + n <= words.length; n++) {
      const tokens = words.slice(i, i + n), keyword = tokens.join(' ');
      if (safeLearnedKeyword(keyword) && !tokens.some(t => organizationWords.has(t))) candidates.add(keyword);
    }
    for (const keyword of candidates) {
      const rule = { keyword, postingType: p.postingType, experienceType: p.postingType === 'experience' ? p.experienceType : null };
      const id = ruleId(rule);
      if (!groups.has(id)) groups.set(id, { ...rule, evidence: new Map() });
      groups.get(id).evidence.set(dedupe, p.title);
    }
  }
  const all = [...groups.values()].filter(r => r.evidence.size >= 3);
  // Prefer the longest shared phrase when a shorter rule has exactly the same evidence.
  return all.filter(r => !all.some(other => scope(r) === scope(other) && other.keyword !== r.keyword
    && ` ${other.keyword} `.includes(` ${r.keyword} `) && r.evidence.size === other.evidence.size
    && [...r.evidence.keys()].every(k => other.evidence.has(k))))
    .map(r => ({ keyword: r.keyword, postingType: r.postingType, experienceType: r.experienceType, count: r.evidence.size,
      examples: [...r.evidence.values()].slice(0, 3), enabled: !store.disabledRules.includes(ruleId(r)) }))
    .sort((a, b) => ruleId(a).localeCompare(ruleId(b)));
}
export function matchesRule(p, rules) {
  const title = ` ${normalizePhrase(p.title)} `;
  return rules.some(r => r.enabled !== false && scope(p) === scope(r) && title.includes(` ${r.keyword} `));
}
export function exportRules(store, now = new Date().toISOString()) {
  return { version: 1, generatedAt: now, rules: learnRules(store).filter(r => r.enabled).map(({ enabled, ...r }) => r) };
}
export function validateRules(value) {
  if (value?.version !== 1 || !Array.isArray(value.rules) || value.rules.length > 5000) throw new Error('유효한 제외 규칙 파일이 아닙니다.');
  const ids = new Set();
  for (const r of value.rules) {
    if (!r || typeof r.keyword !== 'string' || !safeLearnedKeyword(r.keyword) || !['job', 'experience'].includes(r.postingType)
      || (r.postingType === 'experience' ? !TYPES.has(r.experienceType) : r.experienceType !== null)
      || !Number.isInteger(r.count) || r.count < 3 || !Array.isArray(r.examples) || r.examples.length !== 3
      || r.examples.some(t => typeof t !== 'string' || t.length > 2000 || !` ${normalizePhrase(t)} `.includes(` ${r.keyword} `)) || ids.has(ruleId(r))) {
      throw new Error('규칙의 문구·유형·3건 근거를 확인하세요. 기존 파일은 변경하지 않았습니다.');
    }
    ids.add(ruleId(r));
  }
  return { version: 1, generatedAt: typeof value.generatedAt === 'string' ? value.generatedAt : '',
    rules: value.rules.map(r => ({ keyword: r.keyword, postingType: r.postingType, experienceType: r.experienceType, count: r.count, examples: r.examples.slice() })) };
}
