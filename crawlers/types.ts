export interface JobPosting {
  title: string;
  organization: string;
  regDate: string;
  deadlineDate: string | null;
  url: string | null;
  status?: string;
  postingType?: 'job' | 'experience'; // 채용공고 or 직무경험(봉사/훈련)
}

export interface SiteConfig {
  id: string;
  name: string;
  url: string;
  category?: string;
  type?: 'job' | 'experience'; // 사이트 유형
}

export interface CrawlResult {
  site: SiteConfig;
  postings: JobPosting[];
  crawledAt: string;
  error?: string;
}

export type SiteScraper = (page: import('playwright').Page, config: SiteConfig) => Promise<JobPosting[]>;
