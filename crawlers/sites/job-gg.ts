// 경기도 일자리 포털 (잡아바) - AJAX API 기반 크롤링
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'job-gg',
  name: '경기도일자리포털',
  url: 'https://job.gg.go.kr/pblcEmpmn/list.do',
};

interface JobGGItem {
  seq: number;
  title: string;
  instNm: string;
  bgnDt: string;
  endDt: string;
  dtlUrl?: string;
}

export async function scrape(page: Page): Promise<JobPosting[]> {
  const allPostings: JobPosting[] = [];

  try {
    // AJAX API를 직접 호출하여 채용공고 목록 수집
    for (let pageNum = 1; pageNum <= 5; pageNum++) {
      const response = await page.evaluate(async (pn) => {
        const params = new URLSearchParams();
        params.append('currentPageNo', String(pn));
        params.append('recordCountPerPage', '16');
        params.append('srchType', 'NEW');

        const res = await fetch('https://job.gg.go.kr/pblcEmpmn/listAjax.do', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        });
        return res.json();
      }, pageNum);

      // API 응답에서 목록 추출
      const items: JobGGItem[] = response?.list || response?.resultList || response || [];
      if (!Array.isArray(items) || items.length === 0) break;

      for (const item of items) {
        if (!item.title) continue;
        const detailUrl = item.dtlUrl
          || `https://job.gg.go.kr/pblcEmpmn/publicJobDetail.do?seq=${item.seq}`;

        allPostings.push({
          title: truncate(item.title),
          organization: item.instNm || '경기도',
          regDate: item.bgnDt ? normalizeDate(item.bgnDt) : '',
          deadlineDate: item.endDt ? normalizeDate(item.endDt) : null,
          url: detailUrl,
        });
      }

      // 16건 미만이면 마지막 페이지
      if (items.length < 16) break;
    }
  } catch (error) {
    console.error('경기도일자리포털 크롤링 실패:', error);
  }

  // 중복 제거 (제목 기준)
  const seen = new Set<string>();
  return allPostings.filter(p => {
    if (seen.has(p.title)) return false;
    seen.add(p.title);
    return true;
  });
}
