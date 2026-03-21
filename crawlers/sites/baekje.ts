// 한성백제박물관 공고/구인
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'baekje',
  name: '한성백제박물관',
  url: 'https://baekjemuseum.seoul.go.kr/module/index.jsp?mpid=SBM0501020000',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  return page.$$eval('table tbody tr', (rows) => {
    return rows.map(row => {
      const tds = row.querySelectorAll('td');
      if (tds.length < 4) return null;
      const titleEl = tds[1]?.querySelector('a');
      if (!titleEl) return null;
      const title = titleEl.textContent?.trim() || '';
      const href = titleEl.getAttribute('href') || '';
      const date = tds[3]?.textContent?.trim() || '';
      return { title, date, href };
    }).filter(Boolean);
  }).then(items =>
    (items as any[]).map(item => ({
      title: truncate(item.title),
      organization: '한성백제박물관',
      regDate: normalizeDate(item.date),
      deadlineDate: null,
      url: item.href ? `https://baekjemuseum.seoul.go.kr/module/${item.href}` : null,
    }))
  );
}
