// 서초문화재단 채용공고 (공지사항 중 RECRUIT 분류)
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { keepQuery, normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'seocho-cf',
  name: '서초문화재단',
  url: 'https://www.seochocf.or.kr/site/main/archive/post/category/%EA%B3%B5%EC%A7%80%EC%82%AC%ED%95%AD?metaCode1=RECRUIT',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  // 구조: 번호, 상태(진행중/마감), 제목(a.arc_tit), 등록일, 조회
  const items = await page.$$eval('table.archive_t tbody tr', rows => rows.map(row => {
    const tds = row.querySelectorAll('td');
    const link = row.querySelector('a.arc_tit') as HTMLAnchorElement | null;
    return { title: link?.textContent?.trim() || '', href: link?.href || '', status: tds[1]?.textContent?.trim() || '', date: tds[3]?.textContent?.trim() || '' };
  }).filter(item => item.title));
  return items.map(item => ({
    title: truncate(item.title),
    organization: '서초문화재단',
    regDate: normalizeDate(item.date),
    deadlineDate: null,
    status: item.status || undefined,
    url: item.href.startsWith('http') ? keepQuery(item.href, []) : null,
  }));
}
