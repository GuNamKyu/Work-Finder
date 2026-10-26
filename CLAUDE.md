# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

한국 박물관/문화기관·문화재단·문화원 55개 사이트의 채용공고와 5개 소스의 직무경험(청년 일경험·자원봉사) 공고를 Playwright로 크롤링하는 프로젝트. Node.js + tsx 런타임 사용. 전체 수집 대상 목록은 `docs/sources-2026-10-26.md` 참고. 수집하지 않기로 한 사이트(제외·보류)와 사유는 `excluded-sources.json`.

## Commands

```bash
npm install                      # 의존성 설치
npm run crawl                    # 전체 55개 사이트 크롤링
npm run crawl -- <site-id>       # 특정 사이트만 크롤링 (예: gogung)
npm run crawl:verify             # 크롤링 결과를 실제 사이트와 비교 검증
npm run crawl:verify -- <site-id> # 특정 사이트만 검증
npx playwright install chromium  # Playwright 브라우저 최초 설치
```

## Architecture

```
crawlers/
  types.ts       - 공통 인터페이스 (JobPosting, SiteConfig, CrawlResult, SiteScraper)
  base.ts        - Playwright 브라우저 관리, crawlSite() 실행기, 날짜 정규화 유틸
  run.ts         - 메인 실행기. 53개 사이트 모듈을 임포트하고 순차 크롤링 후 results.json 저장
  run-experience.ts - 직무경험 실행기. 5개 소스를 크롤링해 experience-results.json 저장
  experience-urls.ts - 직무경험 소스 URL 목록 (url.txt와 별도 관리)
  verify.ts      - results.json을 읽어 실제 사이트와 제목 매칭률로 검증
  sites/         - 사이트별 크롤러 (55개 파일 중 53개 등록, 55개 사이트. nrich·korea-kr은 보류 중인 미등록 파일)
  sites/experience/ - 직무경험 크롤러 (5개 파일)
url.txt          - 채용공고 크롤링 대상 URL 목록 (주석 불가, URL만)
excluded-sources.json - 제외(excluded)·보류(held) 사이트와 사유·coveredBy·근거 (crawlers/sources.test.ts가 등록 여부 검사)
```

### 사이트 크롤러 규칙

각 사이트 파일(`crawlers/sites/*.ts`)은 동일한 인터페이스를 따름:

```ts
export const config: SiteConfig = { id, name, url };
export async function scrape(page: Page, config?: SiteConfig): Promise<JobPosting[]>;
```

- `ggcf.ts`는 경기문화재단 계열 3개 사이트(재단 본부 + 본부에 없는 공고가 있는 경기도박물관·경기북부어린이박물관)를 하나로 통합 (`configs` 배열 export)
- 중복 사이트는 공고를 종합한 사이트를 우선한다(예: 산하 박물관 → 경기문화재단 본부, 국립문화유산연구원 → 국가유산청, 정책브리핑 → 나라일터). 밀린 사이트는 등록·url.txt에서 빼고 `excluded-sources.json`에 사유와 함께 기록
- `kccf.ts`는 한국문화원연합회 통합 채용 게시판에서 서울(SU)·경기(GG) 지역만 선택해 수집 (한 지역 실패 시 PartialCrawlError)
- config는 문자열 리터럴만 사용 — workfinder 스킬의 `inventory.mjs`가 코드를 실행하지 않고 AST로 읽음
- 새 사이트 추가 시: sites/ 파일 생성 → run.ts에 import 및 sites 배열 등록
- `page.$$eval()`로 DOM에서 직접 추출하는 패턴 사용 (서버 렌더링 페이지)
- SPA/JS 렌더링 페이지는 `waitForSelector()` 또는 추가 대기 필요
- 봇 감지가 있는 사이트(nyj)는 개발자도구 감지 페이지로 리다이렉트되어 현재 수집 실패 상태(보안 우회는 하지 않음)

### 런타임

- Node.js + tsx (TypeScript 실행)
- `fs/promises`의 `readFile` / `writeFile` 사용
- `dirname(fileURLToPath(import.meta.url))`로 `__dirname` 대체

## Deployment

- GitHub Actions (`.github/workflows/crawl.yml`)가 매일 06:00 KST에 크롤링 실행
- 크롤링 결과(`results.json`)를 `web/`에 복사 후 GitHub Pages로 자동 배포
- `web/index.html`은 `results.json`을 fetch하여 렌더링하는 정적 SPA
- 수동 실행: Actions 탭 → `workflow_dispatch`

## Skills

- `add-crawler` (`.claude/skills/add-crawler/`) — url.txt에 새 URL 추가 시 크롤러 자동 생성/등록/검증 워크플로우. "새 사이트 추가해줘" 등으로 트리거.
