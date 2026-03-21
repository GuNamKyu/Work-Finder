// 서대문자연사박물관 채용공고
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'namu-sdm',
  name: '서대문자연사박물관',
  url: 'https://namu.sdm.go.kr/web/main/bbs/newsevent_news_recruitmen/list',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  return page.$$eval('table tbody tr', (rows) => {
    return rows.map(row => {
      const tds = row.querySelectorAll('td');
      if (tds.length < 3) return null;
      const titleEl = tds[1]?.querySelector('a');
      const title = titleEl?.textContent?.trim() || '';
      const href = titleEl?.getAttribute('href') || '';
      const date = tds[2]?.textContent?.trim() || '';
      return { title, date, href };
    }).filter(Boolean);
  }).then(items =>
    (items as any[]).map(item => ({
      title: truncate(item.title),
      organization: '서대문자연사박물관',
      regDate: normalizeDate(item.date),
      deadlineDate: null,
      url: item.href ? `https://namu.sdm.go.kr${item.href}` : null,
    }))
  );
}
