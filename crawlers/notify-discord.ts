import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { JobPosting } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
const mode = process.env.DISCORD_NOTIFY_MODE === 'urgent' ? 'urgent' : 'daily';

interface Summary {
  generatedAt: string;
  baselineCreated: boolean;
  totals: Record<string, number>;
  urgent: Array<JobPosting & { siteName: string; priority: string }>;
  changes: Array<JobPosting & { siteName: string; priority: string; type: string }>;
  sourceIssues: Array<{ siteName: string; status: string; message: string }>;
}

function postingLine(posting: JobPosting & { siteName?: string; priority?: string; type?: string }): string {
  const deadline = posting.applicationEndAt || posting.deadlineDate || '미상';
  const prefix = posting.priority ? `**${posting.priority}** ` : '';
  const change = posting.type ? `[${posting.type}] ` : '';
  const title = posting.url ? `[${posting.title}](${posting.url})` : posting.title;
  const eligibility = posting.eligibilityStatus === 'likely_eligible' ? '지원가능 신호'
    : posting.eligibilityStatus === 'needs_review' ? '지원요건 확인'
      : posting.eligibilityStatus === 'unknown' ? '자격 미확인' : '';
  return `${prefix}${change}${title}\n↳ ${posting.siteName || posting.organization} · 적합 ${posting.fitScore ?? '-'}${eligibility ? ` · ${eligibility}` : ''} · 마감 ${deadline}`;
}

function limitedDescription(lines: string[], empty: string): string {
  if (!lines.length) return empty;
  let result = '';
  for (const line of lines) {
    if ((result + line).length > 3900) return `${result}\n…나머지는 대시보드에서 확인`;
    result += `${result ? '\n\n' : ''}${line}`;
  }
  return result;
}

async function send(payload: unknown): Promise<void> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(`${webhookUrl}?wait=true`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`Discord HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, attempt * 1500));
    }
  }
  throw lastError;
}

async function main(): Promise<void> {
  if (!webhookUrl) {
    console.log('DISCORD_WEBHOOK_URL이 없어 Discord 알림을 건너뜁니다.');
    return;
  }
  const summary = JSON.parse(await readFile(join(__dirname, 'notification-summary.json'), 'utf-8')) as Summary;
  if (summary.baselineCreated) {
    console.log('최초 기준선 생성 실행이므로 Discord 신규 알림을 건너뜁니다.');
    return;
  }
  if (mode === 'urgent' && summary.urgent.length === 0 && summary.sourceIssues.length === 0) {
    console.log('긴급 공고와 소스 경보가 없어 Discord 알림을 보내지 않습니다.');
    return;
  }

  const urgentLines = summary.urgent.slice(0, 10).map(postingLine);
  // 일일 상세는 목표/인접 공고 중 P1~P3만 노출한다. P4와 저적합 원자료는 이력에만 보존된다.
  const changeLines = summary.changes
    .filter(item => item.type !== 'closed' && item.userVisible !== false && item.priority !== 'P4')
    .sort((a, b) => (b.fitScore || 0) - (a.fitScore || 0) || (b.urgencyScore || 0) - (a.urgencyScore || 0))
    .slice(0, 12)
    .map(postingLine);
  const healthLines = summary.sourceIssues.slice(0, 15).map(issue => `**${issue.status}** ${issue.siteName}\n↳ ${issue.message}`);
  const embeds: Array<Record<string, unknown>> = [];
  if (urgentLines.length) embeds.push({ title: '🚨 긴급 확인', color: 0xc0392b, description: limitedDescription(urgentLines, '긴급 항목 없음') });
  if (mode === 'daily') embeds.push({
    title: '🗓️ Work-Finder 일일 요약', color: 0x2b6cb0,
    description: `현재 **${summary.totals.current}건** · 신규 **${summary.totals.new}건** · 변경 **${summary.totals.updated}건** · 재공고/재개 **${summary.totals.reposted + summary.totals.reopened + summary.totals.resurfaced}건** · 종료 **${summary.totals.closed}건**\n\n${limitedDescription(changeLines, '오늘 확인된 변경 없음')}`,
  });
  if (healthLines.length) embeds.push({ title: '⚠️ 수집 소스 상태 경보', color: 0xe67e22, description: limitedDescription(healthLines, '경보 없음') });
  embeds[embeds.length - 1] = { ...embeds[embeds.length - 1], footer: { text: `생성 ${summary.generatedAt} · 알림은 멘션을 사용하지 않습니다.` } };
  await send({ username: 'Work-Finder', allowed_mentions: { parse: [] }, embeds });
  console.log(`Discord ${mode === 'daily' ? '일일 요약' : '긴급 알림'} 전송 완료`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
