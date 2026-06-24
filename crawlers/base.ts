import { chromium, type Page, type Browser } from 'playwright';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { SiteConfig, CrawlResult, JobPosting, SiteScraper } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

function loadKeywords(filename: string): string[] {
  const content = readFileSync(join(rootDir, filename), 'utf-8');
  return content.split('\n').map(l => l.trim()).filter(Boolean);
}

export async function launchBrowser(): Promise<Browser> {
  return chromium.launch({ headless: true });
}

export async function crawlSite(
  browser: Browser,
  config: SiteConfig,
  scraper: SiteScraper,
  timeoutMs = 30000,
  siteTimeoutMs = 90000
): Promise<CrawlResult> {
  const run = async (): Promise<CrawlResult> => {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      locale: 'ko-KR',
    });
    const page = await context.newPage();

    try {
      // goto 실패 시 최대 2회 재시도 (ERR_CONNECTION_RESET 등 일시적 오류 대비)
      let lastError: Error | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          if (attempt > 0) await page.waitForTimeout(2000 * attempt);
          await page.goto(config.url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
          lastError = null;
          break;
        } catch (e: any) {
          lastError = e;
          if (attempt < 2) console.log(`  ⚠️ [${config.id}] 연결 실패, 재시도 ${attempt + 1}/2...`);
        }
      }
      if (lastError) throw lastError;

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
  };

  // 사이트당 최대 실행 시간 제한
  const timeoutPromise = new Promise<CrawlResult>((_, reject) =>
    setTimeout(() => reject(new Error(`사이트 타임아웃 (${siteTimeoutMs / 1000}초 초과)`)), siteTimeoutMs)
  );

  return Promise.race([run(), timeoutPromise]).catch((err: any) => ({
    site: config,
    postings: [],
    crawledAt: new Date().toISOString(),
    error: err?.message || 'Unknown error',
  }));
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

/** 채용과 무관한 노이즈 키워드 (noise-keywords.txt에서 로드) */
export const NOISE_KEYWORDS = loadKeywords('noise-keywords.txt');

/** 노이즈 키워드가 포함된 공고를 필터링 (제목 기준) */
export function isJobPosting(title: string): boolean {
  return !NOISE_KEYWORDS.some(kw => title.includes(kw));
}

/** 기관명에 노이즈 키워드가 포함되어 있는지 확인 */
export function isNoiseOrganization(org: string): boolean {
  return NOISE_KEYWORDS.some(kw => org.includes(kw));
}

/** 등록일이 1개월 이내인지 확인 (YYYY-MM-DD 형식 기준, 파싱 불가 시 true 반환) */
export function isWithinOneMonth(regDate: string): boolean {
  const match = regDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return true; // 날짜 파싱 불가 → 유지
  const postDate = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  return postDate >= oneMonthAgo;
}

/** 공고 목록에서 채용과 무관한 항목 및 1개월 초과 공고 제거 */
export function filterJobPostings(postings: JobPosting[]): JobPosting[] {
  return postings.filter(p =>
    isJobPosting(p.title) && !isNoiseOrganization(p.organization) && isWithinOneMonth(p.regDate)
  );
}
