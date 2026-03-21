// 국립한글박물관 채용공고 (SPA - JS 렌더링)
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'hangeul',
  name: '국립한글박물관',
  url: 'https://www.hangeul.go.kr/news/newsList.do?bbs_id=30&curr_menu_cd=0106010600',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  await page.waitForSelector('ul li a h3', { timeout: 10000 }).catch(() => {});

  return page.$$eval('ul li', (items) => {
    return items
      .filter(li => li.querySelector('a h3'))
      .map(li => {
        const title = li.querySelector('a h3')?.textContent?.trim() || '';
        const dateEl = li.querySelector('div');
        const date = dateEl?.textContent?.trim() || '';
        return { title, date };
      })
      .filter(item => item.title);
  }).then(items =>
    items.map(item => ({
      title: truncate(item.title),
      organization: '국립한글박물관',
      regDate: normalizeDate(item.date.replace(/\.$/, '')),
      deadlineDate: null,
      url: null,
    }))
  );
}
