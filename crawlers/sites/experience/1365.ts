// 1365 자원봉사포털 - 시간인증봉사 목록 크롤러
// 봉사지역: 서울특별시 / 경기도, 봉사명 키워드: 박물관
// 결과 구조: a.list[href*="show("] — 각 공고 링크
// DOM 내부:
//   div[0]: 카테고리 태그(ul li) + 봉사명(div)
//   div[1]: 지역(div > span) + 기관(div > span)
//   div[2]: 상태 + 마감
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../../types';
import { truncate } from '../../base';
import { openList, submitList } from '../../navigation.js';
import { PartialCrawlError } from '../../partial-crawl.js';

export const config: SiteConfig = {
  id: '1365-volunteer',
  name: '1365 자원봉사포털',
  url: 'https://www.1365.go.kr/vols/1572247904127/partcptn/timeCptn.do',
  type: 'experience',
};

// 봉사지역 select value 매핑 (실제 select option value 기준)
const REGIONS: { label: string; value: string }[] = [
  { label: '서울특별시', value: '6110000' },
  { label: '경기도',     value: '6410000' },
];

export async function scrape(page: Page): Promise<JobPosting[]> {
  const allPostings: JobPosting[] = [];
  const seen = new Set<string>();
  const failures: string[] = [];

  for (const region of REGIONS) {
    try {
      await openList(page, config.url, '#searchHopeArea1');

      // 봉사지역 시/도 선택
      await page.selectOption('#searchHopeArea1', { value: region.value });
      await page.waitForTimeout(500);

      // 봉사명 키워드 입력
      await page.fill('#searchKeyword', '박물관');

      // 검색 버튼 클릭 (id: btnSearch)
      await submitList(page, () => page.click('#btnSearch'), '#searchHopeArea1');

      // 최대 3페이지 수집
      for (let pageNum = 1; pageNum <= 3; pageNum++) {
        if (pageNum > 1) {
          const paginated = await page.evaluate((n) => Array.from(document.querySelectorAll('a'))
            .some(a => a.textContent?.trim() === String(n) && a.getAttribute('onclick')?.includes('goPage')), pageNum);
          if (!paginated) break;
          await submitList(page, () => page.evaluate((n) => {
            const links = Array.from(document.querySelectorAll('a'));
            const link = links.find(a => a.textContent?.trim() === String(n) && a.getAttribute('onclick')?.includes('goPage'));
            if (link) { (link as HTMLElement).click(); return true; }
            return false;
          }, pageNum), '#searchHopeArea1');
        }

        // a.list[href*="show("] 로 공고 링크 수집
        const items = await page.$$eval('a.list[href*="show("]', (links) => {
          return links.map(link => {
            const href = link.getAttribute('href') || '';
            const idMatch = href.match(/show\((\d+)\)/);
            const id = idMatch?.[1] || '';

            const allDivs = link.querySelectorAll('div');

            // 봉사명 추출: "카테고리 ul" 다음에 오는 단독 div (텍스트가 가장 긴 것)
            let title = '';
            for (const d of Array.from(allDivs)) {
              const t = d.textContent?.trim() || '';
              // ul 자식이 없고, 텍스트가 5글자 이상이며, 키워드 태그가 아닌 경우
              if (
                d.children.length === 0 &&
                t.length >= 5 &&
                !['시간인증', '활동인증', '오프라인', '온라인', '기타', '모집중', '모집완료', '마감', '금일', '금주'].some(kw => t === kw)
              ) {
                if (!title || t.length > title.length) title = t;
              }
            }

            // span 내 지역/기관명 추출
            const spans = link.querySelectorAll('span');
            const spanTexts = Array.from(spans)
              .map(s => s.textContent?.trim() || '')
              .filter(t => t.length > 0);
            // 지역: "서울특별시 OO구" 패턴
            const region = spanTexts.find(t => /특별시|광역시|도|시|군|구/.test(t) && t.length > 3) || '';
            // 기관: 지역 다음 span
            const regionIdx = spanTexts.indexOf(region);
            const org = regionIdx >= 0 ? (spanTexts[regionIdx + 1] || '') : (spanTexts[1] || '');

            // 상태 (모집중 / 모집완료)
            let status = '';
            for (const d of Array.from(allDivs)) {
              const t = d.textContent?.trim() || '';
              if (d.children.length === 0 && ['모집중', '모집완료'].includes(t)) {
                status = t;
                break;
              }
            }

            // 날짜는 a.list 외부 구조에 없어서 빈 값 처리 (마감 span에서 추출 시도)
            let deadlineText = '';
            for (const s of Array.from(link.querySelectorAll('span'))) {
              const t = s.textContent?.trim() || '';
              if (t === '마감' || t === '금일' || t === '금주') deadlineText = t;
            }

            return { title, org, id, region, status, deadlineText };
          }).filter(i => i.title && i.id);
        });

        for (const item of items as any[]) {
          const key = item.id + '::' + item.title;
          if (seen.has(key)) continue;
          seen.add(key);

          const url = item.id
            ? `https://www.1365.go.kr/vols/1572247904127/partcptn/timeCptn.do?type=show&progrmRegistNo=${item.id}`
            : config.url;

          allPostings.push({
            title: truncate(item.title),
            organization: item.org || item.region || '1365 자원봉사포털',
            regDate: '',
            deadlineDate: null,
            url,
            region: item.region,
            status: item.status || '',
            postingType: 'experience',
            experienceType: 'volunteer',
          });
        }
      }
    } catch (err: any) {
      console.error(`[1365] ${region.label} 크롤링 실패:`, err?.message);
      failures.push(`${region.label}: ${err?.message || 'Unknown error'}`);
    }
  }

  if (failures.length > 0) {
    throw new PartialCrawlError(`지역별 수집 실패(${failures.length}/${REGIONS.length}) — ${failures.join(' / ')}`, allPostings);
  }

  return allPostings;
}
