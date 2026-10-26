// 남양주시문화재단 채용공고
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'nyjcf',
  name: '남양주시문화재단',
  url: 'https://www.nyjcf.or.kr/www/25',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  // 구조: 번호, 제목(td.txtleft a), 첨부, 등록일
  const items = await page.$$eval('.list table tbody tr', rows => rows.map(row => {
    const tds = row.querySelectorAll('td');
    const link = row.querySelector('td.txtleft a') as HTMLAnchorElement | null;
    return { title: link?.textContent?.trim() || '', href: link?.href || '', date: tds[tds.length - 1]?.textContent?.trim() || '' };
  }).filter(item => item.title));
  return items.map(item => ({
    title: truncate(item.title),
    organization: '남양주시문화재단',
    regDate: normalizeDate(item.date),
    deadlineDate: null,
    url: item.href.startsWith('http') ? item.href : null,
  }));
}
