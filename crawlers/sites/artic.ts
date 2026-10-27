// 이천시립박물관 채용공고
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'artic',
  name: '이천시립박물관',
  url: 'https://www.artic.or.kr/icmus/board/list?boardManagementNo=26&menuLevel=2&menuNo=53&searchType=total&searchWord=%EC%B1%84%EC%9A%A9',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  // 2026-10 확인: 목록 표 클래스가 board_list (이전 boardCategory)
  return page.$$eval('table.board_list tbody tr, table.boardCategory tbody tr', (rows) => {
    return rows.map(row => {
      const tds = row.querySelectorAll('td');
      if (tds.length < 3) return null;
      const titleEl = row.querySelector('td a');
      const title = titleEl?.textContent?.trim() || '';
      const href = titleEl?.getAttribute('href') || '';
      let date = '';
      for (const td of tds) {
        const text = td.textContent?.trim() || '';
        if (text.match(/\d{4}[.-]\d{1,2}[.-]\d{1,2}/)) {
          date = text;
          break;
        }
      }
      return { title, date, href };
    }).filter(Boolean);
  }).then(items =>
    (items as any[]).map(item => ({
      title: truncate(item.title),
      organization: '이천시립박물관',
      regDate: normalizeDate(item.date),
      deadlineDate: null,
      // 2026-10 확인: 목록 href가 이미 절대 주소(https://www.artic.or.kr:443/...)라 그대로 결합하면 주소가 깨짐
      url: item.href ? new URL(item.href, 'https://www.artic.or.kr').href : null,
    }))
  );
}
