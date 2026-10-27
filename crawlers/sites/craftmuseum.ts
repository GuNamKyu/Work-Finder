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

  // 2026-10 확인: 카드가 a.list-item > span(제목) · span(요약) · span(등록일) 구조 (이전 p/div 구조 아님)
  return page.evaluate(() => {
    const items: { title: string; date: string }[] = [];
    for (const card of document.querySelectorAll('a.list-item')) {
      const spans = [...card.children];
      const title = spans[0]?.textContent?.replace(/\s+/g, ' ').trim() || '';
      const date = spans[spans.length - 1]?.textContent?.trim() || '';
      if (title && /\d{4}/.test(date)) items.push({ title, date });
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
