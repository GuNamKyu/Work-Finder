import { readFile, writeFile } from 'node:fs/promises';
import type { CrawlResult, JobPosting } from './types.js';
import { enrichPosting, stablePostingId } from './opportunity.js';
import { passesExclusions } from './base.js';

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

/** Keep error and attempt time intact; cached rows are never fresh observations. */
export function reconcileResults(current: CrawlResult[], previous: CrawlResult[], cache: CrawlResult[], now = new Date()) {
  const good = new Map(cache.map(r => [r.site.id, r]));
  for (const r of previous) {
    if (!r.error && (!good.has(r.site.id) || r.crawledAt > good.get(r.site.id)!.crawledAt)) good.set(r.site.id, r);
  }
  const results = current.map(r => {
    const clean = (p: JobPosting) => passesExclusions(p, r.site.type || 'job');
    const old = good.get(r.site.id);
    const oldById = new Map((old?.postings || []).map(p => [stablePostingId(r.site.id, p), p]));
    const observed = r.postings.filter(clean).map(p => {
      const prior = oldById.get(stablePostingId(r.site.id, p));
      const merged = { ...p, retainedSchedule: false };
      if (prior) for (const field of ['applicationStartAt', 'applicationEndAt', 'deadlineDate', 'programStartAt', 'programEndAt'] as const) {
        if (!p[field] && prior[field]) { merged[field] = prior[field]; merged.retainedSchedule = true; }
      }
      if (p.applicationEndAt || p.deadlineDate) merged.applicationEndAt = merged.deadlineDate = p.applicationEndAt || p.deadlineDate;
      if (merged.retainedSchedule) merged.scheduleEvents = [...(p.scheduleEvents || []), ...(prior?.scheduleEvents || []).filter(e => !(p.scheduleEvents || []).some(n => n.type === e.type))];
      return enrichPosting({ ...merged, verificationStatus: 'current', lastConfirmedAt: r.crawledAt }, r.site.id, now);
    });
    const ids = new Set(observed.map(p => p.stableId));
    const retained = r.error ? (old?.postings || []).filter(clean)
      .filter(p => !ids.has(stablePostingId(r.site.id, p)))
      .map(p => enrichPosting({ ...p, verificationStatus: 'retained', lastConfirmedAt: p.lastConfirmedAt || old!.crawledAt }, r.site.id, now)) : [];
    const result: CrawlResult = { ...r, postings: [...observed, ...retained], observedCount: observed.length, retainedCount: retained.length,
      lastSuccessfulAt: r.error ? (old?.lastSuccessfulAt !== undefined ? old.lastSuccessfulAt : old?.crawledAt || null) : r.crawledAt };
    // Successful zero is meaningful and must replace old data. Failure never does.
    if (!r.error) good.set(r.site.id, result);
    else if (observed.length) good.set(r.site.id, { ...result, error: undefined, crawledAt: old?.crawledAt || r.crawledAt,
      postings: [...observed, ...retained], lastSuccessfulAt: result.lastSuccessfulAt });
    return result;
  });
  // A single-source diagnostic run must not erase all other sites.
  const attempted = new Set(current.map(r => r.site.id));
  return { results: [...results, ...previous.filter(r => !attempted.has(r.site.id))], cache: [...good.values()] };
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
