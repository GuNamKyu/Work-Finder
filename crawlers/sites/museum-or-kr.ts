// 한국박물관협회 채용정보
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'museum-or-kr',
  name: '한국박물관협회',
  url: 'https://museum.or.kr/job2/',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  // KBoard 플러그인이 iframe으로 콘텐츠를 로드
  const frame = page.frames().find(f => f.url().includes('kboard'));
  const target = frame || page;

  // iframe 내부 테이블이 로드될 때까지 대기
  await target.waitForSelector('table tbody tr', { timeout: 10000 }).catch(() => {});

  return target.$$eval('table tbody tr', (rows) => {
    return rows.map(row => {
      const tds = row.querySelectorAll('td');
      if (tds.length < 4) return null;

      // 공지사항 행 건너뛰기
      const uid = tds[0]?.textContent?.trim() || '';
      if (uid === '공지사항' || uid === '공지') return null;

      // 제목: .kboard-default-cut-strings 내부 텍스트만 추출
      const titleDiv = tds[1]?.querySelector('.kboard-default-cut-strings');
      const title = (titleDiv?.childNodes[0]?.textContent || titleDiv?.textContent || '').trim();

      // 링크
      const titleLink = tds[1]?.querySelector('a') as HTMLAnchorElement | null;
      const href = titleLink?.getAttribute('href') || '';

      // 날짜: tds[3] (.kboard-list-date)
      const date = tds[3]?.textContent?.trim() || '';

      return { title, date, href };
    }).filter(Boolean);
  }).then(items =>
    (items as any[]).map(item => {
      // 제목에서 [기관명] 추출
      const orgMatch = item.title.match(/^\[([^\]]+)\]/);
      const organization = orgMatch ? orgMatch[1] : '한국박물관협회';

      // URL: iframe 내부의 상대경로를 절대경로로 변환
      let url: string | null = null;
      if (item.href) {
        url = item.href.startsWith('http')
          ? item.href
          : `https://museum.or.kr${item.href.startsWith('/') ? '' : '/'}${item.href}`;
      }

      return {
        title: truncate(item.title),
        organization,
        regDate: normalizeDate(item.date),
        deadlineDate: null,
        url,
      };
    })
  );
}
