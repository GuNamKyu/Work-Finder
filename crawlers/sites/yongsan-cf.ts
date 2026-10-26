// 용산문화재단 채용공고 (종로문화재단과 같은 archive 플랫폼, 목록은 ul.body li 구조)
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'yongsan-cf',
  name: '용산문화재단',
  url: 'https://yongsanculture.or.kr/site/main/archive/post/category/jobNotice',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  const items = await page.$$eval('.list-table ul.body > li', rows => rows.map(row => {
    const link = row.querySelector('.title a') as HTMLAnchorElement | null;
    return { title: link?.textContent?.trim() || '', href: link?.href || '', date: row.querySelector('.date')?.textContent?.trim() || '' };
  }).filter(item => item.title));
  return items.map(item => ({
    title: truncate(item.title),
    organization: '용산문화재단',
    regDate: normalizeDate(item.date),
    deadlineDate: null,
    url: item.href.startsWith('http') ? item.href : null,
  }));
}
