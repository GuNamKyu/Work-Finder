// 과천문화재단 채용공고 (목록에 접수기간 "YYYY.MM.DD ~ YYYY.MM.DD"와 채용 상태 표시)
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'gcart',
  name: '과천문화재단',
  url: 'https://www.gcart.or.kr/kr/commu/recruitList.do',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  const items = await page.$$eval('ul.notice_list > li', rows => rows.map(row => {
    const link = row.querySelector('.name a') as HTMLAnchorElement | null;
    return {
      title: link?.textContent?.trim() || '',
      href: link?.href || '',
      period: row.querySelector('.date02')?.textContent?.trim() || '',
      status: row.querySelector('.status')?.textContent?.trim() || '',
    };
  }).filter(item => item.title));
  return items.map(item => {
    const [start, end] = item.period.split('~').map(s => s.trim());
    return {
      title: truncate(item.title),
      organization: '과천문화재단',
      regDate: normalizeDate(start || ''),
      deadlineDate: end && /\d{4}/.test(end) ? normalizeDate(end) : null,
      status: item.status || undefined,
      url: item.href.startsWith('http') ? item.href : null,
    };
  });
}
