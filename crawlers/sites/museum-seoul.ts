// 서울역사박물관 공고/구인
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'museum-seoul',
  name: '서울역사박물관',
  url: 'https://museum.seoul.go.kr/www/board/NR_boardList.do?bbsCd=1017&sso=ok',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  return page.$$eval('table tbody tr', (rows) => {
    return rows.map(row => {
      const tds = row.querySelectorAll('td');
      if (tds.length < 4) return null;
      const titleEl = row.querySelector('td.al a');
      const title = titleEl?.textContent?.trim() || '';
      const dateTds = row.querySelectorAll('td.m_list_f');
      const date = dateTds[1]?.textContent?.trim() || '';
      return { title, date };
    }).filter(Boolean);
  }).then(items =>
    (items as any[]).map(item => ({
      title: truncate(item.title),
      organization: '서울역사박물관',
      regDate: normalizeDate(item.date),
      deadlineDate: null,
      url: null,
    }))
  );
}
