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
import * as jobGG from './sites/job-gg';
import * as museumOrKr from './sites/museum-or-kr';
import * as seoul from './sites/seoul';
import * as koreaKr from './sites/korea-kr';
import * as kdpAks from './sites/kdp-aks';

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
  [jobGG.config, jobGG.scrape],
  [museumOrKr.config, museumOrKr.scrape],
  [seoul.config, seoul.scrape],
  [koreaKr.config, koreaKr.scrape],
  [kdpAks.config, kdpAks.scrape],
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

  // 전체 결과에서 중복 공고 제거 (제목 정규화 비교)
  deduplicateResults(results);

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

/** 전체 크롤링 결과에서 중복 공고 제거 (제목 정규화 비교, URL 있는 것 우선) */
function deduplicateResults(results: CrawlResult[]) {
  // 정규화 함수: 공백·특수문자 제거 후 소문자
  function normalize(t: string) {
    return (t || '').replace(/\s+/g, '').replace(/[\(\)\[\]「」『』【】·\-_,\.…]/g, '').toLowerCase();
  }

  // 1단계: 전체에서 (정규화제목 → 최우선 posting이 속한 사이트 ID) 맵 구축
  // URL이 있는 공고를 우선으로, 같은 조건이면 먼저 발견된 것 유지
  const bestMap = new Map<string, string>(); // key → siteId
  for (const r of results) {
    for (const p of r.postings) {
      const key = normalize(p.title);
      const existingSiteId = bestMap.get(key);
      if (!existingSiteId) {
        bestMap.set(key, r.site.id);
      } else if (!getPostingUrl(results, existingSiteId, key, normalize) && p.url) {
        // 기존 것에 URL이 없고 현재 것에 URL이 있으면 교체
        bestMap.set(key, r.site.id);
      }
    }
  }

  // 2단계: 각 사이트 결과에서 중복 제거 — bestMap에서 선택된 사이트의 공고만 남기기
  const seen = new Set<string>();
  let removedCount = 0;
  for (const r of results) {
    const before = r.postings.length;
    r.postings = r.postings.filter(p => {
      const key = normalize(p.title);
      if (seen.has(key)) return false; // 이미 다른 사이트에서 포함됨
      const bestSiteId = bestMap.get(key);
      if (bestSiteId && bestSiteId !== r.site.id) return false; // 이 사이트 것이 최우선이 아님
      seen.add(key);
      return true;
    });
    removedCount += before - r.postings.length;
  }

  if (removedCount > 0) {
    console.log(`  ℹ️ 중복 공고 ${removedCount}건 제거 (완전일치, URL 있는 공고 우선 유지)`);
  }

  // 3단계: 퍼지(fuzzy) 중복 제거 — 핵심 토큰 교집합 기반
  const fuzzyRemoved = deduplicateFuzzy(results);
  if (fuzzyRemoved > 0) {
    console.log(`  ℹ️ 유사 공고 ${fuzzyRemoved}건 추가 제거 (토큰 유사도, URL 있는 공고 우선 유지)`);
  }
}

/**
 * 제목의 핵심 토큰(불용어 제외) 교집합을 기반으로 유사 공고를 제거한다.
 * 두 공고의 핵심 토큰 교집합 글자 수가 MIN_OVERLAP_CHARS 이상이면 중복으로 간주하며,
 * URL이 있는 공고를 우선 유지하고 없으면 먼저 등장한 것을 유지한다.
 */
function deduplicateFuzzy(results: CrawlResult[]): number {
  // 대부분의 공고 제목에 등장하는 불용어 (비교 제외 대상)
  const STOPWORDS = new Set([
    '채용공고', '채용', '공고', '모집공고', '모집', '안내', '시험', '공개',
    '경쟁', '시행', '관련', '관련공고', '알림', '공지', '접수', '추가',
    '재공고', '수정공고', '변경공고', '정정공고', '취소공고', '긴급공고',
    '일반', '특별', '외부', '내부', '신입', '경력', '직원', '직원채용',
    '인재', '인재채용', '인원', '선발', '선발공고', '계획', '계획공고',
    '20', '21', '22', '23', '24', '25', '26', // 연도 앞 2자리
  ]);

  // 최소 교집합 글자 수 (이 이상이면 유사 공고로 간주)
  const MIN_OVERLAP_CHARS = 10;

  /**
   * 제목에서 불용어를 제거하고 핵심 토큰 집합을 반환한다.
   * - 특수문자·괄호 제거 후 공백으로 분할
   * - 불용어, 2글자 미만 토큰 제거
   * - 연도(4자리 숫자) 제거
   */
  function extractTokens(title: string): string[] {
    const cleaned = (title || '')
      .replace(/[\(\)\[\]\<\>「」『』【】〔〕·\-_,\.…:：!！?？《》]/g, ' ')
      .replace(/\d{4}년?/g, ' ') // 연도 제거
      .replace(/\d+월\d*일?/g, ' ') // 날짜 제거 (예: 6.24 수)
      .replace(/\d+\s*(월|일|차|기|명|분|명)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned
      .split(' ')
      .map(t => t.trim())
      .filter(t => t.length >= 2 && !STOPWORDS.has(t));
  }

  /** 두 토큰 배열의 교집합 총 글자 수를 반환 */
  function overlapChars(tokensA: string[], tokensB: string[]): number {
    const setB = new Set(tokensB);
    return tokensA
      .filter(t => setB.has(t))
      .reduce((sum, t) => sum + t.length, 0);
  }

  // 모든 공고를 평탄화: { posting, siteId } 형태로
  interface FlatPosting {
    posting: import('./types').JobPosting;
    siteId: string;
    tokens: string[];
    removed: boolean;
  }

  const flat: FlatPosting[] = [];
  for (const r of results) {
    for (const p of r.postings) {
      flat.push({
        posting: p,
        siteId: r.site.id,
        tokens: extractTokens(p.title),
        removed: false,
      });
    }
  }

  // O(n²) 비교: 핵심 토큰이 MIN_OVERLAP_CHARS 이상 겹치면 둘 중 하나 제거
  for (let i = 0; i < flat.length; i++) {
    if (flat[i].removed) continue;
    if (flat[i].tokens.length === 0) continue; // 토큰이 없으면 비교 불가

    for (let j = i + 1; j < flat.length; j++) {
      if (flat[j].removed) continue;
      if (flat[j].tokens.length === 0) continue;

      const overlap = overlapChars(flat[i].tokens, flat[j].tokens);
      if (overlap < MIN_OVERLAP_CHARS) continue;

      // 유사 공고 감지: URL 있는 쪽 우선, 없으면 i (먼저 등장한 것) 유지
      const iHasUrl = !!flat[i].posting.url;
      const jHasUrl = !!flat[j].posting.url;

      if (iHasUrl && !jHasUrl) {
        flat[j].removed = true;
        console.log(`  🔀 유사 중복 제거: "${flat[j].posting.title}" (교집합 ${overlap}자)`);
      } else if (!iHasUrl && jHasUrl) {
        flat[i].removed = true;
        console.log(`  🔀 유사 중복 제거: "${flat[i].posting.title}" (교집합 ${overlap}자)`);
        break; // i가 제거됐으므로 i 루프 종료
      } else {
        // 둘 다 URL이 있거나 둘 다 없으면 나중 것(j) 제거
        flat[j].removed = true;
        console.log(`  🔀 유사 중복 제거: "${flat[j].posting.title}" (교집합 ${overlap}자)`);
      }
    }
  }

  // 제거 대상 posting 목록 구성
  const removedPostings = new Set(
    flat.filter(f => f.removed).map(f => f.posting)
  );

  // 각 사이트 결과에서 제거
  let removedCount = 0;
  for (const r of results) {
    const before = r.postings.length;
    r.postings = r.postings.filter(p => !removedPostings.has(p));
    removedCount += before - r.postings.length;
  }

  return removedCount;
}

/** bestMap 구축 시 기존 사이트의 URL 확인용 헬퍼 */
function getPostingUrl(
  results: CrawlResult[],
  siteId: string,
  normalizedKey: string,
  normalize: (t: string) => string
): string | null {
  const siteResult = results.find(r => r.site.id === siteId);
  if (!siteResult) return null;
  const posting = siteResult.postings.find(p => normalize(p.title) === normalizedKey);
  return posting?.url || null;
}

main().catch(console.error);
