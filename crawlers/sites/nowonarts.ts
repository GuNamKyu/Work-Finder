// 노원문화재단 채용공고
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'nowonarts',
  name: '노원문화재단',
  url: 'https://www.nowonarts.kr/channels/job/posts',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  const items = await page.$$eval('.default_tb table tbody tr', rows => rows.map(row => {
    const link = row.querySelector('td.tb_subject a') as HTMLAnchorElement | null;
    // 새 글 배지 'N'이 제목 끝에 붙음
    return { title: link?.textContent?.trim().replace(/\s+N$/, '') || '', href: link?.href || '', date: row.querySelector('td.tb_date')?.textContent?.trim() || '' };
  }).filter(item => item.title));
  return items.map(item => ({
    title: truncate(item.title),
    organization: '노원문화재단',
    regDate: normalizeDate(item.date),
    deadlineDate: null,
    url: item.href.startsWith('http') ? item.href : null,
  }));
}
