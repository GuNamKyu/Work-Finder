// 남양주시 모집공고 (봇 감지 우회: JS 비활성화)
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'nyj',
  name: '남양주시',
  url: 'https://nyj.go.kr/www/selectBbsNttList.do?key=2497&bbsNo=67&pageUnit=10&searchCnd=SJ&searchKrwd=%EB%82%A8%EC%96%91%EC%A3%BC%EC%8B%9C%EB%A6%BD',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  // 이 사이트는 devtools/자동화 감지가 있어서 JS 비활성화 후 재접속
  const context = page.context();
  await page.close();
  const noJsPage = await context.newPage();
  await noJsPage.route('**/*', async (route) => {
    const resourceType = route.request().resourceType();
    if (resourceType === 'script') {
      await route.abort();
    } else {
      await route.continue();
    }
  });
  await noJsPage.goto(config.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await noJsPage.waitForTimeout(2000);

  const postings = await noJsPage.$$eval('table tbody tr', (rows) => {
    return rows.map(row => {
      const tds = row.querySelectorAll('td');
      if (tds.length < 5) return null;
      const titleEl = tds[2]?.querySelector('a');
      const title = titleEl?.textContent?.trim() || '';
      const href = titleEl?.getAttribute('href') || '';
      const date = tds[4]?.textContent?.trim() || '';
      return { title, date, href };
    }).filter(Boolean);
  });

  return (postings as any[]).map(item => ({
    title: truncate(item.title),
    organization: '남양주시',
    regDate: normalizeDate(item.date),
    deadlineDate: null,
    url: item.href ? `https://nyj.go.kr/www/${item.href.replace('./', '')}` : null,
  }));
}
