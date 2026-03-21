// 백범김구기념관 공지사항 (채용 관련)
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'kimkoo',
  name: '백범김구기념관',
  url: 'https://www.kimkoomuseum.org/inf/inf_1_list.asp?BoardDiv=Notice',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  return page.$$eval('table tbody tr', (rows) => {
    return rows.map(row => {
      const tds = row.querySelectorAll('td');
      if (tds.length < 3) return null;
      const titleEl = row.querySelector('td a');
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
    (items as any[])
      .filter(item => item.title.includes('채용') || item.title.includes('모집') || item.title.includes('공고'))
      .map(item => ({
        title: truncate(item.title),
        organization: '백범김구기념관',
        regDate: normalizeDate(item.date),
        deadlineDate: null,
        url: item.href ? `https://www.kimkoomuseum.org/inf/${item.href}` : null,
      }))
  );
}
