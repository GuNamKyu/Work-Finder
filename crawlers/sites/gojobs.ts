// 나라일터 채용공고 (POST 기반 폼 검색)
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'gojobs',
  name: '나라일터',
  url: 'https://www.gojobs.go.kr/apmList.do',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  const allPostings: JobPosting[] = [];

  try {
    await page.goto('https://www.gojobs.go.kr/apmList.do?menuNo=401&mngrMenuYn=N&selMenuNo=400', {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });
    await page.waitForTimeout(1500);

    // 검색어 지정 없이 전체보기에서 최대 10페이지까지 수집
    for (let pageNum = 1; pageNum <= 10; pageNum++) {
      if (pageNum > 1) {
        const hasPage = await page.evaluate((n) => {
          const btn = document.querySelector(`a[onclick*="fn_egov_link_page(${n})"]`);
          // @ts-ignore
          if (btn && typeof fn_egov_link_page === 'function') {
            // @ts-ignore
            fn_egov_link_page(n);
            return true;
          }
          return false;
        }, pageNum);

        if (!hasPage) break; // 다음 페이지가 없으면 종료
        await page.waitForTimeout(3000);
      }

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
    }
  } catch (error) {
    console.error('나라일터 크롤링 실패:', error);
  }

  // 중복 제거 (제목 기준)
  const seen = new Set<string>();
  return allPostings.filter(p => {
    if (seen.has(p.title)) return false;
    seen.add(p.title);
    return true;
  });
}
