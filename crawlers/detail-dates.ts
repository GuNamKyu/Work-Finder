import type { Page } from 'playwright';
import type { JobPosting } from './types.js';
import { extractSchedule } from './schedule.js';

/** Bounded, read-only detail enrichment. Missing dates are explicit, never replaced by publication dates. */
export async function enrichDetailDates(page: Page, postings: JobPosting[], limit = 12): Promise<JobPosting[]> {
  const candidates = postings.filter(p => p.recordKind !== 'program_info' && !p.applicationEndAt && !p.deadlineDate && p.url && !p.sourceForm);
  const target = await page.context().newPage();
  await target.route('**/*', route => route.abort());
  const deadline = Date.now() + 35000;
  try {
    for (const p of candidates.slice(0, limit)) {
      if (Date.now() >= deadline) break;
      try {
        const response = await page.request.get(p.url!, { timeout: Math.min(7000, deadline - Date.now()) });
        if (!response.ok()) throw new Error(`HTTP ${response.status()}`);
        await target.setContent((await response.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ''), { waitUntil: 'domcontentloaded' });
        const text = await target.evaluate(() => {
          document.querySelectorAll('tr, dl').forEach(el => el.append(document.createTextNode('\n')));
          return document.body.innerText.replace(/(모집\s*기간|접수\s*기간|신청\s*기간|봉사\s*기간|활동\s*기간|일경험\s*기간)\s*\n\s*/g, '$1 ');
        });
        const fields = extractSchedule(text);
        for (const key of ['applicationStartAt', 'applicationEndAt', 'deadlineDate', 'programStartAt', 'programEndAt'] as const) if (fields[key]) p[key] = fields[key];
        p.scheduleEvents = [...(p.scheduleEvents || []), ...(fields.scheduleEvents || [])];
        p.detailStatus = fields.applicationEndAt ? 'verified' : 'list_only';
        if (!fields.applicationEndAt) p.detailWarning = '본문에서 확정 접수기간을 찾지 못함 (첨부·이미지·동적 본문 확인 필요)';
      } catch (error) {
        p.detailStatus = 'failed';
        p.detailWarning = `상세 날짜 수집 실패: ${error instanceof Error ? error.message.split('\n')[0] : '알 수 없는 오류'}`;
      }
    }
    for (const p of candidates) if (!p.detailStatus) { p.detailStatus = 'list_only'; p.detailWarning = '회차별 상세 수집 한도 — 날짜 미확인'; }
  } finally { await target.close(); }
  return postings;
}
