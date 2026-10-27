// 용산역사박물관 공지사항(채용 분류)
// 2026-10 확인: 목록이 table이 아니라 .board-list-tbody > ul(번호·분류·제목·작성일·조회수 li) 구조
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate } from '../base';

export const config: SiteConfig = {
  id: 'yongsan',
  name: '용산역사박물관',
  url: 'https://museum.yongsan.go.kr/articles/index?boardCode=notice&category=C1002-1',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  // 사이트가 에러 페이지를 반환하므로 빈 배열 반환
  const url = page.url();
  if (url.includes('/error/')) {
    console.log(`  [${config.name}] 사이트 접속 불가 (에러 페이지 리다이렉트)`);
    return [];
  }

  return page.$$eval('.board-list-tbody > ul, table tbody tr', (rows) => {
    return rows.map(row => {
      const titleEl = row.querySelector('a');
      const title = titleEl?.textContent?.replace(/\s+/g, ' ').trim() || '';
      const date = row.textContent?.match(/\d{4}[.-]\d{1,2}[.-]\d{1,2}/)?.[0] || '';
      return title ? { title, date } : null;
    }).filter(Boolean);
  }).then(items =>
    (items as any[]).map(item => ({
      title: item.title,
      organization: '용산역사박물관',
      regDate: normalizeDate(item.date),
      deadlineDate: null,
      url: null,
    }))
  );
}
