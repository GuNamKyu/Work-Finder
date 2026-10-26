// 광진문화재단 채용공고
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'naruart',
  name: '광진문화재단',
  url: 'https://www.naruart.or.kr/community/recruit_list.php',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  const items = await page.$$eval('ul.bbs_list_box > li', rows => rows.map(row => {
    const link = row.querySelector('.sbj a') as HTMLAnchorElement | null;
    return { title: link?.textContent?.trim() || '', href: link?.href || '', date: row.querySelector('.day')?.textContent?.trim() || '' };
  }).filter(item => item.title));
  return items.map(item => ({
    title: truncate(item.title),
    organization: '광진문화재단',
    regDate: normalizeDate(item.date),
    deadlineDate: null,
    url: item.href.startsWith('http') ? item.href : null,
  }));
}
