// 성남문화재단 채용안내
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'snart',
  name: '성남문화재단',
  url: 'https://www.snart.or.kr/main/pst/list.do?pst_id=recruit',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  // 구조: 번호, 제목(td.subject a), 첨부, 등록일(data-th=등록일), 조회
  const items = await page.$$eval('.cm_table1 table tbody tr', rows => rows.map(row => {
    const link = row.querySelector('td.subject a') as HTMLAnchorElement | null;
    link?.querySelectorAll('.skip').forEach(el => el.remove());
    return { title: link?.textContent?.trim() || '', href: link?.href || '', date: row.querySelector('td[data-th="등록일"]')?.textContent?.trim() || '' };
  }).filter(item => item.title));
  return items.map(item => ({
    title: truncate(item.title),
    organization: '성남문화재단',
    regDate: normalizeDate(item.date),
    deadlineDate: null,
    // 목록 검색 상태 토큰(search=)은 세션마다 바뀌므로 상세 URL에서 제거
    url: item.href.startsWith('http') ? item.href.replace(/&search=[^&]*/, '') : null,
  }));
}
