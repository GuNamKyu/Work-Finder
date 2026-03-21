// 나라일터 채용공고 (POST 기반 폼 검색)
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'gojobs',
  name: '나라일터',
  url: 'https://gojobs.go.kr/apmList.do',
};

const SEARCH_KEYWORDS = ['기념관', '연구원', '박물관', '문화재단'];

export async function scrape(page: Page): Promise<JobPosting[]> {
  const allPostings: JobPosting[] = [];

  for (const keyword of SEARCH_KEYWORDS) {
    try {
      await page.goto('https://gojobs.go.kr/apmList.do?menuNo=401&mngrMenuYn=N&selMenuNo=400', {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });
      await page.waitForTimeout(1500);

      await page.fill('input[name="searchSelectninsttnm"]', keyword);
      await page.click('#searchBtn, button:has-text("검색")');
      await page.waitForTimeout(3000);

      const postings = await page.$$eval('table#apmTbl tbody tr', (rows) => {
        return rows.map(row => {
          const tds = row.querySelectorAll('td');
          if (tds.length < 5) return null;
          const titleEl = tds[1]?.querySelector('a');
          const title = titleEl?.textContent?.trim() || '';
          const org = tds[2]?.textContent?.trim() || '';
          const regDate = tds[3]?.textContent?.trim() || '';
          const deadline = tds[4]?.textContent?.trim() || '';
          return { title, org, regDate, deadline };
        }).filter(Boolean);
      });

      for (const p of postings as any[]) {
        allPostings.push({
          title: truncate(p.title),
          organization: p.org,
          regDate: normalizeDate(p.regDate),
          deadlineDate: p.deadline ? normalizeDate(p.deadline) : null,
          url: null,
        });
      }
    } catch {
      // 키워드별 검색 실패 무시
    }
  }

  // 중복 제거 (제목 기준)
  const seen = new Set<string>();
  return allPostings.filter(p => {
    if (seen.has(p.title)) return false;
    seen.add(p.title);
    return true;
  });
}
