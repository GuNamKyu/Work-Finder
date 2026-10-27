// 예술경영지원센터 채용정보 (센터 자체 채용)
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { keepQuery, normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'gokams',
  name: '예술경영지원센터',
  url: 'https://www.gokams.or.kr/01_news/jobposting_list.aspx',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  // 구조: 번호, 분류 아이콘, 제목(td.left a), 등록일, 조회, 첨부
  const items = await page.$$eval('table.boardList tbody tr', rows => rows.map(row => {
    const tds = row.querySelectorAll('td');
    const link = row.querySelector('td.left a') as HTMLAnchorElement | null;
    return { title: link?.textContent?.trim() || '', href: link?.href || '', date: tds[3]?.textContent?.trim() || '' };
  }).filter(item => item.title));
  return items.map(item => ({
    title: truncate(item.title),
    organization: '예술경영지원센터',
    regDate: normalizeDate(item.date),
    deadlineDate: null,
    url: item.href.startsWith('http') ? keepQuery(item.href, ['Idx']) : null,
  }));
}
