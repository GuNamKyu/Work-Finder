// 은평문화재단 채용정보 (상세는 reg_view(uid) POST 폼이지만 GET ?type=view&uid= 로도 열림)
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'efac',
  name: '은평문화재단',
  url: 'https://www.efac.or.kr/page08/sub02.php',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  // 구조: 번호, 상태(마감 등), 제목(a[href*=reg_view]), 작성자, 조회, 등록일
  // 레이아웃용 바깥 표의 tr도 링크를 포함하므로 표를 품은 행은 제외
  const items = await page.$$eval('tr', rows => rows.filter(row => !row.querySelector('table')).map(row => {
    const link = row.querySelector('a[href*="reg_view"]');
    const tds = row.querySelectorAll('td');
    return {
      title: link?.textContent?.trim() || '',
      uid: link?.getAttribute('href')?.match(/reg_view\('(\d+)'\)/)?.[1] || '',
      status: tds[1]?.textContent?.trim() || '',
      date: tds[tds.length - 1]?.textContent?.trim() || '',
    };
  }).filter(item => item.title && item.uid));
  return items.map(item => ({
    title: truncate(item.title),
    organization: '은평문화재단',
    regDate: normalizeDate(item.date),
    deadlineDate: null,
    status: item.status || undefined,
    url: `https://www.efac.or.kr/page08/sub02.php?type=view&uid=${item.uid}`,
  }));
}
