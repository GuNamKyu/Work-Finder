export interface LearnedRule { keyword: string; postingType: 'job' | 'experience'; experienceType: string | null; count: number; examples: string[]; enabled?: boolean; }
export interface RuleFile { version: number; generatedAt: string; rules: LearnedRule[]; }
export function matchesRule(posting: { title: string; postingType?: string; experienceType?: string }, rules: LearnedRule[]): boolean;
export function validateRules(value: unknown): RuleFile;
