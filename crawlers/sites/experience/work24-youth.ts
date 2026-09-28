import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../../types.js';
import { periodFields, parsePeriod } from '../../schedule.js';

export const config: SiteConfig = {
  id: 'work24-youth', name: '고용24 청년일경험', type: 'experience',
  url: 'https://yw.work24.go.kr/d/a/selectWkexPrgmList.do',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  const postings: JobPosting[] = [];
  const seen = new Set<string>();
  // Parse server-rendered HTML without executing the site's legacy global Map override.
  await page.route('**/*', route => route.abort());
  let expected = 0;
  for (let n = 1; n <= 40; n++) {
    const response = await page.request.get(config.url, { params: { currentPageNo: n, recordCountPerPage: 48 }, timeout: 20000 });
    if (!response.ok()) throw new Error(`목록 HTTP ${response.status()}`);
    const html = (await response.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const data = await page.evaluate(() => ({
      total: Number(document.querySelector('.left.total strong')?.textContent?.trim().replace(/,/g, '')),
      rows: Array.from(document.querySelectorAll('.card-list > li')).map(li => {
        const a = li.querySelector('.link a');
        const fields: Record<string, string> = {};
        li.querySelectorAll('ul.list > li').forEach(row => {
          fields[row.querySelector('strong')?.textContent?.trim() || ''] = row.querySelector('span')?.textContent?.replace(/\s+/g, ' ').replace(/\u200b/g, '').trim() || '';
        });
        return { title: a?.textContent?.trim() || '', href: a?.getAttribute('href') || '', fields };
      }),
    }));
    if (n === 1) {
      if (!Number.isFinite(data.total)) throw new Error('공식 목록 총 건수 선택자 변경');
      expected = data.total;
    }
    for (const row of data.rows) {
      const match = row.href.match(/fn_searchDetail\('([^']+)','([^']+)'\)/);
      if (!match || !row.title) throw new Error('공식 목록 상세 식별자 파싱 실패');
      const [, kind, id] = match;
      if (seen.has(id)) throw new Error(`페이지 ${n}에서 중복 식별자 반환 — 페이지네이션 확인 필요`);
      seen.add(id);
      const fields = periodFields(row.fields['모집기간'], row.fields['일경험기간']);
      const training = parsePeriod(row.fields['사전직무교육'] || '');
      for (const [i, date] of training.entries()) if (date) fields.scheduleEvents!.push({ type: 'orientation', date, label: i ? '사전직무교육 종료' : '사전직무교육 시작', source: 'list', precision: 'exact', evidence: row.fields['사전직무교육'] });
      postings.push({
        title: row.title, organization: row.fields['참여기업'] || row.fields['운영기관'], postingId: id,
        regDate: '', deadlineDate: null, postedAt: null,
        // A public search link works in notifications; detail view itself requires POST.
        url: `${config.url}?pgnm=${encodeURIComponent(row.title)}`,
        sourceForm: { action: `https://yw.work24.go.kr/d/a/${kind === 'C' ? 'selectEntrTrvlPrgmDtal' : 'selectItrnPrjtEsgPrgmDtal'}.do`, fields: { untyPrgmCtn: id } },
        postingType: 'experience', recordKind: 'recruitment',
        experienceType: kind === 'I' ? 'internship' : kind === 'P' ? 'project' : 'work_experience',
        roleText: row.fields['직무'], region: row.fields['지역'], status: '모집중', detailStatus: 'list_only',
        summary: '미래내일 일경험. 연령·미취업 여부·직무별 지원요건은 원문 확인 필요.', ...fields,
      });
    }
    if (seen.size >= expected) return postings;
    if (!data.rows.length) break;
  }
  throw new Error(`목록 일부만 수집됨: ${seen.size}/${expected} — 정상 0건으로 처리하지 않음`);
}
