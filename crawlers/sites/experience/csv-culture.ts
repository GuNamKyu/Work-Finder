// 문화자원봉사센터(문화품앗이) 봉사자 모집공고 크롤러
// URL: https://csv.culture.go.kr/frt/biz/provol/selectProvolList.do
// 방식: 간단검색 탭에서 구분=문화 + 모집현황=모집중 필터 적용 후 전체 수집
// 검색: simple_fn_list(pageIndex) 호출로 폼 제출
// DOM (table tbody tr):
//   - td[0]: 구분(badge)
//   - td[1]: a.tit (제목), href = "javascript:fn_view('VOLT_...')"
//   - td[2]: 활동기간
//   - td[3]: 모집기간 (YYYY.MM.DD ~ YYYY.MM.DD)
//   - td[4]: 인원
//   - td[5]: 연령
//   - td[6]: 상태 (span.badge 또는 span.st-state)
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

    // 간단검색 탭(tab01) 활성화
    await page.evaluate(() => {
      const tab = document.querySelector<HTMLElement>('#tab01');
      if (tab) tab.click();
    });
    await page.waitForTimeout(500);

    // 구분 = 문화 (value 또는 label 기준)
    try {
      await page.selectOption('#simpleSearchCondition4', { value: '문화' });
    } catch {
      await page.selectOption('#simpleSearchCondition4', { label: '문화' });
    }
    await page.waitForTimeout(300);

    // 모집현황 = 모집중 (value 또는 label 기준)
    try {
      await page.selectOption('#simpleSearchCondition9', { value: '모집중' });
    } catch {
      await page.selectOption('#simpleSearchCondition9', { label: '모집중' });
    }
    await page.waitForTimeout(300);

    // 간단검색 폼 제출 (사이트의 실제 함수: simple_fn_list)
    await page.evaluate(() => {
      if (typeof (window as any).simple_fn_list === 'function') {
        (window as any).simple_fn_list(1);
      } else {
        // 폴백: 검색 버튼 직접 클릭
        const btn = document.querySelector<HTMLElement>(
          '#tabs-01 button.icon-search, #tabs-01 button[title="검색"]'
        );
        if (btn) btn.click();
      }
    });
    await page.waitForTimeout(3000);

    // 최대 10페이지 수집
    for (let pageNum = 1; pageNum <= 10; pageNum++) {
      if (pageNum > 1) {
        const hasNextPage = await page.evaluate((n) => {
          // 간단검색 페이지네이션: simple_fn_list(n)
          if (typeof (window as any).simple_fn_list === 'function') {
            (window as any).simple_fn_list(n);
            return true;
          }
          // 폴백: 페이지 링크 클릭
          const links = Array.from(document.querySelectorAll('.pagination a, .paging a'));
          const pageLink = links.find(a => a.textContent?.trim() === String(n)) as HTMLElement | null;
          if (pageLink) { pageLink.click(); return true; }
          return false;
        }, pageNum);
        if (!hasNextPage) break;
        await page.waitForTimeout(3000);
      }

      const rows = await page.$$eval('table tbody tr', (trs) => {
        return trs.map(tr => {
          const tds = tr.querySelectorAll('td');
          if (tds.length < 4) return null;

          // 제목: td[1] > a.tit
          const titleEl = tds[1]?.querySelector('a.tit');
          const title = titleEl?.textContent?.trim() || '';
          const href = titleEl?.getAttribute('href') || '';

          // 활동기간: td[2], 모집기간: td[3]
          const activityPeriod = tds[2]?.textContent?.trim() || '';
          const recruitPeriod = tds[3]?.textContent?.trim() || '';
          // 상태: 마지막 td의 badge (span.badge, span.st-state, 또는 클래스 없는 span)
          const lastTd = tds[tds.length - 1];
          const statusEl = lastTd?.querySelector('span.badge, span.st-state, span');
          const status = statusEl?.textContent?.trim() || '';

          return { title, href, activityPeriod, recruitPeriod, status };
        }).filter(r => r && r.title);
      });

      if (rows.length === 0) break;

      for (const row of rows as any[]) {
        const key = row.title;
        if (seen.has(key)) continue;
        seen.add(key);

        const dateMatches = row.recruitPeriod.match(/\d{4}\.\d{2}\.\d{2}/g) || [];
        const regDate = dateMatches[0] ? normalizeDate(dateMatches[0]) : '';
        const deadlineDate = dateMatches[1] ? normalizeDate(dateMatches[1]) : null;
        const activityDates = row.activityPeriod.match(/\d{4}\.\d{2}\.\d{2}/g) || [];
        const programStartAt = activityDates[0] ? normalizeDate(activityDates[0]) : null;
        const programEndAt = activityDates[1] ? normalizeDate(activityDates[1]) : null;

        const idMatch = row.href?.match(/fn_view\('([^']+)'\)/);
        const url = idMatch
          ? `https://csv.culture.go.kr/frt/biz/provol/selectProvolView.do?provolNo=${idMatch[1]}`
          : null;

        allPostings.push({
          title: truncate(row.title),
          organization: '문화자원봉사센터',
          regDate,
          deadlineDate,
          applicationStartAt: regDate || null,
          applicationEndAt: deadlineDate,
          programStartAt,
          programEndAt,
          url,
          status: row.status || '',
          postingType: 'experience',
        });
      }
    }
  } catch (err: any) {
    console.error('[csv-culture] 크롤링 실패:', err?.message);
    throw err;
  }

  return allPostings;
}
