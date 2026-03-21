// 한국문화유산협회 공개채용
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'kaah',
  name: '한국문화유산협회',
  url: 'https://www.kaah.kr/reqopen',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  return page.$$eval('table tbody tr', (rows) => {
    return rows.map(row => {
      const tds = row.querySelectorAll('td');
      if (tds.length < 5) return null;
      const titleEl = tds[1]?.querySelector('a');
      const title = titleEl?.textContent?.trim() || '';
      const href = titleEl?.getAttribute('href') || '';
      const date = tds[4]?.textContent?.trim() || '';
      return { title, date, href };
    }).filter(Boolean);
  }).then(items =>
    (items as any[]).map(item => ({
      title: truncate(item.title),
      organization: '한국문화유산협회',
      regDate: normalizeDate(item.date),
      deadlineDate: null,
      url: item.href?.startsWith('http') ? item.href : item.href ? `https://www.kaah.kr${item.href}` : null,
    }))
  );
}
