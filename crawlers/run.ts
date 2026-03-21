// 전체 크롤러 실행 스크립트
import { chromium } from 'playwright';
import { crawlSite } from './base';
import type { CrawlResult, SiteConfig, SiteScraper } from './types';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFile } from 'fs/promises';

// 개별 사이트 모듈 임포트
import * as museumGoKr from './sites/museum-go-kr';
import * as gogung from './sites/gogung';
import * as nrich from './sites/nrich';
import * as nfm from './sites/nfm';
import * as ncs from './sites/ncs';
import * as much from './sites/much';
import * as gmuseum from './sites/gmuseum';
import * as hangeul from './sites/hangeul';
import * as gojobs from './sites/gojobs';
import * as kaah from './sites/kaah';
import * as khs from './sites/khs';
import * as cha from './sites/cha';
import * as museumSeoul from './sites/museum-seoul';
import * as baekje from './sites/baekje';
import * as craftmuseum from './sites/craftmuseum';
import * as yongsan from './sites/yongsan';
import * as epMuseum from './sites/ep-museum';
import * as namuSdm from './sites/namu-sdm';
import * as warmemo from './sites/warmemo';
import * as nmkpg from './sites/nmkpg';
import * as kimkoo from './sites/kimkoo';
import * as seosomun from './sites/seosomun';
import * as jfac from './sites/jfac';
import * as ggcf from './sites/ggcf';
import * as bcmuseum from './sites/bcmuseum';
import * as nyj from './sites/nyj';
import * as hnart from './sites/hnart';
import * as hsmuseum from './sites/hsmuseum';
import * as anseong from './sites/anseong';
import * as artic from './sites/artic';
import * as ddc from './sites/ddc';
import * as historySeooul from './sites/history-seoul';
import * as gojobsWd from './sites/gojobs-wd';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 사이트 레지스트리: [config, scraper]
const sites: [SiteConfig, SiteScraper][] = [
  [museumGoKr.config, museumGoKr.scrape],
  [gogung.config, gogung.scrape],
  [nrich.config, nrich.scrape],
  [nfm.config, nfm.scrape],
  [ncs.config, ncs.scrape],
  [much.config, much.scrape],
  [gmuseum.config, gmuseum.scrape],
  [hangeul.config, hangeul.scrape],
  [gojobs.config, gojobs.scrape],
  [kaah.config, kaah.scrape],
  [khs.config, khs.scrape],
  [museumSeoul.config, museumSeoul.scrape],
  [baekje.config, baekje.scrape],
  [craftmuseum.config, craftmuseum.scrape],
  [yongsan.config, yongsan.scrape],
  [epMuseum.config, epMuseum.scrape],
  [namuSdm.config, namuSdm.scrape],
  [warmemo.config, warmemo.scrape],
  [nmkpg.config, nmkpg.scrape],
  [kimkoo.config, kimkoo.scrape],
  [seosomun.config, seosomun.scrape],
  [jfac.config, jfac.scrape],
  [cha.config, cha.scrape],
  // ggcf 계열 6곳
  ...ggcf.configs.map(c => [c, ggcf.scrape] as [SiteConfig, SiteScraper]),
  [bcmuseum.config, bcmuseum.scrape],
  [nyj.config, nyj.scrape],
  [hnart.config, hnart.scrape],
  [hsmuseum.config, hsmuseum.scrape],
  [anseong.config, anseong.scrape],
  [artic.config, artic.scrape],
  [ddc.config, ddc.scrape],
  [historySeooul.config, historySeooul.scrape],
  [gojobsWd.config, gojobsWd.scrape],
];

async function main() {
  const startTime = Date.now();
  const targetId = process.argv[2]; // 특정 사이트만 실행: npx tsx run.ts museum-go-kr

  console.log('=== Work-Finder 크롤러 시작 ===');
  console.log(`대상 사이트: ${targetId || '전체'} (총 ${sites.length}개)`);
  console.log(`실행 시각: ${new Date().toLocaleString('ko-KR')}\n`);

  const browser = await chromium.launch({ headless: true });
  const results: CrawlResult[] = [];

  const filteredSites = targetId
    ? sites.filter(([config]) => config.id === targetId)
    : sites;

  if (filteredSites.length === 0) {
    console.error(`사이트 ID '${targetId}' 를 찾을 수 없습니다.`);
    console.log('사용 가능한 ID:', sites.map(([c]) => c.id).join(', '));
    await browser.close();
    process.exit(1);
  }

  // 순차 실행 (사이트 부하 방지)
  for (const [config, scraper] of filteredSites) {
    console.log(`[${config.id}] ${config.name} 크롤링 중...`);
    try {
      const result = await crawlSite(browser, config, scraper);
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
    } catch (error: any) {
      console.log(`  ❌ 크롤링 실패: ${error?.message}`);
      results.push({
        site: config,
        postings: [],
        crawledAt: new Date().toISOString(),
        error: error?.message,
      });
    }
  }

  await browser.close();

  // 결과 저장
  const outputPath = join(__dirname, 'results.json');
  await writeFile(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n결과 저장: ${outputPath}`);

  // 요약
  const totalPostings = results.reduce((sum, r) => sum + r.postings.length, 0);
  const successCount = results.filter(r => !r.error).length;
  const errorCount = results.filter(r => r.error).length;
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n=== 크롤링 요약 ===');
  console.log(`성공: ${successCount}개 사이트`);
  console.log(`실패: ${errorCount}개 사이트`);
  console.log(`총 공고: ${totalPostings}건`);
  console.log(`소요 시간: ${elapsed}초`);

  if (errorCount > 0) {
    console.log('\n실패 사이트:');
    for (const r of results.filter(r => r.error)) {
      console.log(`  - ${r.site.name}: ${r.error}`);
    }
  }
}

main().catch(console.error);
