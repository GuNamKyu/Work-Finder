// 국가유산청 시험/채용 (khs.go.kr)
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'khs',
  name: '국가유산청',
  url: 'https://www.khs.go.kr/multiBbz/selectMultiBbzList.do?mn=NS_01_06&bbzId=newexam',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  return page.$$eval('table tbody tr', (rows) => {
    return rows.map(row => {
      const tds = row.querySelectorAll('td');
      if (tds.length < 5) return null;
      const titleEl = tds[1]?.querySelector('a');
      const title = titleEl?.textContent?.replace(/N$/, '').trim() || '';
      const href = titleEl?.getAttribute('href') || '';
      const regDate = tds[3]?.textContent?.trim() || '';
      const deadline = tds[4]?.textContent?.trim() || '';
      return { title, regDate, deadline, href };
    }).filter(Boolean);
  }).then(items =>
    (items as any[]).map(item => ({
      title: truncate(item.title),
      organization: '국가유산청',
      regDate: normalizeDate(item.regDate),
      deadlineDate: item.deadline ? normalizeDate(item.deadline) : null,
      url: item.href ? `https://www.khs.go.kr${item.href.split(';')[0]}` : null,
    }))
  );
}
