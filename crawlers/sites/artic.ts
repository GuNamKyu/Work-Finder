// 이천시립박물관 채용공고
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'artic',
  name: '이천시립박물관',
  url: 'https://www.artic.or.kr/icmus/board/list?boardManagementNo=26&menuLevel=2&menuNo=53&searchType=total&searchWord=%EC%B1%84%EC%9A%A9',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  return page.$$eval('table.boardCategory tbody tr', (rows) => {
    return rows.map(row => {
      const tds = row.querySelectorAll('td');
      if (tds.length < 3) return null;
      const titleEl = tds[1]?.querySelector('a');
      const title = titleEl?.textContent?.trim() || '';
      const href = titleEl?.getAttribute('href') || '';
      let date = '';
      for (const td of tds) {
        const text = td.textContent?.trim() || '';
        if (text.match(/\d{4}[.-]\d{1,2}[.-]\d{1,2}/)) {
          date = text;
          break;
        }
      }
      return { title, date, href };
    }).filter(Boolean);
  }).then(items =>
    (items as any[]).map(item => ({
      title: truncate(item.title),
      organization: '이천시립박물관',
      regDate: normalizeDate(item.date),
      deadlineDate: null,
      url: item.href ? `https://www.artic.or.kr${item.href}` : null,
    }))
  );
}
