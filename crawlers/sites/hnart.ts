// 하남역사박물관 채용공고
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'hnart',
  name: '하남역사박물관',
  url: 'https://www.hnart.or.kr/artcenter/selectBbsNttList.do?key=219&bbsNo=1&integrDeptCode=&searchKrwd=&searchCtgry=%EC%B1%84%EC%9A%A9%EA%B3%B5%EA%B3%A0',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  return page.$$eval('table tbody tr', (rows) => {
    return rows.map(row => {
      const tds = row.querySelectorAll('td');
      if (tds.length < 3) return null;
      const titleEl = tds[1]?.querySelector('a');
      const title = titleEl?.textContent?.trim() || '';
      const href = titleEl?.getAttribute('href') || '';
      const date = tds[tds.length - 1]?.textContent?.trim() || '';
      return { title, date, href };
    }).filter(Boolean);
  }).then(items =>
    (items as any[]).map(item => ({
      title: truncate(item.title),
      organization: '하남역사박물관',
      regDate: normalizeDate(item.date),
      deadlineDate: null,
      url: item.href ? `https://www.hnart.or.kr/artcenter/${item.href.replace('./', '')}` : null,
    }))
  );
}
