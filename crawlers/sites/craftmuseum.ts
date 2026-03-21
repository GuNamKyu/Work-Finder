// 서울공예박물관 채용공고 (SPA 카드 레이아웃)
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'craftmuseum',
  name: '서울공예박물관',
  url: 'https://craftmuseum.seoul.go.kr/introduce/recruit_list/1',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  await page.waitForTimeout(3000); // SPA 렌더링 대기

  return page.evaluate(() => {
    const items: { title: string; date: string }[] = [];
    const links = document.querySelectorAll('a');
    for (const link of links) {
      const p = link.querySelector('p');
      const divs = link.querySelectorAll('div');
      if (p && divs.length >= 2) {
        const title = p.textContent?.trim() || '';
        const lastDiv = divs[divs.length - 1];
        const date = lastDiv?.textContent?.trim() || '';
        if (title && date.match(/\d{4}/)) {
          items.push({ title, date });
        }
      }
    }
    return items;
  }).then(items =>
    items.map(item => ({
      title: truncate(item.title),
      organization: '서울공예박물관',
      regDate: normalizeDate(item.date),
      deadlineDate: null,
      url: null,
    }))
  );
}
