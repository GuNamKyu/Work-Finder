// 한국문화예술교육진흥원 채용공고
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'arte',
  name: '한국문화예술교육진흥원',
  url: 'https://arte.or.kr/notice/job/notice/Job_BoardList.do',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  // 구조: 번호, 제목(onclick=fnView('BRD_ID...')), 상태, 등록일, 마감일, 조회
  const items = await page.$$eval('table tbody tr', rows => rows.map(row => {
    const tds = row.querySelectorAll('td');
    const link = row.querySelector('a[href*="fnView"]');
    const boardId = link?.getAttribute('href')?.match(/fnView\('([^']+)'\)/)?.[1] || '';
    return {
      title: link?.querySelector('span')?.textContent?.trim() || link?.textContent?.trim() || '',
      status: tds[2]?.textContent?.trim() || '',
      date: tds[3]?.textContent?.trim() || '',
      deadline: tds[4]?.textContent?.trim() || '',
      boardId,
    };
  }).filter(item => item.title));
  return items.map(item => ({
    title: truncate(item.title),
    organization: '한국문화예술교육진흥원',
    regDate: normalizeDate(item.date),
    deadlineDate: /\d{4}/.test(item.deadline) ? normalizeDate(item.deadline) : null,
    status: item.status || undefined,
    url: item.boardId ? `https://arte.or.kr/notice/job/notice/Job_BoardView.do?board_id=${item.boardId}` : null,
  }));
}
