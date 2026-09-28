import type { JobPosting } from './types.js';
// Preserve successful pages/regions while reporting the original failure.
export class PartialCrawlError extends Error {
  constructor(message: string, public readonly postings: JobPosting[]) { super(message); }
}
