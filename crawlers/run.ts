// 전체 크롤러 실행 스크립트
import { chromium } from 'playwright';
import { crawlSite } from './base';
import { deduplicateResults } from './deduplicate.js';
import type { CrawlResult, SiteConfig, SiteScraper } from './types';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { saveResilientResults } from './resilience.js';

// 개별 사이트 모듈 임포트
import * as museumGoKr from './sites/museum-go-kr';
import * as gogung from './sites/gogung';
import * as nfm from './sites/nfm';
import * as ncs from './sites/ncs';
import * as much from './sites/much';
import * as gmuseum from './sites/gmuseum';
import * as hangeul from './sites/hangeul';
import * as gojobs from './sites/gojobs';
import * as kaah from './sites/kaah';
import * as khs from './sites/khs';
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
import * as jobGG from './sites/job-gg';
import * as namuk from './sites/namuk.js';
import * as museumOrKr from './sites/museum-or-kr';
import * as seoul from './sites/seoul';
import * as kdpAks from './sites/kdp-aks';
import * as kccf from './sites/kccf';
import * as kh from './sites/kh';
import * as arte from './sites/arte';
import * as gokams from './sites/gokams';
import * as yongsanCf from './sites/yongsan-cf';
import * as seochoCf from './sites/seocho-cf';
import * as gfac from './sites/gfac';
import * as naruart from './sites/naruart';
import * as ddmac from './sites/ddmac';
import * as efac from './sites/efac';
import * as nowonarts from './sites/nowonarts';
import * as idfac from './sites/idfac';
import * as snart from './sites/snart';
import * as ansanart from './sites/ansanart';
import * as gunpocf from './sites/gunpocf';
import * as nyjcf from './sites/nyjcf';
import * as gcart from './sites/gcart';
import * as nsart from './sites/nsart';
import * as saramin from './sites/saramin';

const __dirname = dirname(fileURLToPath(import.meta.url));

// playMCP 도구로만 수집하는 소스 (npm run crawl에서는 페이지를 열지 않음)
const MCP_ONLY_SOURCES = new Set(['saramin']);

// 사이트 레지스트리: [config, scraper]
const sites: [SiteConfig, SiteScraper][] = [
  [museumGoKr.config, museumGoKr.scrape],
  [gogung.config, gogung.scrape],
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
  // ggcf 계열 3곳 (재단 본부 우선, 본부에 없는 공고가 있는 2곳만 개별)
  ...ggcf.configs.map(c => [c, ggcf.scrape] as [SiteConfig, SiteScraper]),
  [bcmuseum.config, bcmuseum.scrape],
  [nyj.config, nyj.scrape],
  [hnart.config, hnart.scrape],
  [hsmuseum.config, hsmuseum.scrape],
  [anseong.config, anseong.scrape],
  [artic.config, artic.scrape],
  [ddc.config, ddc.scrape],
  [historySeooul.config, historySeooul.scrape],
  [jobGG.config, jobGG.scrape],
  [namuk.config, namuk.scrape],
  [museumOrKr.config, museumOrKr.scrape],
  [seoul.config, seoul.scrape],
  [kdpAks.config, kdpAks.scrape],
  // 지방문화원 통합 채용 게시판 (서울·경기 필터)
  [kccf.config, kccf.scrape],
  // 문화 분야 공공기관
  [kh.config, kh.scrape],
  [arte.config, arte.scrape],
  [gokams.config, gokams.scrape],
  // 서울 자치구 문화재단
  [yongsanCf.config, yongsanCf.scrape],
  [seochoCf.config, seochoCf.scrape],
  [gfac.config, gfac.scrape],
  [naruart.config, naruart.scrape],
  [ddmac.config, ddmac.scrape],
  [efac.config, efac.scrape],
  [nowonarts.config, nowonarts.scrape],
  [idfac.config, idfac.scrape],
  // 경기 시군 문화재단
  [snart.config, snart.scrape],
  [ansanart.config, ansanart.scrape],
  [gunpocf.config, gunpocf.scrape],
  [nyjcf.config, nyjcf.scrape],
  [gcart.config, gcart.scrape],
  [nsart.config, nsart.scrape],
  // 2차 출처 채용 포털 (playMCP 전용, 원 출처와 겹치는 공고는 secondary-sources.ts가 제외)
  [saramin.config, saramin.scrape],
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
    if (MCP_ONLY_SOURCES.has(config.id)) {
      // 페이지를 열지 않고 실패로 남겨 이전 MCP 수집분을 보존 (workfinder 실행에서 playMCP로 수집)
      console.log(`[${config.id}] ${config.name} — playMCP 전용 소스, Playwright 수집 건너뜀`);
      results.push({ site: config, postings: [], crawledAt: new Date().toISOString(), error: 'playMCP 전용 소스 — Playwright 수집 안 함, 이전 수집분 보존' });
      continue;
    }
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

  // 전체 결과에서 중복 공고 제거 (제목 정규화 비교)
  deduplicateResults(results);

  // 결과 저장
  const outputPath = join(__dirname, 'results.json');
  const saved = await saveResilientResults(outputPath, results);
  console.log(`이전 정상 결과 보존: ${saved.reduce((n, r) => n + (r.retainedCount || 0), 0)}건 (실패 상태는 유지)`);
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

main().catch(error => { console.error(error); process.exitCode = 1; });
