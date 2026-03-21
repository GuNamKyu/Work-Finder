// 대한민국역사박물관 채용공고
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'much',
  name: '대한민국역사박물관',
  url: 'https://www.much.go.kr/MUCH/contents/M07090200000.do',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  return page.$$eval('table tbody tr', (rows) => {
    return rows.map(row => {
      const tds = row.querySelectorAll('td');
      if (tds.length < 5) return null;
      const titleEl = row.querySelector('td.noti_tit a');
      const title = titleEl?.textContent?.trim() || '';
      const deadline = tds[3]?.textContent?.trim() || '';
      const regDate = tds[4]?.textContent?.trim() || '';
      return { title, regDate, deadline };
    }).filter(Boolean);
  }).then(items =>
    (items as any[]).map(item => ({
      title: truncate(item.title),
      organization: '대한민국역사박물관',
      regDate: normalizeDate(item.regDate),
      deadlineDate: item.deadline ? normalizeDate(item.deadline) : null,
      url: null,
    }))
  );
}
