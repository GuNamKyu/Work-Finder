// 한국학자료통합플랫폼 채용공고 (kdp.aks.ac.kr)
// 한국학중앙연구원에서 운영하는 한국학 소식 게시판의 채용공고 카테고리
// table tbody tr 구조, 링크는 javascript:goDetail('번호') 형태
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'kdp-aks',
  name: '한국학중앙연구원',
  url: 'https://kdp.aks.ac.kr/board/boardKorList?BRD_GRU_SN=6&pageUnit=20&ctgDtlCd=&itemId=%EC%B1%84%EC%9A%A9%EA%B3%B5%EA%B3%A0&qw=&q=&pageUnit=20',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  await page.waitForSelector('table tbody tr', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);

  return page.$$eval('table tbody tr', (rows) => {
    return rows.map(row => {
      const tds = row.querySelectorAll('td');
      if (tds.length < 3) return null;

      // 제목 및 링크
      const titleEl = tds[1]?.querySelector('a');
      if (!titleEl) return null;
      const title = titleEl.textContent?.trim() || '';
      if (!title) return null;

      // javascript:goDetail('5950') 에서 ID 추출
      const href = titleEl.getAttribute('href') || '';
      const idMatch = href.match(/goDetail\('(\d+)'\)/);
      const detailId = idMatch ? idMatch[1] : null;

      // 날짜
      const date = tds[2]?.textContent?.trim() || '';

      return { title, detailId, date };
    }).filter(Boolean);
  }).then(items =>
    (items as any[]).map(item => {
      // 제목에서 태그 및 기관명 파싱: <채용공고>[기관명] 제목
      const titleRaw: string = item.title;
      const orgMatch = titleRaw.match(/\[([^\]]+)\]/);
      const organization = orgMatch ? orgMatch[1] : '한국학중앙연구원';

      // 상세페이지 URL 조합
      const url = item.detailId
        ? `https://kdp.aks.ac.kr/board/boardKorView?BRD_GRU_SN=6&BRD_SN=${item.detailId}&itemId=%EC%B1%84%EC%9A%A9%EA%B3%B5%EA%B3%A0`
        : null;

      return {
        title: truncate(titleRaw),
        organization,
        regDate: normalizeDate(item.date),
        deadlineDate: null,
        url,
      };
    })
  );
}
