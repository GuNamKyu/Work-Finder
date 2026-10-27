// 사람인 (2차 출처 채용 포털) — playMCP 사람인 도구로만 수집한다
// 수집 조건: 저장된 검색 '직업 박물관'과 동일 (직업 키워드 큐레이터 1307·문화재 1346·박물관 1351, 서울 101000·경기 102000)
// workfinder 스킬 실행 중 Claude가 MCP 결과를 관찰 기록(schema v2)으로 옮긴다. Playwright 경로(npm run crawl)에서는
// run.ts의 MCP_ONLY_SOURCES가 페이지를 열지 않고 실패로 남겨 이전 MCP 수집분을 보존한다(scrape는 안전장치).
// 원 출처 게시판과 겹치는 공고는 secondary-sources.ts가 결과 병합 시 자동으로 제외한다.
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';

export const config: SiteConfig = {
  id: 'saramin',
  name: '사람인',
  url: 'https://www.saramin.co.kr/zf_user/jobs/list/job-category?cat_kewd=1307%2C1346%2C1351&loc_mcd=101000%2C102000',
};

export async function scrape(_page: Page): Promise<JobPosting[]> {
  throw new Error('사람인은 playMCP 사람인 도구로만 수집하는 소스입니다 (workfinder 실행에서 수집). Playwright 수집 안 함 — 이전 수집분 보존');
}
