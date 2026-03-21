// 나라일터 (wd=1286 문화재 분야)
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'gojobs-wd',
  name: '나라일터(문화재)',
  url: 'https://www.gojobs.go.kr/apmList.do?menuNo=401&mngrMenuYn=N&selMenuNo=400&wd=1286',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  await page.waitForTimeout(2000);

  return page.$$eval('table#apmTbl tbody tr', (rows) => {
    return rows.map(row => {
      const tds = row.querySelectorAll('td');
      if (tds.length < 5) return null;
      const titleEl = tds[1]?.querySelector('a');
      const title = titleEl?.textContent?.trim() || '';
      const org = tds[2]?.textContent?.trim() || '';
      const regDate = tds[3]?.textContent?.trim() || '';
      const deadline = tds[4]?.textContent?.trim() || '';
      return { title, org, regDate, deadline };
    }).filter(Boolean);
  }).then(items =>
    (items as any[]).map(item => ({
      title: truncate(item.title),
      organization: item.org,
      regDate: normalizeDate(item.regDate),
      deadlineDate: item.deadline ? normalizeDate(item.deadline) : null,
      url: null,
    }))
  );
}
