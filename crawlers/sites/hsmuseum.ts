// 화성시역사박물관 소식
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'hsmuseum',
  name: '화성시역사박물관',
  url: 'https://hsmuseum.hscity.go.kr/hsMuseum/comunity/comu1.jsp',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  return page.$$eval('table.boardList tbody tr', (rows) => {
    return rows.map(row => {
      const tds = row.querySelectorAll('td');
      if (tds.length < 4) return null;
      const titleEl = tds[1]?.querySelector('a');
      const title = titleEl?.textContent?.trim() || '';
      const href = titleEl?.getAttribute('href') || '';
      const date = tds[3]?.textContent?.trim() || '';
      return { title, date, href };
    }).filter(Boolean);
  }).then(items =>
    (items as any[]).map(item => ({
      title: truncate(item.title),
      organization: '화성시역사박물관',
      regDate: normalizeDate(item.date),
      deadlineDate: null,
      url: item.href ? `https://hsmuseum.hscity.go.kr/hsMuseum/comunity/${item.href}` : null,
    }))
  );
}
