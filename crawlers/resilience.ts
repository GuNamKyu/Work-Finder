import { readFile, writeFile } from 'node:fs/promises';
import type { CrawlResult, JobPosting } from './types.js';
import { enrichPosting, stablePostingId } from './opportunity.js';
import { passesExclusions } from './base.js';
import { dropSecondaryDuplicates } from './secondary-sources.js';

export async function readResults(path: string): Promise<CrawlResult[]> {
  try {
    const value = JSON.parse(await readFile(path, 'utf8'));
    if (!Array.isArray(value) || value.some(r => !r?.site?.id || !Array.isArray(r.postings))) throw new Error(`유효하지 않은 수집 기록: ${path}`);
    return value;
  } catch (error: any) {
    if (error.code === 'ENOENT') return [];
    throw error; // Corrupt history is not an empty successful baseline.
  }
}

const kstDay = (date: Date) => new Date(date.getTime() + 9 * 3600_000).toISOString().slice(0, 10);

/**
 * 수집 기간 규칙: 등록일이 한 달 넘게 지났거나, 확인된 접수 마감일이 이미 지난 공고는 결과에 넣지 않는다.
 * 날짜가 없는 공고(사업 안내 등)는 이 규칙으로 빼지 않는다. 날짜는 한국 시간 기준.
 */
export function isWithinCollectionWindow(posting: JobPosting, now = new Date()): boolean {
  const today = kstDay(now);
  const cutoff = new Date(`${today}T00:00:00Z`);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 1);
  const regDate = /^\d{4}-\d{2}-\d{2}/.test(posting.regDate || '') ? posting.regDate.slice(0, 10) : '';
  if (regDate && regDate < cutoff.toISOString().slice(0, 10)) return false;
  const end = posting.applicationEndAt || posting.deadlineDate || '';
  if (/^\d{4}-\d{2}-\d{2}/.test(end) && end.slice(0, 10) < today) return false;
  return true;
}

// 등록일이 없으면 같은 제목이라도 다른 회차일 수 있어 같은 공고로 보지 않는다
const sameNotice = (a: JobPosting, b: JobPosting) => !!a.regDate && a.regDate === b.regDate &&
  a.title.replace(/[\s[\]()]/g, '') === b.title.replace(/[\s[\]()]/g, '');

/** Keep error and attempt time intact; cached rows are never fresh observations. */
export function reconcileResults(current: CrawlResult[], previous: CrawlResult[], cache: CrawlResult[], now = new Date()) {
  const good = new Map(cache.map(r => [r.site.id, r]));
  for (const r of previous) {
    if (!r.error && (!good.has(r.site.id) || r.crawledAt > good.get(r.site.id)!.crawledAt)) good.set(r.site.id, r);
  }
  const results = current.map(r => {
    const clean = (p: JobPosting) => passesExclusions(p, r.site.type || 'job') && isWithinCollectionWindow(p, now);
    const old = good.get(r.site.id);
    const oldById = new Map((old?.postings || []).map(p => [stablePostingId(r.site.id, p), p]));
    const observed = r.postings.filter(clean).map(p => {
      const prior = oldById.get(stablePostingId(r.site.id, p));
      const merged = { ...p, retainedSchedule: false };
      if (!p.detailCheckedAt && prior?.detailCheckedAt) merged.detailCheckedAt = prior.detailCheckedAt;
      if (prior) for (const field of ['applicationStartAt', 'applicationEndAt', 'deadlineDate', 'programStartAt', 'programEndAt'] as const) {
        if (!p[field] && prior[field]) { merged[field] = prior[field]; merged.retainedSchedule = true; }
      }
      if (p.applicationEndAt || p.deadlineDate) merged.applicationEndAt = merged.deadlineDate = p.applicationEndAt || p.deadlineDate;
      if (merged.retainedSchedule) merged.scheduleEvents = [...(p.scheduleEvents || []), ...(prior?.scheduleEvents || []).filter(e => !(p.scheduleEvents || []).some(n => n.type === e.type))];
      return enrichPosting({ ...merged, verificationStatus: 'current', lastConfirmedAt: r.crawledAt }, r.site.id, now);
    }).filter(p => isWithinCollectionWindow(p, now)); // 이전 기록에서 이어받은 마감일까지 반영해 다시 확인
    // 이번에 화면에서 본 공고는 기간 규칙으로 빠졌더라도 이전 사본을 보존본으로 되살리지 않는다
    const ids = new Set([...observed.map(p => p.stableId), ...r.postings.map(p => stablePostingId(r.site.id, p))]);
    const retained = r.error ? (old?.postings || []).filter(clean)
      .filter(p => !ids.has(stablePostingId(r.site.id, p)))
      // 같은 공고가 URL 형식만 바뀌어 다른 ID가 된 경우: 이번에 본 공고가 있으면 이전 기록은 남기지 않는다
      .filter(p => !observed.some(o => sameNotice(o, p)))
      .map(p => enrichPosting({ ...p, verificationStatus: 'retained', lastConfirmedAt: p.lastConfirmedAt || old!.crawledAt }, r.site.id, now)) : [];
    const result: CrawlResult = { ...r, postings: [...observed, ...retained], observedCount: observed.length, retainedCount: retained.length,
      lastSuccessfulAt: r.error ? (old?.lastSuccessfulAt !== undefined ? old.lastSuccessfulAt : old?.crawledAt || null) : r.crawledAt };
    // Successful zero is meaningful and must replace old data. Failure never does.
    if (!r.error) good.set(r.site.id, result);
    // 화면에서 본 행이 있으면(기간 규칙으로 모두 빠졌어도) 캐시를 갱신해 이전 사본이 다음 실패 때 되살아나지 않게 한다
    else if (r.postings.length) good.set(r.site.id, { ...result, error: undefined, crawledAt: old?.crawledAt || r.crawledAt,
      postings: [...observed, ...retained], lastSuccessfulAt: result.lastSuccessfulAt });
    return result;
  });
  // A single-source diagnostic run must not erase all other sites.
  const attempted = new Set(current.map(r => r.site.id));
  // Portal copies of postings already on an original board (current or retained) are not collected.
  // 이번에 시도하지 않은 소스의 이전 결과에도 수집 기간 규칙을 적용한다(시간이 지나 기간을 벗어난 공고 정리)
  const untouched = previous.filter(r => !attempted.has(r.site.id))
    .map(r => ({ ...r, postings: r.postings.filter(p => isWithinCollectionWindow(p, now)) }));
  return { results: dropSecondaryDuplicates([...results, ...untouched]), cache: [...good.values()] };
}

export async function saveResilientResults(path: string, current: CrawlResult[]) {
  const previousPath = path.replace(/\.json$/, '.prev.json');
  const cachePath = path.replace(/\.json$/, '.last-good.json');
  const previous = await readResults(previousPath);
  const snapshot = await readResults(path);
  const cache = await readResults(cachePath);
  const merged = reconcileResults(current, snapshot.length ? snapshot : previous, reconcileResults([], previous, cache).cache);
  await writeFile(cachePath, JSON.stringify(merged.cache, null, 2));
  await writeFile(path, JSON.stringify(merged.results, null, 2));
  return merged.results;
}
