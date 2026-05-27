// 서울특별시 채용시험 공고
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'seoul',
  name: '서울특별시',
  url: 'https://www.seoul.go.kr/news/news_employ.do',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  return page.$$eval('table tbody tr', (rows) => {
    return rows.map(row => {
      const tds = row.querySelectorAll('td');
      if (tds.length < 5) return null;

      // 제목 및 링크
      const titleEl = tds[1]?.querySelector('a');
      const title = titleEl?.textContent?.trim() || '';
      // javascript:fnTbbsView('458226') → nttNo 추출
      const onclick = titleEl?.getAttribute('href') || '';
      const nttMatch = onclick.match(/fnTbbsView\('(\d+)'\)/);
      const nttNo = nttMatch ? nttMatch[1] : '';

      // 담당부서
      const org = tds[2]?.textContent?.trim() || '';
      // 등록일
      const regDate = tds[3]?.textContent?.trim() || '';
      // 마감일
      const deadline = tds[4]?.textContent?.trim() || '';

      return { title, nttNo, org, regDate, deadline };
    }).filter(Boolean);
  }).then(items =>
    (items as any[]).map(item => ({
      title: truncate(item.title),
      organization: item.org || '서울특별시',
      regDate: normalizeDate(item.regDate),
      deadlineDate: item.deadline ? normalizeDate(item.deadline) : null,
      url: item.nttNo
        ? `https://www.seoul.go.kr/news/news_employ.do?bbsNo=166&nttNo=${item.nttNo}`
        : null,
    }))
  );
}
