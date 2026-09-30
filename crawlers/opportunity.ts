import { createHash } from 'crypto';
import type {
  ExperienceType,
  EligibilityStatus,
  FitBreakdown,
  JobPosting,
  LifecycleStatus,
  RelevanceTier,
  ScheduleEvent,
} from './types.js';

const DAY_MS = 86_400_000;
const ROLE_KEYWORDS = ['학예', '큐레이터', '박물관', '미술관', '문화재', '국가유산', '자연유산', '문화예술', '문화관광', '유물', '전시', '아카이브', '기록', '고고', '민속', '정책연구'];
const GAP_KEYWORDS = ['소장품', '수장고', '등록', 'DB', '데이터베이스', '자료관리', '유물관리', '보존', '수집'];
const RELATED_KEYWORDS = ['문화', '역사', '교육', '해설', '조사', '연구', '콘텐츠', '행정'];
const QUALITY_KEYWORDS = ['정규직', '무기계약', '경력인정', '멘토링', '실무', '프로젝트', '인턴', '일경험'];
const NEGATIVE_KEYWORDS = ['운전원', '조리원', '미화', '시설관리', '경비', '청소'];
const TITLE_TARGET_KEYWORDS = ['학예', '큐레이터', '박물관', '미술관', '문화재', '국가유산', '자연유산', '문화예술', '문화관광', '유물', '소장품', '수장고', '전시', '아카이브', '기록관리', '고고', '민속', '정책연구'];
const CULTURAL_ORG_KEYWORDS = ['박물관', '미술관', '기념관', '문화재단', '문화원', '문화예술', '문화유산'];
const NON_TARGET_JOB_KEYWORDS = ['운전원', '조리원', '조리사', '미화', '시설관리', '시설관리원', '경비', '청소원', '청소직', '청소업무', '환경미화'];
const SCHOOL_KEYWORDS = ['학교', '교육청', '유치원', '초등학교', '중학교', '고등학교'];
const TEACHER_KEYWORDS = ['기간제교사', '기간제교원', '교사', '교원', '담임', '교과전담'];
const ADMIN_NOTICE_PATTERNS = [
  /최종\s*합격/, /서류(?:전형)?\s*(?:합격|결과)/, /면접(?:전형)?\s*(?:대상|결과|일정)/,
  /채용\s*(?:결과|합격자)/, /합격자\s*(?:발표|공고)/, /임용\s*(?:결과|후보)/,
  /채용기준\s*사전\s*공개/, /채용.*(?:면접심사|대면심사)\s*공고/,
];
const INELIGIBLE_TITLE_PATTERNS = [
  /(?:상임|대표|비상임)?\s*이사/, /본부장/, /관장/, /사장/, /임원/, /상임\s*감사/, /비상임\s*감사/,
  /고위공직자/, /개방형\s*직위/, /공모\s*직위/, /박사(?:학위)?\s*(?:소지|이상|필수)/,
  /(?:7|8|9|10)\s*년\s*이상.*경력|경력.*(?:7|8|9|10)\s*년\s*이상/,
];
const REVIEW_TITLE_PATTERNS = [
  /경력직/, /경력\s*\d+\s*년/, /석사(?:학위)?\s*(?:소지|이상|필수)/, /자격증?\s*(?:소지|필수)/,
  /선임/, /책임/, /수석/, /팀장/, /실장/, /부장/,
];
const ENTRY_TITLE_PATTERNS = [/신입/, /경력\s*무관/, /학예\s*보조/, /업무\s*보조/, /인턴/, /일경험/];

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
  const todayKey = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  const today = parseDate(todayKey)!;
  const deadline = parseDate(posting.applicationEndAt || posting.deadlineDate);
  const posted = parseDate(posting.postedAt || posting.regDate);

  if (/^(마감|종료|모집완료|접수완료|closed)$/i.test(posting.status || '') || (deadline && (posting.applicationEndAt || posting.deadlineDate || '') < todayKey)) return 'closed';
  if (posting.recordKind !== 'program_info' && posting.status === '상태 미확인') return 'stale_unknown';
  if (/상시|수시|채용시|충원시|rolling/i.test(text)) return 'rolling';
  if (posted && today.getTime() - posted.getTime() > 31 * DAY_MS) {
    return (deadline && deadline >= today) || /^(모집중|접수중)$/.test(posting.status || '') ? 'active_long' : 'stale_unknown';
  }
  return 'fresh';
}

function keywordScore(text: string, keywords: string[], max: number): { score: number; hits: string[] } {
  const hits = keywords.filter(k => text.includes(k.toLowerCase()));
  return { score: Math.min(max, hits.length * Math.max(4, Math.ceil(max / 3))), hits };
}

function keywordHits(text: string, keywords: string[]): string[] {
  const normalized = text.toLowerCase();
  return keywords.filter(keyword => normalized.includes(keyword.toLowerCase()));
}

/**
 * 수집·이력 보존 여부와 사용자 노출 여부를 분리한다.
 * 저적합 항목과 합격/면접 결과 같은 후속 공지는 원자료에 남기되 기본 화면과 알림에는 노출하지 않는다.
 */
export function classifyRelevance(posting: JobPosting): {
  tier: RelevanceTier;
  visible: boolean;
  reasons: string[];
} {
  const title = posting.title || '';
  const organization = posting.organization || '';
  const titleTargets = keywordHits(title, TITLE_TARGET_KEYWORDS);
  const culturalOrganizations = keywordHits(organization, CULTURAL_ORG_KEYWORDS);
  const nonTargetJobs = keywordHits(title, NON_TARGET_JOB_KEYWORDS);
  const schoolContext = keywordHits(`${title} ${organization}`, SCHOOL_KEYWORDS);
  const teacherJobs = keywordHits(title, TEACHER_KEYWORDS);

  if ((posting.eligibilityStatus || assessEligibility(posting).status) === 'ineligible') {
    return { tier: 'low_relevance', visible: false, reasons: ['지원 불가 가능성이 높은 직급·필수요건'] };
  }

  if (ADMIN_NOTICE_PATTERNS.some(pattern => pattern.test(title))) {
    return { tier: 'administrative_notice', visible: false, reasons: ['채용 기회가 아닌 전형 결과·후속 공지'] };
  }
  if (posting.postingType !== 'experience' && (!/채용|구인|임용|모집|인력|근로|직원|연구원|학예사/.test(title) || /참여\s*기관\s*모집|유아\s*교육|어린이\s*교육/.test(title))) {
    return { tier: 'administrative_notice', visible: false, reasons: ['채용 모집이 아닌 전시·관람·교육 안내'] };
  }

  if (nonTargetJobs.length > 0) {
    return { tier: 'low_relevance', visible: false, reasons: [`비대상 직무: ${nonTargetJobs.join(', ')}`] };
  }

  if (schoolContext.length > 0 && teacherJobs.length > 0) {
    return { tier: 'low_relevance', visible: false, reasons: [`학교 교원 채용: ${teacherJobs.slice(0, 2).join(', ')}`] };
  }

  // 1차 제외 관문을 통과한 뒤 제목에 명확한 목표 직무가 있으면 목표 기회로 분류한다.
  if (titleTargets.length > 0) {
    return { tier: 'target', visible: true, reasons: [`목표 직무·분야: ${titleTargets.slice(0, 3).join(', ')}`] };
  }

  if (posting.postingType === 'experience') {
    if (posting.recordKind === 'program_info' || /counseling|financial_support|fair|recurring_program/.test(posting.experienceType || '')) {
      return { tier: 'adjacent', visible: true, reasons: ['취업지원 사업 — 대상·모집기간 별도 확인'] };
    }
    const role = `${title} ${posting.roleText || ''} ${organization}`;
    if (/박물관|미술관|학예|문화|유산|기록|전시|아카이브/.test(role)) return { tier: 'target', visible: true, reasons: ['목표 분야 직무경험'] };
    if (/경영|사무|공공행정|취업지원/.test(role) && /서울|경기|인천|전국|온라인/.test(posting.region || '')) return { tier: 'adjacent', visible: true, reasons: ['수도권 사무·행정 경험 — 학예 경력인정은 미확인'] };
    return { tier: 'low_relevance', visible: false, reasons: ['목표 분야 또는 수도권 인접 직무경험에 해당하지 않음'] };
  }

  if (culturalOrganizations.length > 0) {
    return { tier: 'adjacent', visible: true, reasons: [`문화기관 공고: ${culturalOrganizations.slice(0, 2).join(', ')}`] };
  }

  const relatedHits = keywordHits(`${title} ${organization}`, RELATED_KEYWORDS);
  if (relatedHits.length > 0 && (posting.fitScore || 0) >= 40) {
    return { tier: 'adjacent', visible: true, reasons: [`인접 분야: ${relatedHits.slice(0, 3).join(', ')}`] };
  }

  return { tier: 'low_relevance', visible: false, reasons: ['목표 직무·문화기관 관련성이 충분하지 않음'] };
}

export function isUserVisiblePosting(posting: JobPosting): boolean {
  return posting.userVisible ?? classifyRelevance(posting).visible;
}

export function assessEligibility(posting: JobPosting): {
  status: EligibilityStatus;
  score: number;
  reasons: string[];
} {
  const text = `${posting.title || ''} ${posting.status || ''}`;
  const ineligible = INELIGIBLE_TITLE_PATTERNS.find(pattern => pattern.test(text));
  if (ineligible) {
    return { status: 'ineligible', score: 0, reasons: ['임원·고위직 또는 충족하기 어려운 필수 경력·학위 신호'] };
  }
  const review = REVIEW_TITLE_PATTERNS.find(pattern => pattern.test(text));
  if (review) {
    return { status: 'needs_review', score: 6, reasons: ['경력·학위·자격요건 상세 확인 필요'] };
  }
  if (ENTRY_TITLE_PATTERNS.some(pattern => pattern.test(text))) {
    return { status: 'likely_eligible', score: 18, reasons: ['신입·보조·인턴 등 지원 가능 신호'] };
  }
  return { status: 'unknown', score: 10, reasons: ['목록만으로 지원요건을 확인할 수 없음'] };
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
  const eligibility = assessEligibility(posting).score;
  const location = /구리|남양주|서울|경기/.test(text) ? 12 : 7;
  const qualityScore = Math.max(3, quality.score);
  const breakdown = { roleField, gapFill, eligibility, location, quality: qualityScore };
  const score = Math.max(0, Math.min(100, Object.values(breakdown).reduce((a, b) => a + b, 0)));
  const reasons = [
    role.hits.length ? `직무·분야: ${role.hits.slice(0, 3).join(', ')}` : '',
    gap.hits.length ? `보완 역량: ${gap.hits.slice(0, 3).join(', ')}` : '',
    quality.hits.length ? `기회 품질: ${quality.hits.slice(0, 2).join(', ')}` : '',
    ...assessEligibility(posting).reasons,
    negativeHits.length ? `직무 불일치 신호: ${negativeHits.join(', ')}` : '',
  ].filter(Boolean);
  return { score, breakdown, reasons };
}

export function calculateUrgency(posting: JobPosting, now = new Date()): number {
  const deadline = parseDate(posting.applicationEndAt || posting.deadlineDate);
  if (!deadline) return classifyLifecycle(posting, now) === 'rolling' ? 25 : 40;
  const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  const days = Math.round((Date.parse(`${(posting.applicationEndAt || posting.deadlineDate)!.slice(0, 10)}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
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
  const applicationStartAt = posting.applicationStartAt || null;
  const applicationEndAt = posting.applicationEndAt || posting.deadlineDate || null;
  const postedAt = posting.postedAt !== undefined ? posting.postedAt : posting.regDate || null;
  const events = [...(posting.scheduleEvents || [])];
  if (postedAt) addEvent(events, { type: 'posted', date: postedAt, label: '등록', source: 'list', precision: 'exact', confidence: 0.9 });
  if (applicationStartAt) addEvent(events, { type: 'application_start', date: applicationStartAt, label: '접수 시작', source: 'list', precision: 'exact', confidence: 0.9 });
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
  const eligibility = assessEligibility(partial);
  partial.stableId = stablePostingId(siteId, partial);
  partial.lifecycleStatus = classifyLifecycle(partial, now);
  partial.fitScore = fit.score;
  partial.fitBreakdown = fit.breakdown;
  partial.fitReasons = fit.reasons;
  partial.urgencyScore = calculateUrgency(partial, now);
  partial.eligibilityStatus = eligibility.status;
  partial.eligibilityReasons = eligibility.reasons;
  const relevance = classifyRelevance(partial);
  partial.relevanceTier = relevance.tier;
  partial.relevanceReasons = relevance.reasons;
  partial.userVisible = relevance.visible;
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
