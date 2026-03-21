// 국립대한민국임시정부기념관 공지사항
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'nmkpg',
  name: '국립대한민국임시정부기념관',
  url: 'https://www.nmkpg.go.kr/main/board/1/board_list.do',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  return page.$$eval('.bbsList ul li:not(.header)', (rows) => {
    return rows
      .filter(row => {
        const tag = row.querySelector('span.tag')?.textContent?.trim() || '';
        return tag === '채용';
      })
      .map(row => {
        const titleEl = row.querySelector('span.tit a.bbsLink');
        const title = titleEl?.textContent?.trim() || '';
        const date = row.querySelector('span.date')?.textContent?.trim() || '';
        const onclick = titleEl?.getAttribute('onclick') || '';
        const idMatch = onclick.match(/searchView\('1','(\d+)'\)/);
        const id = idMatch?.[1] || '';
        return { title, date, id };
      });
  }).then(items =>
    items.map(item => ({
      title: truncate(item.title),
      organization: '국립대한민국임시정부기념관',
      regDate: normalizeDate(item.date),
      deadlineDate: null,
      url: item.id ? `https://www.nmkpg.go.kr/main/board/1/board_view.do?bcstIdx1=${item.id}` : null,
    }))
  );
}
