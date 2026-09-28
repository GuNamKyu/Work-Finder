import type { JobPosting, ScheduleEvent } from './types.js';

function dateKey(year: number, month: number, day: number): string | null {
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return d.toISOString().slice(0, 10);
}

/** A year is required at least once; never infer one from the current clock. */
export function parsePeriod(text: string): [string | null, string | null] {
  const parts = text.replace(/\u200b/g, '').split(/\s*[~～∼–]\s*/);
  const first = parts[0]?.match(/\b(20\d{2}|\d{2})[.\/년-]\s*(\d{1,2})[.\/월-]\s*(\d{1,2})/);
  if (!first) return [null, null];
  const y = Number(first[1]) + (first[1].length === 2 ? 2000 : 0);
  const start = dateKey(y, Number(first[2]), Number(first[3]));
  if (!parts[1]) return [start, null];
  const full = parts[1].match(/\b(20\d{2}|\d{2})[.\/년-]\s*(\d{1,2})[.\/월-]\s*(\d{1,2})/);
  const short = parts[1].match(/\b(\d{1,2})[.\/월-]\s*(\d{1,2})/);
  let end = full ? dateKey(Number(full[1]) + (full[1].length === 2 ? 2000 : 0), +full[2], +full[3]) : short ? dateKey(y, +short[1], +short[2]) : null;
  // Abbreviated cross-year ranges are ambiguous; require an explicit end year.
  if (start && end && end < start) end = null;
  return [start, end];
}

export function periodFields(application: string, program = '', source: ScheduleEvent['source'] = 'list'): Partial<JobPosting> {
  const [applicationStartAt, applicationEndAt] = parsePeriod(application);
  const [programStartAt, programEndAt] = parsePeriod(program);
  const scheduleEvents: ScheduleEvent[] = [];
  for (const [type, date, evidence] of [
    ['application_start', applicationStartAt, application], ['application_end', applicationEndAt, application],
    ['program_start', programStartAt, program], ['program_end', programEndAt, program],
  ] as const) if (date) scheduleEvents.push({ type, date, evidence, source, precision: 'exact', confidence: 0.95 });
  return { applicationStartAt, applicationEndAt, deadlineDate: applicationEndAt, programStartAt, programEndAt, scheduleEvents };
}

/** Only labelled sections qualify; business period / publication date is not an application period. */
export function extractSchedule(text: string): Partial<JobPosting> {
  const find = (label: RegExp) => text.match(label)?.[1]?.trim() || '';
  const application = find(/(?:모집\s*기간|접수\s*기간|신청\s*기간)\s*[:：]?\s*([^\n]{0,180})/);
  const program = find(/(?:봉사\s*기간|활동\s*기간|일경험\s*기간|참여\s*기간)\s*[:：]?\s*([^\n]{0,180})/);
  return periodFields(application, program, 'detail');
}
