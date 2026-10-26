// 국가유산청 시험/채용 (khs.go.kr)
// 국립문화유산연구원·궁능유적본부 등 소속기관 채용도 이 게시판에 올라오므로(nrich는 보류, excluded-sources.json)
// 하루 2건 안팎이 쌓이는 첫 페이지만으로는 부족 → 최근 30일 범위까지 최대 6페이지를 읽는다
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';
import { PartialCrawlError } from '../partial-crawl.js';

export const config: SiteConfig = {
  id: 'khs',
  name: '국가유산청',
  url: 'https://www.khs.go.kr/multiBbz/selectMultiBbzList.do?mn=NS_01_06&bbzId=newexam',
};

const MAX_PAGES = 6;
const LOOKBACK_DAYS = 30;

// 제목 맨 앞의 소속기관명(예: 국립부여문화유산연구소)을 기관명으로 사용. 없으면 국가유산청
function organizationFromTitle(title: string): string {
  return title.match(/^(국립[가-힣]+(?:연구원|연구소|박물관|관리소|센터|본부))\s/)?.[1] || '국가유산청';
}

async function readPage(page: Page) {
  return page.$$eval('table tbody tr', (rows) => {
    return rows.map(row => {
      const tds = row.querySelectorAll('td');
      if (tds.length < 5) return null;
      const titleEl = tds[1]?.querySelector('a');
      // 새 글 표시 'N'이 제목 뒤 공백 다음에 붙음
      const title = titleEl?.textContent?.trim().replace(/\s*N$/, '') || '';
      const href = titleEl?.getAttribute('href') || '';
      const regDate = tds[3]?.textContent?.trim() || '';
      const deadline = tds[4]?.textContent?.trim() || '';
      return { title, regDate, deadline, href };
    }).filter(Boolean);
  }).then(items =>
    (items as any[]).map(item => ({
      title: truncate(item.title),
      organization: organizationFromTitle(item.title),
      regDate: normalizeDate(item.regDate),
      deadlineDate: item.deadline ? normalizeDate(item.deadline) : null,
      // href의 ;jsessionid=... 구간만 제거하고 공고를 구분하는 id·no 쿼리는 유지
      url: item.href ? `https://www.khs.go.kr${item.href.replace(/;jsessionid=[^?]*/, '')}` : null,
    }))
  );
}

export async function scrape(page: Page): Promise<JobPosting[]> {
  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 86400000).toISOString().slice(0, 10);
  const allPostings: JobPosting[] = [];
  for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum++) {
    try {
      if (pageNum > 1) {
        await page.goto(`${config.url}&pageIndex=${pageNum}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(1000);
      }
      const postings = await readPage(page);
      allPostings.push(...postings);
      const oldest = postings.map(p => p.regDate).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()[0];
      if (!postings.length || (oldest && oldest < cutoff)) break;
    } catch (error) {
      throw new PartialCrawlError(`국가유산청 ${pageNum}페이지 수집 실패: ${error instanceof Error ? error.message.split('\n')[0] : error}`, allPostings);
    }
  }
  return allPostings;
}
