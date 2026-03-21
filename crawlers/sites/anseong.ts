// 안성맞춤박물관 게시판
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'anseong',
  name: '안성맞춤박물관',
  url: 'https://www.anseong.go.kr/tourPortal/museum/bbs/list.do?ptIdx=16&mId=0600000000',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  return page.$$eval('table tbody tr', (rows) => {
    return rows.map(row => {
      const tds = row.querySelectorAll('td');
      if (tds.length < 5) return null;
      const titleEl = tds[1]?.querySelector('a');
      const title = titleEl?.textContent?.trim() || '';
      const date = tds[4]?.textContent?.trim() || '';
      return { title, date };
    }).filter(Boolean);
  }).then(items =>
    (items as any[])
      .filter(item => item.title.includes('채용') || item.title.includes('모집') || item.title.includes('공고'))
      .map(item => ({
        title: truncate(item.title),
        organization: '안성맞춤박물관',
        regDate: normalizeDate(item.date),
        deadlineDate: null,
        url: null,
      }))
  );
}
