// 문화자원봉사센터 봉사자 모집공고 크롤러
// URL: https://csv.culture.go.kr/frt/biz/provol/selectProvolList.do
// 방식: JavaScript로 상세검색 탭 열기 + 봉사명(박물관) 검색 (지역 필터 없이 전체 검색)
// 이유: #detailSearchCondition1의 option이 동적 로드되어 selectOption이 실패함 →
//       지역 필터 없이 전체 검색 후 결과 내 서울/경기 관련 공고 수집
// DOM:
//   table tbody tr
//   - td[0]: 구분(badge)
//   - td[1]: a.tit (제목)
//   - td[2]: 활동기간
//   - td[3]: 모집기간 (YYYY.MM.DD ~ YYYY.MM.DD)
//   - td[4]: 인원
//   - td[5]: 연령
//   - td[6]: 상태
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../../types';
import { normalizeDate, truncate } from '../../base';

export const config: SiteConfig = {
  id: 'csv-culture',
  name: '문화자원봉사센터',
  url: 'https://csv.culture.go.kr/frt/biz/provol/selectProvolList.do',
  type: 'experience',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  const allPostings: JobPosting[] = [];
  const seen = new Set<string>();

  try {
    await page.goto(config.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // JavaScript로 상세검색 탭 활성화
    await page.evaluate(() => {
      const tab = document.querySelector<HTMLElement>('#tab02');
      if (tab) tab.click();
    });
    await page.waitForTimeout(1000);

    // 봉사명 키워드 입력 (지역 필터 없이 전체 검색)
    await page.fill('#searchKeyword', '박물관');

    // JavaScript로 검색 버튼 클릭
    await page.evaluate(() => {
      const btn = document.querySelector<HTMLElement>(
        '#tabs-02 button.btn-primary, #tabs-02 button.icon-search, button[onclick*="fn_search"]'
      );
      if (btn) btn.click();
    });
    await page.waitForTimeout(3000);

    // 최대 5페이지 수집 (지역 필터 없이 전체 박물관 공고 수집)
    for (let pageNum = 1; pageNum <= 5; pageNum++) {
      if (pageNum > 1) {
        const hasNextPage = await page.evaluate((n) => {
          const btn = document.querySelector(`a[onclick*="fn_paging(${n})"]`) as HTMLElement | null;
          if (btn) { btn.click(); return true; }
          const links = Array.from(document.querySelectorAll('.pagination a, .paging a'));
          const pageLink = links.find(a => a.textContent?.trim() === String(n)) as HTMLElement | null;
          if (pageLink) { pageLink.click(); return true; }
          return false;
        }, pageNum);
        if (!hasNextPage) break;
        await page.waitForTimeout(2000);
      }

      const rows = await page.$$eval('table tbody tr', (trs) => {
        return trs.map(tr => {
          const tds = tr.querySelectorAll('td');
          if (tds.length < 4) return null;

          // 제목: td[1] > a.tit
          const titleEl = tds[1]?.querySelector('a.tit');
          const title = titleEl?.textContent?.trim() || '';
          const href = titleEl?.getAttribute('href') || '';

          // 지역 정보: td[1] 안의 div.sub 또는 span
          const regionEl = tds[1]?.querySelector('div.sub, .location');
          const region = regionEl?.textContent?.trim() || '';

          // 모집기간: td[3]
          const recruitPeriod = tds[3]?.textContent?.trim() || '';
          // 상태: 마지막 td의 badge
          const statusEl = tr.querySelector('td:last-child span.badge, span.st-state');
          const status = statusEl?.textContent?.trim() || '';

          return { title, href, recruitPeriod, status, region };
        }).filter(r => r && r.title);
      });

      for (const row of rows as any[]) {
        const key = row.title;
        if (seen.has(key)) continue;
        seen.add(key);

        const dateMatches = row.recruitPeriod.match(/\d{4}\.\d{2}\.\d{2}/g) || [];
        const regDate = dateMatches[0] ? normalizeDate(dateMatches[0]) : '';
        const deadlineDate = dateMatches[1] ? normalizeDate(dateMatches[1]) : null;

        const idMatch = row.href?.match(/fn_view\('([^']+)'\)/);
        const url = idMatch
          ? `https://csv.culture.go.kr/frt/biz/provol/selectProvolView.do?provolNo=${idMatch[1]}`
          : null;

        allPostings.push({
          title: truncate(row.title),
          organization: '문화자원봉사센터',
          regDate,
          deadlineDate,
          url,
          status: row.status || '',
          postingType: 'experience',
        });
      }
    }
  } catch (err: any) {
    console.error('[csv-culture] 크롤링 실패:', err?.message);
  }

  return allPostings;
}
