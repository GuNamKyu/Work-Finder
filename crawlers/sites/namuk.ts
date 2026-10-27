// 국립농업박물관 채용 포털 (공개 목록의 공고 링크 수집)
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types.js';
import { truncate } from '../base.js';

export const config: SiteConfig = {
  id: 'namuk',
  name: '국립농업박물관',
  url: 'https://namukrecruit.recruiter.co.kr/career/job',
};

export interface RecruiterPostingLink {
  title: string;
  href: string;
}

/** Keep only visible posting links from the institution's public career board. */
export function parsePostingLinks(links: RecruiterPostingLink[]): JobPosting[] {
  const seen = new Set<string>();
  const postings: JobPosting[] = [];

  for (const link of links) {
    const title = link.title.replace(/\s+/g, ' ').trim();
    if (!title) continue;

    let url: URL;
    try { url = new URL(link.href, config.url); }
    catch { continue; }
    if (url.origin !== 'https://namukrecruit.recruiter.co.kr' || !/^\/career\/jobs\/\d+\/?$/.test(url.pathname)) continue;
    url.search = '';
    url.hash = '';
    const canonicalUrl = url.toString();
    if (seen.has(canonicalUrl)) continue;
    seen.add(canonicalUrl);

    // 링크 문구에 "접수중 … 공채 일반채용 신입/경력 D-7 2026.10.27 ~ 2026.11.03 17:00"처럼
    // 상태·채용구분·접수기간이 함께 들어 있어 나눠 저장한다
    const status = title.match(/^(접수중|접수전|접수예정|마감|채용마감)\s*/)?.[1];
    const dates = [...title.matchAll(/(20\d{2})\.(\d{2})\.(\d{2})/g)].map(m => `${m[1]}-${m[2]}-${m[3]}`);
    const cleanTitle = title
      .replace(/^(접수중|접수전|접수예정|마감|채용마감)\s*/, '')
      .replace(/\s+(공채|수시|상시)\s+\S*채용\s.*$/, '')
      .replace(/\s*D-\d+.*$/, '')
      .trim();
    postings.push({
      title: truncate(cleanTitle || title),
      organization: '국립농업박물관',
      regDate: dates[0] || '',
      deadlineDate: dates[1] || null,
      url: canonicalUrl,
      ...(status ? { status } : {}),
    });
  }

  return postings;
}

export async function scrape(page: Page): Promise<JobPosting[]> {
  const selector = 'a[href*="/career/jobs/"]';
  await page.waitForSelector(selector, { timeout: 10000 }).catch(() => {});
  const links = await page.locator(selector).evaluateAll(anchors => anchors.map(anchor => ({
    // textContent는 칸 사이 공백이 없어 "접수중국립…D-82026.10.27"처럼 붙으므로 화면 텍스트(innerText) 사용
    title: ((anchor as HTMLElement).innerText || anchor.textContent || '').replace(/\s+/g, ' ').trim(),
    href: (anchor as HTMLAnchorElement).href,
  })));
  const postings = parsePostingLinks(links);
  if (postings.length) return postings;

  const bodyText = await page.locator('body').innerText().catch(() => '');
  if (/등록된 채용공고가 없습니다|진행 중인 채용공고가 없습니다|채용공고가 없습니다/.test(bodyText)) return [];
  throw new Error('국립농업박물관 채용 목록에서 공고 링크를 확인하지 못했습니다.');
}
