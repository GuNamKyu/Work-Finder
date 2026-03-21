// 경기도박물관협회 채용공고
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'gmuseum',
  name: '경기도박물관협회',
  url: 'https://gmuseum.kr/board/jobList',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  return page.$$eval('table tbody tr', (rows) => {
    return rows.map(row => {
      const tds = row.querySelectorAll('td');
      if (tds.length < 4) return null;
      const titleEl = tds[1]?.querySelector('a');
      const title = titleEl?.textContent?.trim() || '';
      const href = titleEl?.getAttribute('href') || '';
      const date = tds[3]?.textContent?.trim() || '';
      const author = tds[2]?.textContent?.trim() || '';
      return { title, date, href, author };
    }).filter(Boolean);
  }).then(items =>
    (items as any[]).map(item => ({
      title: truncate(item.title),
      organization: item.author || '경기도박물관협회',
      regDate: normalizeDate(item.date),
      deadlineDate: null,
      url: item.href ? `https://gmuseum.kr${item.href}` : null,
    }))
  );
}
