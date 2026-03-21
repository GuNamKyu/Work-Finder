// 동두천시 자유수호평화박물관
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'ddc',
  name: '동두천자유수호평화박물관',
  url: 'https://www.ddc.go.kr/museum/selectBbsNttList.do?bbsNo=96&key=878',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  return page.$$eval('table tbody tr', (rows) => {
    return rows.map(row => {
      const tds = row.querySelectorAll('td');
      if (tds.length < 3) return null;
      const titleEl = tds[1]?.querySelector('a');
      const title = titleEl?.textContent?.trim() || '';
      const href = titleEl?.getAttribute('href') || '';
      const date = tds[tds.length - 1]?.textContent?.trim() || '';
      return { title, date, href };
    }).filter(Boolean);
  }).then(items =>
    (items as any[]).map(item => ({
      title: truncate(item.title),
      organization: '동두천자유수호평화박물관',
      regDate: normalizeDate(item.date),
      deadlineDate: null,
      url: item.href ? `https://www.ddc.go.kr/museum/${item.href.replace('./', '')}` : null,
    }))
  );
}
