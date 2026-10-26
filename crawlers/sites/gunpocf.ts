// 군포문화재단 채용공고 (제목 링크가 href="#none" 스크립트 이동이라 상세 URL 미확보 → 목록 URL만 기록)
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'gunpocf',
  name: '군포문화재단',
  url: 'https://www.gunpocf.or.kr/cf/ntt/nttList/BBS007',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  const items = await page.$$eval('tr[data-id]', rows => rows.map(row => ({
    id: row.getAttribute('data-id') || '',
    title: row.querySelector('td.td-subject a')?.textContent?.trim() || '',
    date: row.querySelector('td.td-date')?.textContent?.trim() || '',
  })).filter(item => item.title));
  return items.map(item => ({
    title: truncate(item.title),
    organization: '군포문화재단',
    regDate: normalizeDate(item.date),
    deadlineDate: null,
    url: null,
    postingId: item.id || undefined,
  }));
}
