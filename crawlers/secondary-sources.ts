import type { CrawlResult, JobPosting } from './types.js';

/**
 * 다른 기관 공고를 다시 싣는 채용 포털(2차 출처). 원 출처 게시판에 같은 공고가 있으면
 * 원 출처를 남기고 2차 출처 사본은 수집에서 뺀다. (종합 게시판 우선 규칙의 예외:
 * 포털은 원문 마감·자격을 직접 관리하지 않고, 대행사가 대신 올리는 경우가 많다.)
 * 소속·회원 기관 공고를 함께 싣는 상위 기관 게시판(국가유산청·경기문화재단·한국문화원연합회·한국문화유산협회)도
 * 그 기관 자체 게시판에 같은 공고가 있으면 자체 게시판을 남긴다.
 * 원 출처가 없고 여러 게시판에 같은 공고가 있으면 이 순서에서 앞선 게시판 하나만 남긴다.
 */
export const SECONDARY_SOURCE_PRIORITY = ['khs', 'ggcf', 'kccf', 'kaah', 'gojobs', 'job-gg', 'museum-or-kr', 'kdp-aks', 'saramin'];
export const SECONDARY_SOURCE_IDS = new Set(SECONDARY_SOURCE_PRIORITY);

const DATE_WINDOW_DAYS = 45;
const TITLE_SIMILARITY = 0.5;

// 대행·헤드헌팅 업체가 올린 공고는 제목 앞 [기관명]이 실제 기관
const AGENCY = /파견|도급|대행|헤드헌팅|커리어넷|휴머니스트|에이치알스탭|맨파워|벤처피플|커리어하이/;

function clean(value: string): string {
  return value.normalize('NFKC').toLowerCase()
    .replace(/\(주\)|㈜|\(재\)|\(사\)|주식회사|재단법인|사단법인/g, '')
    .replace(/[가-힣]+그룹/g, '')
    .replace(/[^가-힣a-z0-9]/g, '');
}

export function actualOrganization(posting: Pick<JobPosting, 'title' | 'organization'>): string {
  const bracket = posting.title.match(/^\s*\[([^\]]+)\]/)?.[1];
  if (bracket && (AGENCY.test(posting.organization || '') || !posting.organization)) return clean(bracket);
  return clean(posting.organization || '');
}

function titleCore(title: string, org: string): string {
  let core = clean(title).replace(/20\d{2}년?/g, '').replace(/제?\d+(차|회)/g, '').replace(/재공고|공고|모집|채용|접수전|접수중/g, '');
  if (org) core = core.split(org).join('');
  return core;
}

function bigrams(value: string): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < value.length - 1; i++) out.add(value.slice(i, i + 2));
  return out;
}

function overlap(a: string, b: string): { shared: number; a: number; b: number } {
  const A = bigrams(a), B = bigrams(b);
  let shared = 0;
  for (const x of A) if (B.has(x)) shared++;
  return { shared, a: A.size, b: B.size };
}

// 짧은 쪽 제목이 얼마나 들어 있는지 (포털 제목은 원문보다 길거나 짧게 바뀌는 경우가 많음)
function containment(a: string, b: string): number {
  const o = overlap(a, b);
  return o.a && o.b ? o.shared / Math.min(o.a, o.b) : 0;
}

function dice(a: string, b: string): number {
  const o = overlap(a, b);
  return o.a + o.b ? (2 * o.shared) / (o.a + o.b) : 0;
}

// 괄호 안 직무·직급(예: "일반운영직 - 방호"). 같은 차수의 다른 직무를 구분하는 데 사용
function roleText(title: string): string {
  return clean([...title.matchAll(/\(([^)]*)\)/g)].map(m => m[1]).join(' '));
}

// 날짜 필드가 비어 있으면 제목에 붙은 접수기간 날짜를 사용 (예: namuk "…D-8 2026.10.27 ~ 2026.11.03")
function postedDay(p: JobPosting): number | null {
  const fromTitle = p.title.match(/(20\d{2})[.\-/]\s?(\d{1,2})[.\-/]\s?(\d{1,2})/);
  const value = p.postedAt || p.regDate || p.applicationStartAt
    || (fromTitle ? `${fromTitle[1]}-${fromTitle[2].padStart(2, '0')}-${fromTitle[3].padStart(2, '0')}` : '');
  const at = value ? Date.parse(value.slice(0, 10)) : NaN;
  return Number.isFinite(at) ? at : null;
}

function titleYear(title: string): string | null {
  return title.match(/(20\d{2})\s*년/)?.[1] || null;
}

// "경기도"·"서울특별시" 같은 짧은 지역명이 "경기도의료원" 등에 부분 일치하지 않도록 4자 이상일 때만 포함 관계 허용
const MIN_ORG_SUBSTRING = 4;
// "제3회 직원 채용 공고"처럼 핵심어가 거의 없는 제목은 한두 글자 겹침으로 같은 공고가 되지 않게 함
const MIN_CORE_BIGRAMS = 3;
// 날짜 없이 제목 일치만으로 같은 공고로 볼 때의 최소 길이(정리 후 글자 수). "직원 채용 공고" 같은 일반 제목 배제
const MIN_EXACT_TITLE = 12;

function sameOrganization(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= MIN_ORG_SUBSTRING && long.includes(short);
}

/** 같은 공고로 보이면 0보다 큰 유사도, 아니면 0 */
export function matchScore(secondary: JobPosting, original: JobPosting): number {
  const orgA = actualOrganization(secondary), orgB = actualOrganization(original);
  // 앞의 [기관명]과 끝의 마감 표기 "(11.6 금)"를 뺀 제목이 충분히 길고 완전히 같으면, 기관이 맞고 날짜가 어긋나지
  // 않는 한(한쪽이라도 날짜가 없거나 기간 안) 같은 공고로 본다. 날짜 없는 포털 사본끼리의 중복을 잡기 위한 규칙.
  const exact = (t: string) => clean(t.replace(/^\s*\[[^\]]+\]\s*/, '').replace(/\(\d{1,2}\.\s*\d{1,2}\.?\s*[월화수목금토일]\)\s*$/, ''));
  const named = (org: string, title: string) => org.length >= MIN_ORG_SUBSTRING && clean(title).includes(org);
  if (exact(secondary.title).length >= MIN_EXACT_TITLE && exact(secondary.title) === exact(original.title)
    && (sameOrganization(orgA, orgB) || named(orgA, original.title) || named(orgB, secondary.title))) {
    const a = postedDay(secondary), b = postedDay(original);
    if (a === null || b === null || Math.abs(a - b) <= DATE_WINDOW_DAYS * 86400000) return 1;
  }
  // 포털이 상위 기관(예: 서울특별시 서대문구)을 기관명으로 적어도, 제목에 원 출처 기관명이 있으면 같은 기관으로 본다
  const namedInTitle = orgB.length >= MIN_ORG_SUBSTRING && clean(secondary.title).includes(orgB);
  if (!sameOrganization(orgA, orgB) && !namedInTitle) return 0;
  // 날짜를 모르면 연도 없는 제목만으로는 회차를 구분할 수 없으므로 같은 공고로 보지 않음
  const a = postedDay(secondary), b = postedDay(original);
  if (a === null || b === null || Math.abs(a - b) > DATE_WINDOW_DAYS * 86400000) return 0;
  const yearA = titleYear(secondary.title), yearB = titleYear(original.title);
  if (yearA && yearB && yearA !== yearB) return 0;
  const roleA = roleText(secondary.title), roleB = roleText(original.title);
  if (roleA && roleB && dice(roleA, roleB) < TITLE_SIMILARITY) return 0;
  const coreA = titleCore(secondary.title, orgA), coreB = titleCore(original.title, orgB);
  if (Math.min(bigrams(coreA).size, bigrams(coreB).size) < MIN_CORE_BIGRAMS) return 0;
  const score = containment(coreA, coreB);
  return score >= TITLE_SIMILARITY ? score : 0;
}

export function isSamePosting(secondary: JobPosting, original: JobPosting): boolean {
  return matchScore(secondary, original) > 0;
}

/** 2차 출처 결과에서 원 출처(현재+보존 공고)와 겹치는 공고를 제거하고 제거 내역을 결과에 남긴다. */
export function dropSecondaryDuplicates(results: CrawlResult[]): CrawlResult[] {
  // 비교 대상: 원 출처 전체 + 우선순위가 앞선 포털에서 이미 남긴 공고
  const kept = results.filter(r => !SECONDARY_SOURCE_IDS.has(r.site.id))
    .flatMap(r => r.postings.map(p => ({ siteId: r.site.id, posting: p })));
  const cleaned = new Map<string, CrawlResult>();
  for (const id of SECONDARY_SOURCE_PRIORITY) {
    const result = results.find(r => r.site.id === id);
    if (!result) continue;
    const next = dropAgainst(result, kept);
    cleaned.set(id, next);
    kept.push(...next.postings.map(p => ({ siteId: id, posting: p })));
  }
  return results.map(r => cleaned.get(r.site.id) || r);
}

function dropAgainst(result: CrawlResult, originals: { siteId: string; posting: JobPosting }[]): CrawlResult {
  const removed: NonNullable<CrawlResult['secondaryDuplicates']> = [];
  const postings = result.postings.filter(p => {
    let match: (typeof originals)[number] | undefined, best = 0;
    for (const o of originals) {
      const score = matchScore(p, o.posting);
      if (score > best) { best = score; match = o; }
    }
    if (match) removed.push({ title: p.title, matchedSiteId: match.siteId, matchedTitle: match.posting.title });
    return !match;
  });
  return { ...result, postings, secondaryDuplicates: removed };
}
