import type { CrawlResult } from './types.js';
import { canonicalizeUrl } from './opportunity.js';

/** Similar wording is not identity. Distinct organizations, rounds and URLs survive. */
export function deduplicateResults(results: CrawlResult[]): number {
  let removed = 0;
  const normalize = (s: string) => s.normalize('NFKC').replace(/\s+/g, '').toLowerCase();
  for (const result of results) {
    const seen = new Set<string>();
    result.postings = result.postings.filter(p => {
      // Keep cross-source records for independent source-health/history accounting.
      const key = p.postingId ? `id:${p.postingId}` : JSON.stringify([
        canonicalizeUrl(p.url), normalize(p.organization), normalize(p.title), p.regDate, p.applicationEndAt || p.deadlineDate,
      ]);
      if (seen.has(key)) { removed++; return false; }
      seen.add(key); return true;
    });
  }
  if (removed) console.log(`동일 소스의 확정 중복 ${removed}건 정리`);
  return removed;
}
