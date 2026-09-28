// 직무경험 공고 크롤러 실행 스크립트
// (자원봉사/직업훈련 공고 수집 → experience-results.json 출력)
// 채용과 동일하게 제외 키워드를 최우선 적용한다.
import { chromium, type Browser, type Page } from 'playwright';
import type { CrawlResult, SiteConfig, JobPosting } from './types';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFile, mkdir } from 'fs/promises';
import { enrichPosting } from './opportunity.js';
import { passesExclusions } from './base.js';
import { enrichDetailDates } from './detail-dates.js';
import { saveResilientResults } from './resilience.js';
import { PartialCrawlError } from './partial-crawl.js';

import * as csvCulture from './sites/experience/csv-culture';
import * as portal1365 from './sites/experience/1365';
import * as museumNotice from './sites/experience/museum-notice';
import * as work24Youth from './sites/experience/work24-youth.js';
import * as gjfYouth from './sites/experience/gjf-youth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

type ExpScraper = (page: Page) => Promise<JobPosting[]>;

const sites: [SiteConfig, ExpScraper][] = [
  [work24Youth.config, work24Youth.scrape],
  [gjfYouth.config, gjfYouth.scrape],
  [csvCulture.config, csvCulture.scrape],
  [portal1365.config, portal1365.scrape],
  [museumNotice.config, museumNotice.scrape],
];

const SITE_TIMEOUT_MS = 180_000;

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
  let collected: JobPosting[] = [];

  const run = async (): Promise<CrawlResult> => {
    try {
      let collectionError: string | undefined;
      try { collected = await scraper(page); }
      catch (err) {
        if (!(err instanceof PartialCrawlError)) throw err;
        collected = err.postings; collectionError = err.message;
      }
      collected = collected.filter(p => passesExclusions(p, 'experience'));
      const dated = await enrichDetailDates(page, collected);
      const postings = dated
        .map(p => enrichPosting({ ...p, postingType: 'experience', experienceType: p.experienceType || 'volunteer' }, config.id))
        .filter(p => collectionError || p.lifecycleStatus !== 'closed');
      const unresolved = postings.filter(p => p.detailWarning).length;
      return { site: config, postings, crawledAt, error: collectionError, warnings: unresolved ? [`${unresolved}건의 상세 접수기간 미확인 (공고별 detailWarning 참고)`] : [] };
    } catch (err: any) {
      return { site: config, postings: collected.map(p => enrichPosting({ ...p, postingType: 'experience', experienceType: p.experienceType || 'volunteer' }, config.id)), crawledAt, error: err?.message || 'Unknown error' };
    } finally {
      await context.close().catch(() => {});
    }
  };

  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<CrawlResult>((_, reject) =>
    timer = setTimeout(() => reject(new Error(`타임아웃 (${SITE_TIMEOUT_MS / 1000}초 초과)`)), SITE_TIMEOUT_MS)
  );

  return Promise.race([run(), timeoutPromise]).catch((err: any) => ({
    site: config,
    postings: collected.map(p => enrichPosting({ ...p, postingType: 'experience', experienceType: p.experienceType || 'volunteer' }, config.id)),
    crawledAt,
    error: err?.message || 'Unknown error',
  })).finally(async () => { clearTimeout(timer); await context.close().catch(() => {}); });
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
  const saved = await saveResilientResults(outputPath, results);
  console.log(`이전 정상 결과 보존: ${saved.reduce((n, r) => n + (r.retainedCount || 0), 0)}건 (실패 상태는 유지)`);
  if (!targetId) {
    await mkdir(join(__dirname, '..', 'data'), { recursive: true });
    await writeFile(join(__dirname, '..', 'data', 'program-catalog.json'), JSON.stringify({
      checkedAt: new Date().toISOString(),
      note: '사업 안내이며 현재 모집 중임을 보장하지 않음. 운영기간과 접수기간을 분리한다.',
      programs: saved.flatMap(r => r.postings.filter(p => p.recordKind === 'program_info').map(p => ({ ...p, siteId: r.site.id }))),
    }, null, 2));
  }
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

main().catch(error => { console.error(error); process.exitCode = 1; });
