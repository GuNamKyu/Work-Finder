// 안산문화재단 채용안내
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { keepQuery, normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'ansanart',
  name: '안산문화재단',
  url: 'https://www.ansanart.com/lay1/bbs/S1T84C408/A/62/list.do',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  // 구조: 첫 칸에 제목 링크와 <li><b>작성일</b>YYYY-MM-DD</li> 메타 목록
  const items = await page.$$eval('table tbody tr', rows => rows.map(row => {
    const link = row.querySelector('td a[href*="view.do"]') as HTMLAnchorElement | null;
    const dateItem = [...row.querySelectorAll('li')].find(li => li.querySelector('b')?.textContent?.includes('작성일'));
    return { title: link?.textContent?.trim() || '', href: link?.href || '', date: dateItem?.textContent?.replace('작성일', '').trim() || '' };
  }).filter(item => item.title));
  return items.map(item => ({
    title: truncate(item.title),
    organization: '안산문화재단',
    regDate: normalizeDate(item.date),
    deadlineDate: null,
    url: item.href.startsWith('http') ? keepQuery(item.href, ['article_seq']) : null,
  }));
}
