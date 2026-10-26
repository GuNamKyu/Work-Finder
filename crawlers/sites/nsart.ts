// 광주시문화재단 채용공고 (경기 광주시)
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'nsart',
  name: '광주시문화재단',
  url: 'https://www.nsart.or.kr/board/recruit.do',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  const items = await page.$$eval('.boardList table tbody tr', rows => rows.map(row => {
    const link = row.querySelector('td.subject a') as HTMLAnchorElement | null;
    return { title: link?.textContent?.trim() || '', href: link?.href || '', date: row.querySelector('td.date')?.textContent?.trim() || '' };
  }).filter(item => item.title));
  return items.map(item => ({
    title: truncate(item.title),
    organization: '광주시문화재단',
    regDate: normalizeDate(item.date),
    deadlineDate: null,
    url: item.href.startsWith('http') ? item.href : null,
  }));
}
