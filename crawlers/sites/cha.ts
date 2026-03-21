// 국가유산청 시험/채용 (cha.go.kr)
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'cha',
  name: '국가유산청(cha)',
  url: 'https://www.cha.go.kr/multiBbz/selectMultiBbzList.do?bbzId=newexam&mn=NS_01_06',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  return page.$$eval('table.tbl tbody tr', (rows) => {
    return rows.map(row => {
      const tds = row.querySelectorAll('td');
      if (tds.length < 5) return null;
      const titleEl = row.querySelector('a.b_tit');
      const title = titleEl?.textContent?.trim() || '';
      const href = titleEl?.getAttribute('href') || '';
      const regDate = row.querySelector('td[data-column="등록일"]')?.textContent?.trim() || tds[3]?.textContent?.trim() || '';
      const deadline = row.querySelector('td[data-column="마감일"]')?.textContent?.trim() || tds[4]?.textContent?.trim() || '';
      return { title, regDate, deadline, href };
    }).filter(Boolean);
  }).then(items =>
    (items as any[]).map(item => ({
      title: truncate(item.title),
      organization: '국가유산청',
      regDate: normalizeDate(item.regDate),
      deadlineDate: item.deadline ? normalizeDate(item.deadline) : null,
      url: item.href ? `https://www.cha.go.kr${item.href.split(';')[0]}` : null,
    }))
  );
}
