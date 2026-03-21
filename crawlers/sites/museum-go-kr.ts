// 국립중앙박물관 채용공고 (div.board-list-tbody > ul 구조)
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'museum-go-kr',
  name: '국립중앙박물관',
  url: 'https://www.museum.go.kr/MUSEUM/contents/M0701030000.do?catCustomType=post&catId=54',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  await page.waitForSelector('.board-list-tbody ul', { timeout: 10000 }).catch(() => {});

  return page.$$eval('.board-list-tbody > ul', (rows) => {
    return rows.map(row => {
      const lis = row.querySelectorAll('li');
      if (lis.length < 5) return null;
      const org = lis[1]?.textContent?.trim() || '국립중앙박물관';
      const titleEl = lis[2]?.querySelector('a');
      const title = titleEl?.textContent?.trim() || '';
      const href = titleEl?.getAttribute('href') || '';
      const period = lis[3]?.textContent?.trim() || '';
      const status = lis[4]?.textContent?.trim() || '';
      const dateMatches = period.match(/\d{4}-\d{2}-\d{2}/g) || [];
      return { title, org, status, href, regDate: dateMatches[0] || '', deadlineDate: dateMatches[1] || null };
    }).filter(Boolean);
  }).then(items =>
    (items as any[]).map(item => ({
      title: truncate(item.title),
      organization: item.org,
      regDate: item.regDate,
      deadlineDate: item.deadlineDate,
      url: item.href ? `https://www.museum.go.kr/MUSEUM/contents/M0701030000.do${item.href}` : null,
      status: item.status,
    }))
  );
}
