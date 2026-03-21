// 국립민속박물관 채용공고
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'nfm',
  name: '국립민속박물관',
  url: 'https://www.nfm.go.kr/user/bbs/home/2/1409/bbsDataList.do',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  return page.$$eval('table tbody tr', (rows) => {
    return rows.map(row => {
      const titleEl = row.querySelector('td.tit a.list_bbsDataTitle');
      if (!titleEl) return null;
      const title = titleEl.textContent?.trim() || '';
      const href = titleEl.getAttribute('href') || '';
      const infoEl = row.querySelector('td.tit .board_info .info');
      const date = infoEl?.textContent?.trim() || '';
      return { title, date, href };
    }).filter(Boolean);
  }).then(items =>
    (items as any[]).map(item => ({
      title: truncate(item.title),
      organization: '국립민속박물관',
      regDate: normalizeDate(item.date),
      deadlineDate: null,
      url: item.href ? `https://www.nfm.go.kr${item.href}` : null,
    }))
  );
}
