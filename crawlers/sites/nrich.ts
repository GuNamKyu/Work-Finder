// 국립문화유산연구원 채용정보
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'nrich',
  name: '국립문화유산연구원',
  url: 'https://www.nrich.go.kr/kor/boardList.do?menuIdx=285&bbscd=40',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  return page.$$eval('ul.list-body li', (rows) => {
    return rows.map(row => {
      const titleEl = row.querySelector('div.col2 a.cont-link');
      const title = titleEl?.textContent?.trim() || '';
      const href = titleEl?.getAttribute('href') || '';
      const date = row.querySelector('div.col5 .cont-txt')?.textContent?.trim() || '';
      const dept = row.querySelector('div.col3 .cont-txt')?.textContent?.trim() || '';
      return { title, date, href, dept };
    }).filter(r => r.title);
  }).then(items =>
    items.map(item => ({
      title: truncate(item.title),
      organization: item.dept || '국립문화유산연구원',
      regDate: normalizeDate(item.date),
      deadlineDate: null,
      url: item.href ? new URL(item.href, 'https://www.nrich.go.kr/kor/').href : null,
    }))
  );
}
