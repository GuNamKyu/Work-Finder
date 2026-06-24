// 대한민국 정책브리핑 채용정보
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'korea-kr',
  name: '정책브리핑',
  url: 'https://www.korea.kr/archive/recruitInfoList.do',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  await page.waitForSelector('table tbody tr', { timeout: 15000 }).catch(() => {});

  return page.$$eval('table tbody tr', (rows) => {
    return rows.map(row => {
      const tds = row.querySelectorAll('td');
      if (tds.length < 4) return null;

      // 제목 및 링크
      const titleEl = tds[0]?.querySelector('a');
      const title = titleEl?.textContent?.trim() || '';
      const href = titleEl?.getAttribute('href') || '';

      // 기관명
      const org = tds[1]?.textContent?.trim() || '';
      // 게시일
      const regDate = tds[2]?.textContent?.trim() || '';
      // 공고 마감일
      const deadline = tds[3]?.textContent?.trim() || '';

      return { title, href, org, regDate, deadline };
    }).filter(Boolean);
  }).then(items =>
    (items as any[]).map(item => ({
      title: truncate(item.title),
      organization: item.org || '정책브리핑',
      regDate: normalizeDate(item.regDate),
      deadlineDate: item.deadline ? normalizeDate(item.deadline) : null,
      url: item.href
        ? `https://www.korea.kr${item.href}`
        : null,
    }))
  );
}

