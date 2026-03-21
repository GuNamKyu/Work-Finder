import { chromium, type Page, type Browser } from 'playwright';
import type { SiteConfig, CrawlResult, JobPosting, SiteScraper } from './types.js';

export async function launchBrowser(): Promise<Browser> {
  return chromium.launch({ headless: true });
}

export async function crawlSite(
  browser: Browser,
  config: SiteConfig,
  scraper: SiteScraper,
  timeoutMs = 30000
): Promise<CrawlResult> {
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    locale: 'ko-KR',
  });
  const page = await context.newPage();

  try {
    await page.goto(config.url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForTimeout(2000);
    const postings = await scraper(page, config);
    return {
      site: config,
      postings: filterJobPostings(postings),
      crawledAt: new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      site: config,
      postings: [],
      crawledAt: new Date().toISOString(),
      error: error?.message || 'Unknown error',
    };
  } finally {
    await context.close();
  }
}

/** 날짜 문자열을 YYYY-MM-DD 형식으로 정규화 */
export function normalizeDate(raw: string): string {
  const cleaned = raw.replace(/\s/g, '').replace(/\./g, '-').replace(/\/$/, '').replace(/-$/, '');
  // YYYY-MM-DD
  const m1 = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m1) return `${m1[1]}-${m1[2].padStart(2, '0')}-${m1[3].padStart(2, '0')}`;
  // YY-MM-DD
  const m2 = cleaned.match(/^(\d{2})-(\d{1,2})-(\d{1,2})/);
  if (m2) return `20${m2[1]}-${m2[2].padStart(2, '0')}-${m2[3].padStart(2, '0')}`;
  return raw.trim();
}

/** 텍스트에서 날짜 추출 */
export function extractDates(text: string): string[] {
  const regex = /(20\d{2}|\d{2})[-./년]\s*(0?[1-9]|1[0-2])[-./월]\s*(0?[1-9]|[12]\d|3[01])일?/g;
  const dates: string[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    let year = parseInt(match[1], 10);
    if (year < 100) year += 2000;
    const month = match[2].padStart(2, '0');
    const day = match[3].padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
  }
  return dates;
}

/** 텍스트를 최대 길이로 잘라내기 */
export function truncate(text: string, maxLen = 80): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  return cleaned.length > maxLen ? cleaned.substring(0, maxLen) + '...' : cleaned;
}

/** 채용공고 관련 키워드 */
const JOB_KEYWORDS = [
  '채용', '모집', '공고', '합격', '인턴', '근로자', '직원',
  '서류전형', '면접', '임용', '경쟁채용', '도슨트', '강사',
  '서포터즈', '인력풀', '보조강사', '교육사', '큐레이터', '학예',
  '연구원', '코디네이터',
];

/** 채용과 무관한 노이즈 키워드 */
const NOISE_KEYWORDS = [
  '운영 안내', '휴관', '주차장', '프로그램 운영', '문화가 있는 날',
  '설연휴', '추석', '여름방학', '시상식', '전시해설', '대관',
  '박물관대학', '미술대전', '번역 자료', '반려동물', '매장유산',
  '자진신고', '전시 및 시상', '일시휴관', '대체공휴일', '견학 방문',
  '무료대관', 'SNS 운영 일정',
];

/** 채용공고 여부를 판별하여 노이즈를 필터링 */
export function isJobPosting(title: string): boolean {
  const hasJob = JOB_KEYWORDS.some(kw => title.includes(kw));
  const hasNoise = NOISE_KEYWORDS.some(kw => title.includes(kw));
  // 노이즈 키워드만 있고 채용 키워드가 없으면 제외
  if (hasNoise && !hasJob) return false;
  // 채용 키워드가 하나도 없으면 제외
  if (!hasJob) return false;
  return true;
}

/** 공고 목록에서 채용과 무관한 항목 제거 */
export function filterJobPostings(postings: JobPosting[]): JobPosting[] {
  return postings.filter(p => isJobPosting(p.title));
}
