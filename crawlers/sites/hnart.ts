// 하남역사박물관 채용공고
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'hnart',
  name: '하남역사박물관',
  url: 'https://www.hnart.or.kr/artcenter/selectBbsNttList.do?key=219&bbsNo=1&integrDeptCode=&searchKrwd=&searchCtgry=%EC%B1%84%EC%9A%A9%EA%B3%B5%EA%B3%A0',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  // 구조: 번호(0), 카테고리(1), 제목(2), 파일(3), 조회수(4), 작성일(5), 작성자(6)
  return page.$$eval('table tbody tr', (rows) => {
    return rows.map(row => {
      const tds = row.querySelectorAll('td');
      if (tds.length < 5) return null;
      const titleEl = tds[2]?.querySelector('a');
      if (!titleEl) return null;
      // a 태그의 직접 텍스트 노드만 추출 (핫이슈 등 뱃지 제외)
      const titleText = Array.from(titleEl.childNodes)
        .filter(n => n.nodeType === 3) // TEXT_NODE
        .map(n => n.textContent?.trim() || '')
        .join('') || titleEl.textContent?.trim() || '';
      if (!titleText) return null;
      const href = titleEl.getAttribute('href') || '';
      const date = tds[5]?.querySelector('time')?.textContent?.trim()
        || tds[5]?.textContent?.trim() || '';
      return { title: titleText, date, href };
    }).filter(Boolean);
  }).then(items =>
    (items as any[]).map(item => ({
      title: truncate(item.title),
      organization: '하남문화재단',
      regDate: normalizeDate(item.date),
      deadlineDate: null,
      url: item.href
        ? `https://www.hnart.or.kr/artcenter/${item.href.replace(/^\.\//, '')}`
        : null,
    }))
  );
}
