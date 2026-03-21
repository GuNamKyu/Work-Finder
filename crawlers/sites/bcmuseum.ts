// 부천시박물관 채용공고
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'bcmuseum',
  name: '부천시박물관',
  url: 'https://www.bcmuseum.or.kr/ko/boards/notice/?sc=03&pageIndex=1&searchKeyword=',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  return page.$$eval('ul.board-list-area > li', (rows) => {
    return rows.map(row => {
      const titleEl = row.querySelector('a.list-tit');
      const title = titleEl?.textContent?.trim() || '';
      const href = titleEl?.getAttribute('href') || '';
      const infos = row.querySelectorAll('ul.list-info li');
      let date = '';
      for (const info of infos) {
        if (info.querySelector('strong')?.textContent?.includes('작성일')) {
          date = info.querySelector('span')?.textContent?.trim() || '';
        }
      }
      return { title, date, href };
    });
  }).then(items =>
    items.filter(i => i.title).map(item => ({
      title: truncate(item.title),
      organization: '부천시박물관',
      regDate: normalizeDate(item.date),
      deadlineDate: null,
      url: item.href ? `https://www.bcmuseum.or.kr/ko/boards/notice/${item.href}` : null,
    }))
  );
}
