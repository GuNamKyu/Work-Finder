// 크롤링 결과 검증 스크립트
// 실제 사이트를 Playwright로 방문하여 크롤링 결과와 비교 검증
import { chromium } from 'playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFile, writeFile } from 'fs/promises';
import type { CrawlResult } from './types';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface VerifyResult {
  siteId: string;
  siteName: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  crawledCount: number;
  actualCount: number;
  matchedTitles: number;
  unmatchedTitles: string[];
  message: string;
}

async function verify() {
  const resultsPath = join(__dirname, 'results.json');
  let crawlResults: CrawlResult[];
  try {
    const data = await readFile(resultsPath, 'utf-8');
    crawlResults = JSON.parse(data);
  } catch {
    console.error('results.json 파일을 찾을 수 없습니다. 먼저 run.ts를 실행하세요.');
    process.exit(1);
  }

  const targetId = process.argv[2];
  const filtered = targetId
    ? crawlResults.filter(r => r.site.id === targetId)
    : crawlResults;

  console.log('=== 크롤링 결과 검증 시작 ===');
  console.log(`검증 대상: ${filtered.length}개 사이트\n`);

  const browser = await chromium.launch({ headless: true });
  const verifyResults: VerifyResult[] = [];

  for (const result of filtered) {
    const { site, postings, error } = result;
    console.log(`[${site.id}] ${site.name} 검증 중...`);

    // 크롤링 에러가 있었던 사이트는 스킵
    if (error) {
      verifyResults.push({
        siteId: site.id,
        siteName: site.name,
        status: 'skip',
        crawledCount: 0,
        actualCount: 0,
        matchedTitles: 0,
        unmatchedTitles: [],
        message: `크롤링 에러로 스킵: ${error}`,
      });
      console.log(`  ⏭️  스킵 (크롤링 에러)\n`);
      continue;
    }

    try {
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        locale: 'ko-KR',
      });
      const page = await context.newPage();
      await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);

      // 페이지에서 보이는 텍스트 추출
      const pageText = await page.evaluate(() => document.body?.innerText || '');

      // 검증 1: 크롤링된 각 공고 제목이 실제 페이지에 존재하는지 확인
      let matchedCount = 0;
      const unmatchedTitles: string[] = [];
      for (const posting of postings) {
        // 제목의 핵심 부분 (처음 20자) 으로 매칭
        const titleCore = posting.title.replace(/\.\.\.$/, '').substring(0, 20).trim();
        if (titleCore && pageText.includes(titleCore)) {
          matchedCount++;
        } else {
          unmatchedTitles.push(posting.title);
        }
      }

      // 검증 2: 페이지에 채용 관련 키워드가 있는 게시글 수 추정
      const keywordLines = pageText.split('\n').filter(line =>
        ['채용', '모집', '공고'].some(kw => line.includes(kw)) && line.trim().length > 5
      );
      const actualEstimate = keywordLines.length;

      // 판정
      let status: VerifyResult['status'] = 'pass';
      let message = '';

      if (postings.length === 0 && actualEstimate === 0) {
        status = 'pass';
        message = '공고 없음 확인 (정상)';
      } else if (postings.length === 0 && actualEstimate > 0) {
        status = 'warn';
        message = `크롤링 0건이나 페이지에 채용 키워드 ${actualEstimate}건 감지`;
      } else if (matchedCount === postings.length) {
        status = 'pass';
        message = `전체 ${postings.length}건 제목 매칭 성공`;
      } else if (matchedCount >= postings.length * 0.7) {
        status = 'pass';
        message = `${postings.length}건 중 ${matchedCount}건 매칭 (${Math.round(matchedCount / postings.length * 100)}%)`;
      } else if (matchedCount >= postings.length * 0.3) {
        status = 'warn';
        message = `${postings.length}건 중 ${matchedCount}건만 매칭 (${Math.round(matchedCount / postings.length * 100)}%)`;
      } else {
        status = 'fail';
        message = `${postings.length}건 중 ${matchedCount}건만 매칭 - 크롤러 점검 필요`;
      }

      verifyResults.push({
        siteId: site.id,
        siteName: site.name,
        status,
        crawledCount: postings.length,
        actualCount: actualEstimate,
        matchedTitles: matchedCount,
        unmatchedTitles,
        message,
      });

      const icon = status === 'pass' ? '✅' : status === 'warn' ? '⚠️' : '❌';
      console.log(`  ${icon} ${message}`);
      if (unmatchedTitles.length > 0 && unmatchedTitles.length <= 3) {
        for (const t of unmatchedTitles) {
          console.log(`     ❓ 미매칭: ${t}`);
        }
      }
      console.log();

      await context.close();
    } catch (err: any) {
      verifyResults.push({
        siteId: site.id,
        siteName: site.name,
        status: 'fail',
        crawledCount: postings.length,
        actualCount: 0,
        matchedTitles: 0,
        unmatchedTitles: [],
        message: `검증 중 에러: ${err?.message}`,
      });
      console.log(`  ❌ 검증 실패: ${err?.message}\n`);
    }
  }

  await browser.close();

  // 검증 요약
  console.log('=== 검증 결과 요약 ===');
  const passCount = verifyResults.filter(r => r.status === 'pass').length;
  const warnCount = verifyResults.filter(r => r.status === 'warn').length;
  const failCount = verifyResults.filter(r => r.status === 'fail').length;
  const skipCount = verifyResults.filter(r => r.status === 'skip').length;

  console.log(`✅ 통과: ${passCount}개`);
  console.log(`⚠️  경고: ${warnCount}개`);
  console.log(`❌ 실패: ${failCount}개`);
  console.log(`⏭️  스킵: ${skipCount}개`);

  if (warnCount > 0) {
    console.log('\n⚠️  경고 사이트:');
    for (const r of verifyResults.filter(r => r.status === 'warn')) {
      console.log(`  - ${r.siteName}: ${r.message}`);
    }
  }

  if (failCount > 0) {
    console.log('\n❌ 실패 사이트:');
    for (const r of verifyResults.filter(r => r.status === 'fail')) {
      console.log(`  - ${r.siteName}: ${r.message}`);
    }
  }

  // 검증 결과 저장
  const verifyPath = join(__dirname, 'verify-results.json');
  await writeFile(verifyPath, JSON.stringify(verifyResults, null, 2));
  console.log(`\n검증 결과 저장: ${verifyPath}`);
}

verify().catch(console.error);
