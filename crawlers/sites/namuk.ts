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

    postings.push({
      title: truncate(title),
      organization: '국립농업박물관',
      regDate: '',
      deadlineDate: null,
      url: canonicalUrl,
    });
  }

  return postings;
}

export async function scrape(page: Page): Promise<JobPosting[]> {
  const selector = 'a[href*="/career/jobs/"]';
  await page.waitForSelector(selector, { timeout: 10000 }).catch(() => {});
  const links = await page.locator(selector).evaluateAll(anchors => anchors.map(anchor => ({
    title: anchor.textContent?.replace(/\s+/g, ' ').trim() || '',
    href: (anchor as HTMLAnchorElement).href,
  })));
  const postings = parsePostingLinks(links);
  if (postings.length) return postings;

  const bodyText = await page.locator('body').innerText().catch(() => '');
  if (/등록된 채용공고가 없습니다|진행 중인 채용공고가 없습니다|채용공고가 없습니다/.test(bodyText)) return [];
  throw new Error('국립농업박물관 채용 목록에서 공고 링크를 확인하지 못했습니다.');
}
