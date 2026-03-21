// NCS 공정채용 (문화·예술·디자인·방송 > 문화·예술경영 > 문화재관리 > 문화재보존)
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'ncs',
  name: 'NCS 공정채용',
  url: 'https://www.ncs.go.kr/blind/bl04/RecrtNotifList.do',
};

async function waitAndSelect(page: Page, selector: string, value: string) {
  await page.waitForSelector(`${selector} option[value="${value}"]`, { timeout: 10000 });
  await page.selectOption(selector, value);
  await page.waitForTimeout(1000);
}

export async function scrape(page: Page): Promise<JobPosting[]> {
  try {
    // NCS 분류 필터 적용 (각 드롭다운은 이전 선택 후 AJAX로 로딩됨)
    await waitAndSelect(page, 'select[name="searchNcsLclasCd"]', '08');
    await waitAndSelect(page, 'select[name="searchNcsMclasCd"]', '01');
    await waitAndSelect(page, 'select[name="searchNcsSclasCd"]', '04');
    await waitAndSelect(page, 'select[name="searchNcsSbclasCd"]', '01');
  } catch {
    // 분류 필터 실패 시 필터 없이 전체 검색
    console.log('  [NCS] 분류 필터 적용 실패, 전체 목록에서 추출');
  }

  // 검색 실행
  const searchBtn = page.locator('a:has-text("검색"), button:has-text("검색")').first();
  await searchBtn.click().catch(() => {});
  await page.waitForTimeout(3000);

  return page.$$eval('table.boardtable_list tbody tr', (rows) => {
    return rows.map(row => {
      const tds = row.querySelectorAll('td');
      if (tds.length < 7) return null;
      const titleEl = row.querySelector('td.ta_l a.Boardtit');
      const title = titleEl?.getAttribute('title') || titleEl?.textContent?.trim() || '';
      const org = tds[2]?.textContent?.trim() || '';
      const status = tds[5]?.textContent?.trim() || '';
      const periodHtml = tds[6]?.innerHTML || '';
      const dates = periodHtml.replace(/<br\s*\/?>/g, ' ').replace(/~/g, '').trim();
      const dateMatches = dates.match(/\d{4}-\d{2}-\d{2}/g) || [];
      return { title, org, status, regDate: dateMatches[0] || '', deadlineDate: dateMatches[1] || null };
    }).filter(Boolean);
  }).then(items =>
    (items as any[]).filter(i => i.status?.includes('모집중')).map(item => ({
      title: truncate(item.title),
      organization: item.org,
      regDate: item.regDate,
      deadlineDate: item.deadlineDate,
      url: null,
      status: item.status,
    }))
  );
}
