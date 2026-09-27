export interface JobPosting {
  title: string;
  organization: string;
  regDate: string;
  deadlineDate: string | null;
  url: string | null;
  status?: string;
  postingType?: 'job' | 'experience'; // 채용공고 or 직무경험(봉사/훈련)
  experienceType?: ExperienceType;
  postingId?: string;
  canonicalUrl?: string | null;
  postedAt?: string | null;
  applicationStartAt?: string | null;
  applicationEndAt?: string | null;
  programStartAt?: string | null;
  programEndAt?: string | null;
  scheduleEvents?: ScheduleEvent[];
  stableId?: string;
  lifecycleStatus?: LifecycleStatus;
  changeType?: ChangeType;
  fitScore?: number;
  fitBreakdown?: FitBreakdown;
  fitReasons?: string[];
  urgencyScore?: number;
  relevanceTier?: RelevanceTier;
  relevanceReasons?: string[];
  userVisible?: boolean;
  eligibilityStatus?: EligibilityStatus;
  eligibilityReasons?: string[];
}

export type RelevanceTier = 'target' | 'adjacent' | 'low_relevance' | 'administrative_notice';
export type EligibilityStatus = 'likely_eligible' | 'needs_review' | 'ineligible' | 'unknown';

export type ExperienceType =
  | 'internship'
  | 'work_experience'
  | 'volunteer'
  | 'project'
  | 'counseling'
  | 'training'
  | 'financial_support'
  | 'fair'
  | 'recurring_program';

export type LifecycleStatus = 'fresh' | 'active_long' | 'rolling' | 'stale_unknown' | 'closed';
export type ChangeType = 'baseline' | 'new' | 'updated' | 'reposted' | 'reopened' | 'unchanged' | 'resurfaced' | 'closed';

export type ScheduleEventType =
  | 'posted'
  | 'application_start'
  | 'application_end'
  | 'program_start'
  | 'program_end'
  | 'interview'
  | 'result'
  | 'orientation'
  | 'other';

export interface ScheduleEvent {
  type: ScheduleEventType;
  date: string;
  label?: string;
  precision?: 'exact' | 'month' | 'approximate' | 'unknown';
  source?: 'list' | 'detail' | 'attachment' | 'inferred';
  evidence?: string;
  confidence?: number;
}

export interface FitBreakdown {
  roleField: number;
  gapFill: number;
  eligibility: number;
  location: number;
  quality: number;
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
  warnings?: string[];
}

export type SiteScraper = (page: import('playwright').Page, config: SiteConfig) => Promise<JobPosting[]>;
