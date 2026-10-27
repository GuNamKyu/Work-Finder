// 동작문화재단 채용공고
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'idfac',
  name: '동작문화재단',
  url: 'https://www.idfac.or.kr/bbs/board.php?bo_table=job',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  const items = await page.$$eval('table.table-st02 tbody tr', rows => rows.map(row => {
    const link = row.querySelector('td.title a') as HTMLAnchorElement | null;
    return { title: link?.textContent?.trim() || '', href: link?.href || '', date: row.querySelector('td.date')?.textContent?.trim() || '' };
  }).filter(item => item.title));
  return items.map(item => ({
    title: truncate(item.title),
    organization: '동작문화재단',
    regDate: normalizeDate(item.date),
    deadlineDate: null,
    url: item.href.startsWith('http') ? item.href : null,
  }));
}
