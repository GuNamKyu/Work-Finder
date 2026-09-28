import type { JobPosting, CrawlResult } from '../crawlers/types.js';
export function isActive(p: JobPosting, today?: string, includeUnverified?: boolean): boolean;
export function flattenResults(results: CrawlResult[]): Array<JobPosting & { siteId: string }>;
