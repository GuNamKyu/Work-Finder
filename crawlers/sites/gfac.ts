// 관악문화재단 채용정보 (차수별 아코디언 목록, 접힌 차수도 DOM에 있음)
// 과거 전 차수(수백 건)가 한 페이지에 있으므로 다른 게시판의 첫 페이지 범위에 맞춰 최근 차수만 수집
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'gfac',
  name: '관악문화재단',
  url: 'https://gfac.or.kr/site/main/recruit/accordionList',
};

const RECENT_ROUNDS = 3;

export async function scrape(page: Page): Promise<JobPosting[]> {
  const items = await page.$$eval('.recruit-list .recruit-item', (rounds, limit) => rounds.slice(0, limit)
    .flatMap(round => [...round.querySelectorAll('.round-details a')]).map(link => ({
    title: link.querySelector('.recruit_tit')?.textContent?.trim() || '',
    category: link.querySelector('.recruit_cate')?.textContent?.trim() || '',
    date: link.querySelector('.recruit_date')?.textContent?.trim() || '',
    href: (link as HTMLAnchorElement).href,
  })).filter(item => item.title), RECENT_ROUNDS);
  return items.map(item => ({
    title: truncate(item.category && item.category !== '채용공고' ? `[${item.category}] ${item.title}` : item.title),
    organization: '관악문화재단',
    regDate: normalizeDate(item.date),
    deadlineDate: null,
    url: item.href.startsWith('http') ? item.href : null,
  }));
}
