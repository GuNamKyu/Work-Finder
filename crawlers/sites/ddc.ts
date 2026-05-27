// 동두천시 자유수호평화박물관
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'ddc',
  name: '동두천자유수호평화박물관',
  url: 'https://www.ddc.go.kr/museum/selectBbsNttList.do?bbsNo=96&key=878',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  // 구조: 번호(0), 제목(1), 파일(2), 조회수(3), 작성일(4)
  return page.$$eval('table tbody tr', (rows) => {
    return rows.map(row => {
      const tds = row.querySelectorAll('td');
      if (tds.length < 3) return null;
      // 첫 번째 td가 '공지' 텍스트이면 고정 공지행 → 스킵 (목록에 일반 번호로도 나타남)
      const numText = tds[0]?.textContent?.trim() || '';
      if (numText === '공지') return null;
      const titleEl = tds[1]?.querySelector('a');
      const title = titleEl?.textContent?.trim() || '';
      if (!title) return null;
      const href = titleEl?.getAttribute('href') || '';
      const date = tds[tds.length - 1]?.textContent?.trim() || '';
      return { title, date, href };
    }).filter(Boolean);
  }).then(items =>
    (items as any[]).map(item => ({
      title: truncate(item.title),
      organization: '동두천자유수호평화박물관',
      regDate: normalizeDate(item.date),
      deadlineDate: null,
      url: item.href
        ? `https://www.ddc.go.kr/museum/${item.href.replace(/^\.\//, '')}`
        : null,
    }))
  );
}
