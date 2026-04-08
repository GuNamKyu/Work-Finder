// 서울역사편찬원 채용공고
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'history-seoul',
  name: '서울역사편찬원',
  url: 'https://history.seoul.go.kr/bbsctt/list.do?key=2210200044',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  return page.$$eval('ul li', (items) => {
    return items
      .filter(li => {
        const text = li.textContent || '';
        return text.includes('채용') || text.includes('모집') || text.includes('공고');
      })
      .map(li => {
        const titleEl = li.querySelector('a');
        const title = titleEl?.textContent?.trim() || li.textContent?.trim() || '';
        let date = '';
        const dateMatch = (li.textContent || '').match(/\d{4}-\d{2}-\d{2}/);
        if (dateMatch) date = dateMatch[0];
        return { title, date };
      })
      .filter(item => item.title);
  }).then(items =>
    items.map(item => ({
      title: truncate(item.title),
      organization: '서울역사편찬원',
      regDate: normalizeDate(item.date),
      deadlineDate: null,
      url: null,
    }))
  );
}
