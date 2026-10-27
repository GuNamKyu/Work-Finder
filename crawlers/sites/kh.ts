// 국가유산진흥원 인재채용
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { keepQuery, normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'kh',
  name: '국가유산진흥원',
  url: 'https://www.kh.or.kr/brd/board/721/L/CATEGORY/719/menu/377?brdCodeField=CATEGORY&brdCodeValue=719',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  // 구조: 번호(공지), 제목(td.tit a), 첨부, 등록일(td.date), 조회
  const items = await page.$$eval('table.board_list tbody tr', rows => rows.map(row => {
    const link = row.querySelector('td.tit a') as HTMLAnchorElement | null;
    return { title: link?.getAttribute('title') || link?.textContent?.trim() || '', href: link?.href || '', date: row.querySelector('td.date')?.textContent?.trim() || '' };
  }).filter(item => item.title));
  return items.map(item => ({
    title: truncate(item.title),
    organization: '국가유산진흥원',
    regDate: normalizeDate(item.date),
    deadlineDate: null,
    url: item.href.startsWith('http') ? keepQuery(item.href, ['brdType', 'bbIdx']) : null,
  }));
}
