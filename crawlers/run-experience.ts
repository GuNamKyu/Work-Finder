// 직무경험 공고 크롤러 실행 스크립트
// (자원봉사/직업훈련 공고 수집 → experience-results.json 출력)
// crawlSite 미사용 - 노이즈 필터 우회, 시그니처 독립 유지
import { chromium, type Browser, type Page } from 'playwright';
import type { CrawlResult, SiteConfig, JobPosting } from './types';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFile } from 'fs/promises';
import { enrichPosting } from './opportunity.js';

import * as csvCulture from './sites/experience/csv-culture';
import * as portal1365 from './sites/experience/1365';
import * as museumNotice from './sites/experience/museum-notice';

const __dirname = dirname(fileURLToPath(import.meta.url));

type ExpScraper = (page: Page) => Promise<JobPosting[]>;

const sites: [SiteConfig, ExpScraper][] = [
  [csvCulture.config, csvCulture.scrape],
  [portal1365.config, portal1365.scrape],
  [museumNotice.config, museumNotice.scrape],
];

const SITE_TIMEOUT_MS = 120_000;

async function crawlExperience(
  browser: Browser,
  config: SiteConfig,
  scraper: ExpScraper,
): Promise<CrawlResult> {
  const crawledAt = new Date().toISOString();
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    locale: 'ko-KR',
  });
  const page = await context.newPage();

  const run = async (): Promise<CrawlResult> => {
    try {
      const postings = (await scraper(page))
        .map(p => enrichPosting({ ...p, postingType: 'experience' }, config.id))
        .filter(p => p.lifecycleStatus !== 'closed');
      return { site: config, postings, crawledAt };
    } catch (err: any) {
      return { site: config, postings: [], crawledAt, error: err?.message || 'Unknown error' };
    } finally {
      await context.close().catch(() => {});
    }
  };

  const timeoutPromise = new Promise<CrawlResult>((_, reject) =>
    setTimeout(() => reject(new Error(`타임아웃 (${SITE_TIMEOUT_MS / 1000}초 초과)`)), SITE_TIMEOUT_MS)
  );

  return Promise.race([run(), timeoutPromise]).catch((err: any) => ({
    site: config,
    postings: [],
    crawledAt,
    error: err?.message || 'Unknown error',
  }));
}

async function main() {
  const startTime = Date.now();
  const targetId = process.argv[2];

  console.log('=== 직무경험 공고 크롤러 시작 ===');
  console.log(`대상: ${targetId || '전체'} (총 ${sites.length}개 소스)`);
  console.log(`실행 시각: ${new Date().toLocaleString('ko-KR')}\n`);

  const filteredSites = targetId
    ? sites.filter(([c]) => c.id === targetId)
    : sites;

  if (filteredSites.length === 0) {
    console.error(`ID '${targetId}' 를 찾을 수 없습니다.`);
    console.log('사용 가능한 ID:', sites.map(([c]) => c.id).join(', '));
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const results: CrawlResult[] = [];

  for (const [config, scraper] of filteredSites) {
    console.log(`[${config.id}] ${config.name} 크롤링 중...`);
    const result = await crawlExperience(browser, config, scraper);
    results.push(result);

    if (result.error) {
      console.log(`  ❌ 에러: ${result.error}`);
    } else {
      console.log(`  ✅ ${result.postings.length}개 공고 발견`);
      for (const p of result.postings.slice(0, 3)) {
        console.log(`     - ${p.title} (${p.regDate})`);
      }
      if (result.postings.length > 3) {
        console.log(`     ... 외 ${result.postings.length - 3}개`);
      }
    }
  }

  await browser.close();

  const outputPath = join(__dirname, 'experience-results.json');
  await writeFile(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n결과 저장: ${outputPath}`);

  const totalPostings = results.reduce((sum, r) => sum + r.postings.length, 0);
  const successCount = results.filter(r => !r.error).length;
  const errorCount = results.filter(r => r.error).length;
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n=== 크롤링 요약 ===');
  console.log(`성공: ${successCount}개 소스`);
  console.log(`실패: ${errorCount}개 소스`);
  console.log(`총 공고: ${totalPostings}건`);
  console.log(`소요 시간: ${elapsed}초`);
}

main().catch(console.error);
