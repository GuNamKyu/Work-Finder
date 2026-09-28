import { appendFile, mkdir, readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { ChangeType, CrawlResult, JobPosting } from './types.js';
import { enrichPosting, isUserVisiblePosting, normalizedTitle, postingFingerprint } from './opportunity.js';
import { passesExclusions } from './base.js';
import { isActive } from '../web/model.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const dataDir = join(rootDir, 'data');

interface IndexedPosting extends JobPosting { siteId: string; siteName: string; }
interface OpportunityEvent {
  runAt: string; type: ChangeType; stableId: string; siteId: string; siteName: string;
  posting: IndexedPosting; previous?: IndexedPosting;
}
type HealthStatus = 'OK' | 'ERROR' | 'PARTIAL' | 'ZERO_ANOMALY' | 'COUNT_DROP' | 'FIELD_DROP' | 'STALE' | 'RECOVERED';
interface SourceHealth {
  siteId: string; siteName: string; status: HealthStatus; currentCount: number;
  previousCount: number | null; deadlineCoverage: number; urlCoverage: number; message: string;
  retainedCount: number; lastSuccessfulAt?: string | null;
}
interface OpportunityState {
  firstSeen: string; lastSeen: string; lastFingerprint: string; seenCount: number;
  lastStatus: string; seenDates: string[];
}
interface ProgramSeries {
  key: string; representativeTitle: string; sourceIds: string[]; occurrences: number;
  observedMonths: number[]; opportunityIds: string[]; firstSeen: string; lastSeen: string; likelyMonths: number[];
}

async function readJson<T>(path: string): Promise<T | null> {
  try { return JSON.parse(await readFile(path, 'utf-8')) as T; } catch { return null; }
}

function flatten(results: CrawlResult[]): IndexedPosting[] {
  return results.flatMap(result => result.postings
    // 정책 변경 전의 캐시 결과에도 현재 제외 목록을 동일하게 적용해 가짜 종료 알림을 막는다.
    .filter(posting => passesExclusions(posting, result.site.type || 'job'))
    .map(posting => ({
    ...enrichPosting(posting, result.site.id), siteId: result.site.id, siteName: result.site.name,
  })));
}

function titleOrgKey(posting: JobPosting): string {
  return `${normalizedTitle(posting.title)}::${(posting.organization || '').replace(/\s+/g, '').toLowerCase()}`;
}

function coverage(postings: JobPosting[], selector: (posting: JobPosting) => unknown): number {
  if (!postings.length) return 0;
  return Math.round((postings.filter(selector).length / postings.length) * 100);
}

export function analyzeSources(current: CrawlResult[], previous: CrawlResult[]): SourceHealth[] {
  const previousById = new Map(previous.map(result => [result.site.id, result]));
  const now = Date.now();
  return current.map(result => {
    const prev = previousById.get(result.site.id);
    const currentPostings = result.postings.filter(p => p.verificationStatus !== 'retained' && passesExclusions(p, result.site.type || 'job'));
    const previousPostings = prev?.postings.filter(p => passesExclusions(p, prev.site.type || 'job')) || [];
    const currentCount = result.observedCount ?? (result.error ? 0 : currentPostings.length);
    const retainedCount = result.retainedCount || 0;
    const previousCount = prev ? previousPostings.length : null;
    const deadlineCoverage = coverage(currentPostings, p => p.applicationEndAt || p.deadlineDate);
    const urlCoverage = coverage(currentPostings, p => p.url);
    let status: HealthStatus = 'OK';
    let message = '정상 수집';
    if (result.error) {
      status = currentCount > 0 ? 'PARTIAL' : 'ERROR';
      message = `수집 ${currentCount > 0 ? '부분 실패' : '실패'}: ${result.error} · 이번 확인 ${currentCount}건 / 이전 확인값 ${retainedCount}건 보존${result.lastSuccessfulAt ? ` · 마지막 전체 성공 ${result.lastSuccessfulAt}` : ''}`;
    } else if (prev?.error) {
      status = 'RECOVERED'; message = `이전 실패에서 복구됨 (${currentCount}건)`;
    } else if (previousCount !== null && previousCount > 0 && currentCount === 0) {
      status = 'ZERO_ANOMALY'; message = `이전 ${previousCount}건에서 0건으로 감소`;
    } else if (previousCount !== null && previousCount >= 5 && currentCount <= Math.floor(previousCount * 0.3)) {
      status = 'COUNT_DROP'; message = `수집량 급감: ${previousCount}건 → ${currentCount}건`;
    } else if (prev && currentCount >= 5) {
      const oldDeadline = coverage(previousPostings, p => p.applicationEndAt || p.deadlineDate);
      const oldUrl = coverage(previousPostings, p => p.url);
      if (oldDeadline - deadlineCoverage >= 40 || oldUrl - urlCoverage >= 40) {
        status = 'FIELD_DROP';
        message = `필드 완성도 급락: 마감 ${oldDeadline}%→${deadlineCoverage}%, URL ${oldUrl}%→${urlCoverage}%`;
      }
    }
    const crawledAt = new Date(result.crawledAt).getTime();
    if (status === 'OK' && (!Number.isFinite(crawledAt) || now - crawledAt > 36 * 60 * 60 * 1000)) {
      status = 'STALE'; message = `마지막 수집 시각이 36시간 이상 지남: ${result.crawledAt}`;
    }
    if (status === 'OK' && currentPostings.some(p => p.detailStatus === 'failed')) {
      status = 'PARTIAL'; message = `목록 수집 성공, 상세 날짜 수집 ${currentPostings.filter(p => p.detailStatus === 'failed').length}건 실패`;
    }
    return { siteId: result.site.id, siteName: result.site.name, status, currentCount, previousCount, deadlineCoverage, urlCoverage, retainedCount, lastSuccessfulAt: result.lastSuccessfulAt, message };
  });
}

function updateSeries(postings: IndexedPosting[], existing: Record<string, ProgramSeries>, runAt: string): Record<string, ProgramSeries> {
  const next = { ...existing };
  for (const posting of postings) {
    if (posting.recordKind === 'program_info') continue;
    const key = `${posting.siteId}::${normalizedTitle(posting.title)}`;
    if (key.endsWith('::')) continue;
    if (!next[key]) {
      next[key] = { key, representativeTitle: posting.title, sourceIds: [posting.siteId], occurrences: 0, observedMonths: [], opportunityIds: [], firstSeen: runAt, lastSeen: '', likelyMonths: [] };
    }
    const series = next[key];
    series.opportunityIds ||= [];
    const month = Number((posting.applicationStartAt || '').slice(5, 7));
    if (!series.opportunityIds.includes(posting.stableId!)) {
      series.opportunityIds.push(posting.stableId!);
      series.occurrences = series.opportunityIds.length;
    }
    if (month >= 1 && month <= 12 && !series.observedMonths.includes(month)) series.observedMonths.push(month);
    series.lastSeen = runAt;
    series.representativeTitle = posting.title;
    series.likelyMonths = series.observedMonths.slice().sort((a, b) => a - b);
  }
  return next;
}

function priority(posting: JobPosting): string {
  if (posting.recordKind === 'program_info') return 'P4';
  const fit = posting.fitScore || 0, urgency = posting.urgencyScore || 0;
  if (fit >= 70 && urgency >= 75) return 'P1';
  if (fit >= 70) return 'P2';
  // 점수가 다소 낮더라도 명확한 목표 직무는 일일 요약에서 놓치지 않는다.
  // 인접 기회는 홈페이지에는 보이되 Discord 상세에서는 P4로 요약한다.
  if (posting.relevanceTier === 'target') return 'P3';
  if (posting.postingType === 'experience' && posting.userVisible && posting.experienceType !== 'volunteer') return 'P3';
  return 'P4';
}

async function main(): Promise<void> {
  const runAt = new Date().toISOString();
  const currentJob = await readJson<CrawlResult[]>(join(__dirname, 'results.json'));
  if (!currentJob) throw new Error('results.json을 찾을 수 없습니다.');
  const currentExperience = await readJson<CrawlResult[]>(join(__dirname, 'experience-results.json')) || [];
  const previousJob = await readJson<CrawlResult[]>(join(__dirname, 'results.prev.json'));
  const previousExperience = await readJson<CrawlResult[]>(join(__dirname, 'experience-results.prev.json'));
  const hasBaseline = previousJob !== null || previousExperience !== null;
  const currentResults = [...currentJob, ...currentExperience];
  for (const result of currentResults) result.postings = result.postings
    .filter(p => passesExclusions(p, result.site.type || 'job'))
    .map(p => enrichPosting(p, result.site.id));
  const previousResults = [...(previousJob || []), ...(previousExperience || [])];
  const current = flatten(currentResults), previous = flatten(previousResults);
  const sourcesWithBaseline = new Set(previousResults.map(result => result.site.id));
  const previousById = new Map(previous.map(posting => [posting.stableId!, posting]));
  const previousByTitleOrg = new Map(previous.map(posting => [titleOrgKey(posting), posting]));
  const currentIds = new Set(current.map(posting => posting.stableId!));
  const statePath = join(dataDir, 'opportunity-state.json');
  const state = await readJson<Record<string, OpportunityState>>(statePath) || {};
  const events: OpportunityEvent[] = [];

  for (const posting of current) {
    if (posting.verificationStatus === 'retained') {
      posting.changeType = 'unchanged';
      // Cached evidence is not a new discovery or another successful observation.
      continue;
    }
    const old = previousById.get(posting.stableId!);
    const similar = previousByTitleOrg.get(titleOrgKey(posting));
    const priorState = state[posting.stableId!];
    let type: ChangeType;
    if (!sourcesWithBaseline.has(posting.siteId)) type = 'baseline';
    else if (old) type = postingFingerprint(old) === postingFingerprint(posting) ? 'unchanged' : 'updated';
    else if (priorState && priorState.lastSeen.slice(0, 10) < runAt.slice(0, 10)) type = 'resurfaced';
    else if (similar?.lifecycleStatus === 'closed') type = 'reopened';
    else if (similar) type = 'reposted';
    else type = 'new';
    posting.changeType = type;
    events.push({ runAt, type, stableId: posting.stableId!, siteId: posting.siteId, siteName: posting.siteName, posting, previous: old });
    const fingerprint = postingFingerprint(posting);
    state[posting.stableId!] = {
      firstSeen: priorState?.firstSeen || runAt, lastSeen: runAt, lastFingerprint: fingerprint,
      seenCount: (priorState?.seenCount || 0) + 1, lastStatus: posting.lifecycleStatus || 'fresh',
      seenDates: [...new Set([...(priorState?.seenDates || []), runAt.slice(0, 10)])].slice(-120),
    };
  }

  const healthySources = new Set(currentResults.filter(r => !r.error).map(r => r.site.id));
  for (const posting of previous) {
    if (!currentIds.has(posting.stableId!) && healthySources.has(posting.siteId)) {
      const type = posting.lifecycleStatus === 'closed' ? 'closed' : 'missing';
      events.push({ runAt, type, stableId: posting.stableId!, siteId: posting.siteId, siteName: posting.siteName, posting });
      if (state[posting.stableId!]) state[posting.stableId!].lastStatus = type;
    }
  }

  const newTypes: ChangeType[] = ['new', 'reposted', 'reopened', 'resurfaced'];
  // 전체 이벤트는 상태·이력에 보존하고, 사용자용 신규 목록과 알림만 관련성 기준으로 제한한다.
  const visibleCurrent = current.filter(p => isUserVisiblePosting(p) && isActive(p));
  const newPostings = events
    .filter(e => newTypes.includes(e.type) && isUserVisiblePosting(e.posting) && isActive(e.posting))
    .map(e => ({ ...e.posting, changeType: e.type }));
  const sourceHealth = analyzeSources(currentResults, previousResults);
  const sourceIssues = sourceHealth.filter(source => !['OK', 'RECOVERED'].includes(source.status));
  const changed = events.filter(e => e.type !== 'unchanged' && e.type !== 'baseline');
  const visibleChanged = changed.filter(e => isUserVisiblePosting(e.posting) && (e.type === 'closed' || isActive(e.posting)));
  const urgent = events.filter(e => !['closed', 'missing'].includes(e.type) && e.posting.verificationStatus !== 'retained' && !e.posting.retainedSchedule && isUserVisiblePosting(e.posting) && isActive(e.posting) && priority(e.posting) === 'P1')
    .sort((a, b) => (b.posting.fitScore || 0) - (a.posting.fitScore || 0));
  const summary = {
    generatedAt: runAt, baselineCreated: !hasBaseline,
    totals: {
      current: visibleCurrent.length, collected: current.length,
      new: visibleChanged.filter(e => e.type === 'new').length,
      updated: visibleChanged.filter(e => e.type === 'updated').length,
      reposted: visibleChanged.filter(e => e.type === 'reposted').length,
      reopened: visibleChanged.filter(e => e.type === 'reopened').length,
      resurfaced: visibleChanged.filter(e => e.type === 'resurfaced').length,
      closed: visibleChanged.filter(e => e.type === 'closed').length, sourceIssues: sourceIssues.length,
    },
    urgent: urgent.slice(0, 20).map(e => ({ ...e.posting, priority: priority(e.posting) })),
    changes: visibleChanged
      .sort((a, b) => (b.posting.fitScore || 0) - (a.posting.fitScore || 0) || (b.posting.urgencyScore || 0) - (a.posting.urgencyScore || 0))
      .slice(0, 50)
      .map(e => ({ type: e.type, ...e.posting, priority: priority(e.posting) })),
    sourceIssues,
  };

  await mkdir(dataDir, { recursive: true });
  await mkdir(join(dataDir, 'history'), { recursive: true });
  const seriesPath = join(dataDir, 'program-series.json');
  const series = updateSeries(current.filter(p => p.verificationStatus !== 'retained'), await readJson<Record<string, ProgramSeries>>(seriesPath) || {}, runAt);
  const historyRecord = { runAt, totals: summary.totals, events: changed, sourceHealth };
  await Promise.all([
    writeFile(join(__dirname, 'results.json'), JSON.stringify(currentJob, null, 2)),
    writeFile(join(__dirname, 'experience-results.json'), JSON.stringify(currentExperience, null, 2)),
    writeFile(join(__dirname, 'new-postings.json'), JSON.stringify(newPostings, null, 2)),
    writeFile(join(__dirname, 'opportunity-events.json'), JSON.stringify(events, null, 2)),
    writeFile(join(__dirname, 'source-health.json'), JSON.stringify(sourceHealth, null, 2)),
    writeFile(join(__dirname, 'notification-summary.json'), JSON.stringify(summary, null, 2)),
    writeFile(statePath, JSON.stringify(state, null, 2)),
    writeFile(seriesPath, JSON.stringify(series, null, 2)),
    appendFile(join(dataDir, 'history', `${runAt.slice(0, 7)}.jsonl`), `${JSON.stringify(historyRecord)}\n`),
  ]);
  console.log(`현재 ${current.length}건 / 신규 ${newPostings.length}건 / 변경 ${changed.length}건 / 소스 경보 ${sourceIssues.length}건`);
  if (!hasBaseline) console.log('이전 결과가 없어 기준선만 생성했습니다. 첫 실행 항목은 신규 알림으로 보내지 않습니다.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main().catch(error => { console.error(error); process.exitCode = 1; });
