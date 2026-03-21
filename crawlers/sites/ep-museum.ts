// 은평역사한옥박물관 채용공고
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'ep-museum',
  name: '은평역사한옥박물관',
  url: 'https://museum.ep.go.kr/board/board.asp?bbs_code=Fboard_1&gotopage=1&keyfield=title&keyword=%C3%A4%BF%EB',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  return page.$$eval('table tbody tr', (rows) => {
    return rows.map(row => {
      const tds = row.querySelectorAll('td');
      if (tds.length < 3) return null;
      const titleEl = row.querySelector('td a');
      const title = titleEl?.textContent?.trim() || '';
      const href = titleEl?.getAttribute('href') || '';
      // 날짜 열 찾기
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
      organization: '은평역사한옥박물관',
      regDate: normalizeDate(item.date),
      deadlineDate: null,
      url: item.href ? `https://museum.ep.go.kr${item.href}` : null,
    }))
  );
}
