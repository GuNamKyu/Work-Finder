// 서울역사편찬원 채용공고
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: 'history-seoul',
  name: '서울역사편찬원',
  url: 'https://history.seoul.go.kr/bbsctt/list.do?key=2210200044',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  await page.waitForSelector('ul li a', { timeout: 10000 }).catch(() => {});

  // 각 listitem: 번호|카테고리|제목(a 링크)|날짜 구조
  // 게시판 영역의 모든 li 중 a 태그 포함된 것만 처리
  return page.$$eval('main li, article li, #sub-contents li, .board-list li', (items) => {
    return items.map(li => {
      // 링크(제목)가 없으면 스킵
      const link = li.querySelector('a');
      if (!link) return null;
      const title = link.textContent?.trim() || '';
      if (!title) return null;

      // li 내 모든 자식 요소에서 카테고리와 날짜 추출
      const children = li.querySelectorAll(':scope > *');
      let category = '';
      let date = '';
      children.forEach(child => {
        if (child.tagName === 'A') return; // 링크는 제목이므로 스킵
        const text = child.textContent?.trim() || '';
        if (text === '채용' || text === '일반') category = text;
        else if (/^\d{4}-\d{2}-\d{2}$/.test(text)) date = text;
      });

      // 채용 카테고리인 경우만 반환
      if (category !== '채용') return null;
      return { title, date };
    }).filter(Boolean);
  }).then(items =>
    (items as any[]).map(item => ({
      title: truncate(item.title),
      organization: '서울역사편찬원',
      regDate: normalizeDate(item.date),
      deadlineDate: null,
      url: null,
    }))
  );
}

