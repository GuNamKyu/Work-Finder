// 서소문성지 역사박물관 채용공고 (div 기반 테이블 레이아웃)
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'seosomun',
  name: '서소문성지 역사박물관',
  url: 'https://www.seosomun.org/retrieveBoard.do?mCode=159',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  return page.$$eval('.list.wrap_tbl .tbody .tr', (rows) => {
    return rows.map(row => {
      const titleEl = row.querySelector('span.td.tit a, .td.col2 a');
      if (!titleEl) return null;
      // 숨겨진 라벨 제거 후 텍스트 추출
      const titleClone = titleEl.cloneNode(true) as HTMLElement;
      titleClone.querySelectorAll('.blind, em').forEach(el => el.remove());
      const title = titleClone.textContent?.trim() || '';
      const href = titleEl.getAttribute('href') || '';
      const dateEl = row.querySelector('span.td.datetime, .td.col3');
      const dateClone = dateEl?.cloneNode(true) as HTMLElement | undefined;
      dateClone?.querySelectorAll('.blind')?.forEach(el => el.remove());
      const date = dateClone?.textContent?.trim() || '';
      return { title, date, href };
    }).filter(r => r && r.title);
  }).then(items =>
    items.map(item => ({
      title: truncate(item.title),
      organization: '서소문성지 역사박물관',
      regDate: normalizeDate(item.date),
      deadlineDate: null,
      url: item.href ? `https://www.seosomun.org${item.href}` : null,
    }))
  );
}
