// 한국문화원연합회 채용공고 (전국 지방문화원 채용 통합 게시판)
// 지역 선택(#areaCode)으로 서울·경기 문화원 공고만 수집. 목록은 AJAX로 렌더링됨
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';
import { PartialCrawlError } from '../partial-crawl.js';

export const config: SiteConfig = {
  id: 'kccf',
  name: '한국문화원연합회',
  url: 'https://kccf.or.kr/bbs/list.do?bbsId=N000000000000000000017&selMenuId=MK0030',
};

const BBS_ID = 'N000000000000000000017';
const REGIONS = [
  { code: 'SU', label: '서울특별시' },
  { code: 'GG', label: '경기도' },
];

export async function scrape(page: Page): Promise<JobPosting[]> {
  const allPostings: JobPosting[] = [];
  const failures: string[] = [];
  for (const region of REGIONS) {
    try {
      await Promise.all([
        // 최초 '전체' 조회 응답과 섞이지 않도록 선택한 지역 코드의 요청만 기다림
        page.waitForResponse(r => r.url().includes('getBbsNttListAjax')
          && (r.request().postData() || '').includes(`"areaCode":"${region.code}"`), { timeout: 15000 }),
        page.selectOption('#areaCode', region.code),
      ]);
      await page.waitForTimeout(800);
      // 구조: 번호, 지방문화원, 제목(onclick=fnGotoDetail("D", nttId, bbsId)), 작성자, 작성일, 조회수
      const items = await page.$$eval('ul.responsive-list-inner', rows => rows.map(row => {
        const cells = [...row.children].map(c => c.textContent?.replace(/\s+/g, ' ').trim() || '');
        const link = row.querySelector('li.subject a');
        const nttId = link?.getAttribute('onclick')?.match(/fnGotoDetail\(\s*"D"\s*,\s*"([^"]+)"/)?.[1] || '';
        return { center: cells[1] || '', title: link?.textContent?.trim() || '', date: cells[4] || '', nttId };
      }));
      for (const item of items) {
        if (!item.title) continue;
        allPostings.push({
          title: truncate(item.title),
          organization: item.center && item.center !== '-' ? item.center : '한국문화원연합회',
          regDate: normalizeDate(item.date),
          deadlineDate: null,
          url: item.nttId ? `https://kccf.or.kr/bbs/detail.do?bbsId=${BBS_ID}&selMenuId=MK0030&nttId=${item.nttId}` : null,
          region: region.label,
        });
      }
    } catch (error: any) {
      failures.push(`${region.label}: ${error?.message?.split('\n')[0] || error}`);
    }
  }
  if (failures.length) {
    throw new PartialCrawlError(`지역별 수집 실패(${failures.length}/${REGIONS.length}) — ${failures.join(' / ')}`, allPostings);
  }
  return allPostings;
}
