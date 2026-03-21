// 전쟁기념관 채용공고
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'warmemo',
  name: '전쟁기념관',
  url: 'https://www.warmemo.or.kr:8443/Home/H40000/H40200/H40202/boardList',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  return page.$$eval('table tr', (rows) => {
    return rows.slice(1).map(row => { // skip header row
      const tds = row.querySelectorAll('td');
      if (tds.length < 4) return null;
      const titleEl = tds[1]?.querySelector('a');
      const title = titleEl?.textContent?.trim() || '';
      const href = titleEl?.getAttribute('href') || '';
      const status = tds[2]?.textContent?.trim() || '';
      const date = tds[3]?.textContent?.trim() || '';
      return { title, date, href, status };
    }).filter(Boolean);
  }).then(items =>
    (items as any[]).map(item => ({
      title: truncate(item.title),
      organization: '전쟁기념관',
      regDate: normalizeDate(item.date),
      deadlineDate: null,
      url: item.href ? `https://www.warmemo.or.kr:8443/Home/H40000/H40200/H40202/${item.href}` : null,
      status: item.status,
    }))
  );
}
