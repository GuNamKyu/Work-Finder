// 국립고궁박물관 채용공고
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'gogung',
  name: '국립고궁박물관',
  url: 'https://www.gogung.go.kr/gogung/bbs/BMSR00022/list.do?gubunCd=B22_003&menuNo=800090',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  return page.$$eval('table.board-list tbody tr', (rows) => {
    return rows.map(row => {
      const tds = row.querySelectorAll('td');
      if (tds.length < 4) return null;
      const titleEl = tds[1]?.querySelector('a');
      const title = titleEl?.textContent?.trim() || '';
      const href = titleEl?.getAttribute('href') || '';
      const mobileHides = row.querySelectorAll('td.mobile-hide');
      const date = mobileHides[1]?.textContent?.trim() || '';
      return { title, date, href };
    }).filter(Boolean);
  }).then(items =>
    (items as any[]).map(item => ({
      title: truncate(item.title),
      organization: '국립고궁박물관',
      regDate: normalizeDate(item.date),
      deadlineDate: null,
      url: item.href ? new URL(item.href, 'https://www.gogung.go.kr/gogung/bbs/BMSR00022/').href : null,
    }))
  );
}
