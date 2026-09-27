// 국립중앙박물관 알림 게시판 크롤러 (자원봉사 키워드)
// URL: https://www.museum.go.kr/MUSEUM/contents/M0701010000.do?sv=자원봉사
// 조건: 크롤링 시점 기준 1주일 이내 게시물만 노출
// DOM: .board-list-tbody > ul > li[n]
//   - li[0]: 번호
//   - li[1]: 구분
//   - li[2]: 박물관
//   - li[3]: a (제목, href)
//   - li[4]: 작성자
//   - li[5]: 날짜 (YYYY-MM-DD)
//   - li[6]: 조회수
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../../types';
import { truncate } from '../../base';

export const config: SiteConfig = {
  id: 'museum-notice-volunteer',
  name: '국립중앙박물관 알림',
  url: 'https://www.museum.go.kr/MUSEUM/contents/M0701010000.do?pageSize=10&catCustomType=united&catId=128&arcDataType=&sc=&sv=%EC%9E%90%EC%9B%90%EB%B4%89%EC%82%AC',
  type: 'experience',
};

const BASE = 'https://www.museum.go.kr';
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function isWithinOneWeek(dateStr: string): boolean {
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const postDate = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Date.now() - postDate.getTime() <= ONE_WEEK_MS;
}

export async function scrape(page: Page): Promise<JobPosting[]> {
  const allPostings: JobPosting[] = [];

  try {
    await page.goto(config.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // 결과 파싱: .board-list-tbody > ul 구조
    const rows = await page.$$eval('.board-list-tbody > ul', (uls) => {
      return uls.map(ul => {
        const lis = ul.querySelectorAll('li');
        if (lis.length < 6) return null;
        const titleEl = lis[3]?.querySelector('a');
        const title = titleEl?.textContent?.trim() || '';
        const href = titleEl?.getAttribute('href') || '';
        const dateStr = lis[5]?.textContent?.trim() || '';
        const category = lis[1]?.textContent?.trim() || '';
        const museum = lis[2]?.textContent?.trim() || '';
        return { title, href, dateStr, category, museum };
      }).filter(r => r && r.title);
    });

    for (const row of rows as any[]) {
      // 1주일 이내 필터
      if (!isWithinOneWeek(row.dateStr)) continue;

      const url = row.href
        ? (row.href.startsWith('http') ? row.href : BASE + '/MUSEUM/contents/M0701010000.do' + row.href)
        : null;

      allPostings.push({
        title: truncate(row.title),
        organization: row.museum || '국립중앙박물관',
        regDate: row.dateStr,
        deadlineDate: null,
        url,
        status: '자원봉사 공고',
        postingType: 'experience',
      });
    }
  } catch (err: any) {
    console.error('[museum-notice] 크롤링 실패:', err?.message);
    throw err;
  }

  return allPostings;
}
