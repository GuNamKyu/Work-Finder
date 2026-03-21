// 용산역사박물관 (에러 페이지 반환 - 접속 불가)
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';

export const config: SiteConfig = {
  id: 'yongsan',
  name: '용산역사박물관',
  url: 'https://museum.yongsan.go.kr/articles/index?boardCode=notice&category=C1002-1',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  // 사이트가 에러 페이지를 반환하므로 빈 배열 반환
  const url = page.url();
  if (url.includes('/error/')) {
    console.log(`  [${config.name}] 사이트 접속 불가 (에러 페이지 리다이렉트)`);
    return [];
  }

  return page.$$eval('table tbody tr', (rows) => {
    return rows.map(row => {
      const tds = row.querySelectorAll('td');
      if (tds.length < 3) return null;
      const titleEl = row.querySelector('td a');
      const title = titleEl?.textContent?.trim() || '';
      let date = '';
      for (const td of tds) {
        const text = td.textContent?.trim() || '';
        if (text.match(/\d{4}[.-]\d{1,2}[.-]\d{1,2}/)) {
          date = text;
          break;
        }
      }
      return { title, date };
    }).filter(Boolean);
  }).then(items =>
    (items as any[]).map(item => ({
      title: item.title,
      organization: '용산역사박물관',
      regDate: item.date,
      deadlineDate: null,
      url: null,
    }))
  );
}
