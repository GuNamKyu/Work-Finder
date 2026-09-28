// 국립문화유산연구원 채용정보
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';
import { submitList } from '../navigation.js';
import { PartialCrawlError } from '../partial-crawl.js';

export const config: SiteConfig = {
  id: 'nrich',
  name: '국립문화유산연구원',
  url: 'https://www.nrich.go.kr/kor/boardList.do?menuIdx=285&bbscd=40',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  const postings: JobPosting[] = [];
  const seen = new Set<string>();
  const collect = async () => {
  await page.locator('ul.list-body').first().waitFor({ state: 'attached' });
  const items = await page.$$eval('ul.list-body li', (rows) => {
    return rows.map(row => {
      const titleEl = row.querySelector('div.col2 a.cont-link');
      const title = titleEl?.textContent?.trim() || '';
      const href = titleEl?.getAttribute('href') || '';
      const date = row.querySelector('div.col5 .cont-txt')?.textContent?.trim() || '';
      const dept = row.querySelector('div.col3 .cont-txt')?.textContent?.trim() || '';
      return { title, date, href, dept };
    }).filter(r => r.title);
  });
  for (const item of items) {
    const key = item.href || `${item.title}:${item.date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    postings.push({
      title: truncate(item.title),
      organization: item.dept || '국립문화유산연구원',
      regDate: normalizeDate(item.date),
      deadlineDate: null,
      url: item.href ? new URL(item.href, 'https://www.nrich.go.kr/kor/').href : null,
    });
  }
  };
  try {
    await collect();
    // The page has independent 연구원/소속기관 lists. Read both, not just the first ten rows.
    for (let n = 2; n <= 3; n++) {
      for (const [fn, boardType] of [['fnPageMove', '1'], ['fnPageMove2', '2']]) {
        const next = page.locator(`a[onclick*="${fn}(${n})"]`).first();
        if (!await next.count()) continue;
        // The second list's public fnPageMove2 references a nonexistent pageindex2.
        // Submit its observed read-only search form using the actual pageindex field.
        await submitList(page, () => page.evaluate(({ n, boardType }) => {
          const form = Array.from(document.forms).find(f => f.querySelector<HTMLInputElement>('input[name="boardTypeGubun"]')?.value === boardType);
          const index = form?.querySelector<HTMLInputElement>('input[name="pageindex"]');
          if (!form || !index) throw new Error('연구원 페이지 검색 폼 구조 변경');
          index.value = String(n);
          form.submit();
        }, { n, boardType }), 'ul.list-body');
        await collect();
      }
    }
  } catch (error: any) {
    throw new PartialCrawlError(error?.message || '연구원 목록 수집 실패', postings);
  }
  return postings;
}
