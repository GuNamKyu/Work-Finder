export interface JobPosting {
  title: string;
  organization: string;
  regDate: string;
  deadlineDate: string | null;
  url: string | null;
  status?: string;
}

export interface SiteConfig {
  id: string;
  name: string;
  url: string;
  category?: string;
}

export interface CrawlResult {
  site: SiteConfig;
  postings: JobPosting[];
  crawledAt: string;
  error?: string;
}

export type SiteScraper = (page: import('playwright').Page, config: SiteConfig) => Promise<JobPosting[]>;
