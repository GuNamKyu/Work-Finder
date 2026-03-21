// 종로문화재단 채용정보
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'jfac',
  name: '종로문화재단',
  url: 'https://www.jfac.or.kr/site/main/archive/post/category/%EC%B1%84%EC%9A%A9%EC%A0%95%EB%B3%B4',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  return page.$$eval('table tbody tr', (rows) => {
    return rows.map(row => {
      const tds = row.querySelectorAll('td');
      if (tds.length < 3) return null;
      const titleEl = row.querySelector('a[href*="/site/main/archive/post/"]');
      const title = titleEl?.textContent?.trim() || '';
      const href = titleEl?.getAttribute('href') || '';
      const date = tds[2]?.textContent?.trim() || '';
      return { title, date, href };
    }).filter(Boolean);
  }).then(items =>
    (items as any[]).map(item => ({
      title: truncate(item.title),
      organization: '종로문화재단',
      regDate: normalizeDate(item.date),
      deadlineDate: null,
      url: item.href ? `https://www.jfac.or.kr${item.href}` : null,
    }))
  );
}
