// 경기문화재단 계열 사이트 (동일 플랫폼 6곳)
// musenet은 .table02 구조, 나머지 5곳은 .list-type1 구조
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const configs: SiteConfig[] = [
  { id: 'musenet', name: '경기도박물관', url: 'https://musenet.ggcf.kr/boards/notice/articles?category=03&page=1' },
  { id: 'gcm', name: '경기도어린이박물관', url: 'https://gcm.ggcf.kr/boards/news/articles?category=03' },
  { id: 'ngcm', name: '경기북부어린이박물관', url: 'https://ngcm.ggcf.kr/boards/news/articles?category=03' },
  { id: 'jgpm', name: '전곡선사박물관', url: 'https://jgpm.ggcf.kr/boards/news/articles?category=03' },
  { id: 'silhak', name: '실학박물관', url: 'https://silhak.ggcf.kr/boards/news/articles?category=03' },
  { id: 'gjicp', name: '경기도자미술관', url: 'https://gjicp.ggcf.kr/boards/news/articles?category=03' },
];

export async function scrape(page: Page, config: SiteConfig): Promise<JobPosting[]> {
  await page.waitForTimeout(3000);

  // musenet은 .table02 구조
  const hasTable02 = await page.$('.table02 .tbody .tr');
  if (hasTable02) {
    return page.$$eval('.table02 .tbody .tr', (rows) => {
      return rows.map(row => {
        const link = row.querySelector('a');
        const tds = row.querySelectorAll('.td span');
        if (tds.length < 3) return null;
        const title = tds[1]?.textContent?.trim() || '';
        const date = tds[2]?.textContent?.trim() || '';
        const href = link?.getAttribute('href') || '';
        return { title, date, href };
      }).filter(Boolean);
    }).then(items =>
      (items as any[]).map(item => ({
        title: truncate(item.title),
        organization: config.name,
        regDate: normalizeDate(item.date),
        deadlineDate: null,
        url: item.href?.startsWith('http') ? item.href : null,
      }))
    );
  }

  // 나머지는 .list-type1 구조
  return page.$$eval('.list-type1', (items) => {
    return items.map(item => {
      const titleEl = item.querySelector('.part-list-title a');
      const title = titleEl?.textContent?.trim() || '';
      const href = titleEl?.getAttribute('href') || '';
      const date = item.querySelector('.part-date')?.textContent?.trim() || '';
      return { title, date, href };
    }).filter(item => item.title);
  }).then(items =>
    (items as any[]).map(item => ({
      title: truncate(item.title),
      organization: config.name,
      regDate: normalizeDate(item.date),
      deadlineDate: null,
      url: item.href?.startsWith('http') ? item.href : null,
    }))
  );
}
