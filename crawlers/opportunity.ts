import { createHash } from 'crypto';
import type {
  ExperienceType,
  FitBreakdown,
  JobPosting,
  LifecycleStatus,
  ScheduleEvent,
} from './types.js';

const DAY_MS = 86_400_000;
const ROLE_KEYWORDS = ['학예', '큐레이터', '박물관', '미술관', '문화재', '유물', '전시', '아카이브', '기록', '고고', '민속'];
const GAP_KEYWORDS = ['소장품', '수장고', '등록', 'DB', '데이터베이스', '자료관리', '유물관리', '보존', '수집'];
const RELATED_KEYWORDS = ['문화', '역사', '교육', '해설', '조사', '연구', '콘텐츠', '행정'];
const QUALITY_KEYWORDS = ['정규직', '무기계약', '경력인정', '멘토링', '실무', '프로젝트', '인턴', '일경험'];
const NEGATIVE_KEYWORDS = ['운전원', '조리원', '미화', '시설관리', '경비', '청소'];

function normalizedText(value: string | null | undefined): string {
  return (value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[\[\](){}「」『』【】·_,.\-–—]/g, '');
}

export function normalizedTitle(value: string): string {
  return normalizedText(value)
    .replace(/20\d{2}년?/g, '')
    .replace(/제?\d+차|\d+기|재공고|공고|모집|채용/g, '');
}

export function canonicalizeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    url.hash = '';
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(k => url.searchParams.delete(k));
    [...url.searchParams.keys()]
      .filter(k => /^page(Index|No)?$|^search/i.test(k))
      .forEach(k => url.searchParams.delete(k));
    return url.toString();
  } catch {
    return value.split('#')[0] || null;
  }
}

function shortHash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 20);
}

export function stablePostingId(siteId: string, posting: JobPosting): string {
  if (posting.stableId) return posting.stableId;
  if (posting.postingId) return `${siteId}:id:${posting.postingId}`;
  const canonicalUrl = canonicalizeUrl(posting.canonicalUrl || posting.url);
  if (canonicalUrl) return `${siteId}:url:${shortHash(canonicalUrl)}`;
  const composite = [siteId, normalizedText(posting.organization), normalizedTitle(posting.title), posting.applicationStartAt || posting.regDate || ''].join('|');
  return `${siteId}:composite:${shortHash(composite)}`;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00+09:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function classifyLifecycle(posting: JobPosting, now = new Date()): LifecycleStatus {
  const text = `${posting.status || ''} ${posting.title}`;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const deadline = parseDate(posting.applicationEndAt || posting.deadlineDate);
  const posted = parseDate(posting.postedAt || posting.regDate);

  if (/마감|종료|모집완료|접수완료|closed/i.test(text) || (deadline && deadline < today)) return 'closed';
  if (/상시|수시|채용시|충원시|rolling/i.test(text)) return 'rolling';
  if (posted && today.getTime() - posted.getTime() > 31 * DAY_MS) {
    return deadline && deadline >= today ? 'active_long' : 'stale_unknown';
  }
  return 'fresh';
}

function keywordScore(text: string, keywords: string[], max: number): { score: number; hits: string[] } {
  const hits = keywords.filter(k => text.includes(k.toLowerCase()));
  return { score: Math.min(max, hits.length * Math.max(4, Math.ceil(max / 3))), hits };
}

export function calculateFit(posting: JobPosting): { score: number; breakdown: FitBreakdown; reasons: string[] } {
  const text = `${posting.title} ${posting.organization} ${posting.status || ''}`.toLowerCase();
  const role = keywordScore(text, ROLE_KEYWORDS, 30);
  const related = keywordScore(text, RELATED_KEYWORDS, 30);
  const gap = keywordScore(text, GAP_KEYWORDS, 20);
  const quality = keywordScore(text, QUALITY_KEYWORDS, 10);
  const negativeHits = NEGATIVE_KEYWORDS.filter(k => text.includes(k));

  const roleField = Math.max(0, Math.min(30, role.score + Math.floor(related.score / 3) - negativeHits.length * 12));
  const gapFill = gap.score;
  // 공고 본문의 상세 자격요건이 없는 목록 단계에서는 탈락을 추정하지 않고 중립 점수를 준다.
  const eligibility = /박사|의사|간호사|기사자격|운전면허/.test(text) ? 8 : 18;
  const location = /구리|남양주|서울|경기/.test(text) ? 12 : 7;
  const qualityScore = Math.max(3, quality.score);
  const breakdown = { roleField, gapFill, eligibility, location, quality: qualityScore };
  const score = Math.max(0, Math.min(100, Object.values(breakdown).reduce((a, b) => a + b, 0)));
  const reasons = [
    role.hits.length ? `직무·분야: ${role.hits.slice(0, 3).join(', ')}` : '',
    gap.hits.length ? `보완 역량: ${gap.hits.slice(0, 3).join(', ')}` : '',
    quality.hits.length ? `기회 품질: ${quality.hits.slice(0, 2).join(', ')}` : '',
    negativeHits.length ? `직무 불일치 신호: ${negativeHits.join(', ')}` : '',
  ].filter(Boolean);
  return { score, breakdown, reasons };
}

export function calculateUrgency(posting: JobPosting, now = new Date()): number {
  const deadline = parseDate(posting.applicationEndAt || posting.deadlineDate);
  if (!deadline) return classifyLifecycle(posting, now) === 'rolling' ? 25 : 40;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.ceil((deadline.getTime() - today.getTime()) / DAY_MS);
  if (days <= 1) return 100;
  if (days <= 3) return 90;
  if (days <= 7) return 75;
  if (days <= 14) return 50;
  return 20;
}

export function inferExperienceType(posting: JobPosting): ExperienceType | undefined {
  if (posting.postingType !== 'experience') return undefined;
  const text = `${posting.title} ${posting.status || ''}`;
  if (/인턴/.test(text)) return 'internship';
  if (/미래내일|일경험|현장실습/.test(text)) return 'work_experience';
  if (/봉사/.test(text)) return 'volunteer';
  if (/프로젝트|서포터즈|공모전/.test(text)) return 'project';
  if (/상담|컨설팅|멘토링/.test(text)) return 'counseling';
  if (/교육|훈련|아카데미|과정/.test(text)) return 'training';
  if (/지원금|응시료|수당|비용지원/.test(text)) return 'financial_support';
  if (/박람회|설명회|페어/.test(text)) return 'fair';
  return 'recurring_program';
}

function addEvent(events: ScheduleEvent[], event: ScheduleEvent): void {
  if (!event.date || !/^\d{4}-\d{2}-\d{2}/.test(event.date)) return;
  if (!events.some(e => e.type === event.type && e.date === event.date)) events.push(event);
}

export function enrichPosting(posting: JobPosting, siteId: string, now = new Date()): JobPosting {
  const applicationStartAt = posting.applicationStartAt || (posting.deadlineDate ? posting.regDate || null : null);
  const applicationEndAt = posting.applicationEndAt || posting.deadlineDate || null;
  const postedAt = posting.postedAt || posting.regDate || null;
  const events = [...(posting.scheduleEvents || [])];
  if (postedAt) addEvent(events, { type: 'posted', date: postedAt, label: '등록', source: 'list', precision: 'exact', confidence: 0.9 });
  if (applicationStartAt) addEvent(events, { type: 'application_start', date: applicationStartAt, label: '접수 시작', source: 'inferred', precision: 'exact', confidence: 0.65 });
  if (applicationEndAt) addEvent(events, { type: 'application_end', date: applicationEndAt, label: '접수 마감', source: 'list', precision: 'exact', confidence: 0.9 });
  if (posting.programStartAt) addEvent(events, { type: 'program_start', date: posting.programStartAt, label: '활동 시작', source: 'detail', precision: 'exact', confidence: 0.8 });
  if (posting.programEndAt) addEvent(events, { type: 'program_end', date: posting.programEndAt, label: '활동 종료', source: 'detail', precision: 'exact', confidence: 0.8 });

  const partial: JobPosting = {
    ...posting,
    canonicalUrl: canonicalizeUrl(posting.canonicalUrl || posting.url),
    postedAt,
    applicationStartAt,
    applicationEndAt,
    scheduleEvents: events.sort((a, b) => a.date.localeCompare(b.date)),
    experienceType: posting.experienceType || inferExperienceType(posting),
  };
  const fit = calculateFit(partial);
  partial.stableId = stablePostingId(siteId, partial);
  partial.lifecycleStatus = classifyLifecycle(partial, now);
  partial.fitScore = fit.score;
  partial.fitBreakdown = fit.breakdown;
  partial.fitReasons = fit.reasons;
  partial.urgencyScore = calculateUrgency(partial, now);
  return partial;
}

export function postingFingerprint(posting: JobPosting): string {
  return shortHash(JSON.stringify({
    title: posting.title,
    organization: posting.organization,
    url: canonicalizeUrl(posting.url),
    status: posting.status || '',
    applicationStartAt: posting.applicationStartAt || '',
    applicationEndAt: posting.applicationEndAt || posting.deadlineDate || '',
    programStartAt: posting.programStartAt || '',
    programEndAt: posting.programEndAt || '',
    scheduleEvents: posting.scheduleEvents || [],
  }));
}
