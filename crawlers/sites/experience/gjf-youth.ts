import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../../types.js';

export const config: SiteConfig = {
  id: 'gjf-youth', name: '경기일자리재단 청년사업', type: 'experience',
  url: 'https://gjf.or.kr/main/main_biz/list.do?lclsf_sn=115&sclsf_sn=305',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  await page.goto(config.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const items = await page.locator('a[href*="main_biz_sn="]').evaluateAll(links => links.map(a => ({
    title: a.textContent?.replace(/\s+/g, ' ').trim() || '', url: (a as HTMLAnchorElement).href,
  })));
  const unique = new Map<string, JobPosting>();
  for (const item of items) {
    const id = new URL(item.url).searchParams.get('main_biz_sn');
    if (!id || !item.title || unique.has(id)) continue;
    unique.set(id, {
      title: item.title, organization: '경기도일자리재단', postingId: id,
      regDate: '', postedAt: null, deadlineDate: null,
      url: `https://gjf.or.kr/main/main_biz/search/view.do?main_biz_sn=${id}`,
      postingType: 'experience', recordKind: 'program_info', status: '모집일정 미확인',
      experienceType: /미래내일|직무실습|일자리 매치업/.test(item.title) ? 'work_experience' : /역량강화/.test(item.title) ? 'financial_support' : /채용지원/.test(item.title) ? 'counseling' : 'training',
      region: '경기', detailStatus: 'list_only',
      summary: '공식 청년사업 안내입니다. 사업 운영기간은 접수기간이 아닙니다. 원문의 모집 공고·신청 링크에서 현재 모집 여부와 참여자격을 확인하세요.',
    });
  }
  if (!unique.size) throw new Error('청년사업 목록을 찾지 못함 — 선택자 또는 사이트 상태 확인 필요');
  for (const posting of unique.values()) {
    try {
      await page.goto(posting.url!, { waitUntil: 'domcontentloaded', timeout: 10000 });
      const detail = await page.evaluate(() => {
        const fields: Record<string, string> = {};
        document.querySelectorAll('dl.cm_desc_list').forEach(dl => { fields[dl.querySelector('dt')?.textContent?.trim() || ''] = dl.querySelector('dd')?.textContent?.replace(/\s+/g, ' ').trim() || ''; });
        return { fields, links: Array.from(document.querySelectorAll('.btn_area a[href^="http"]')).map(a => ({ label: a.textContent?.trim() || '신청 안내', url: (a as HTMLAnchorElement).href })) };
      });
      posting.eligibilityText = detail.fields['사업대상'];
      posting.programPeriodText = detail.fields['사업시기'];
      posting.informationLinks = detail.links;
      if (!posting.eligibilityText && !posting.programPeriodText) throw new Error('사업 상세 필드가 비어 있음');
      posting.detailStatus = 'verified';
    } catch { posting.detailStatus = 'failed'; posting.detailWarning = '사업 상세 수집 실패 — 목록 안내만 보존'; }
  }
  return [...unique.values()];
}
