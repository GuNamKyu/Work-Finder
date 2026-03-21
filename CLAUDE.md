# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

한국 박물관/문화기관 38개 사이트의 채용공고를 Playwright로 크롤링하는 프로젝트. Node.js + tsx 런타임 사용.

## Commands

```bash
npm install                      # 의존성 설치
npm run crawl                    # 전체 38개 사이트 크롤링 (~3분)
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
  run.ts         - 메인 실행기. 33개 사이트 모듈을 임포트하고 순차 크롤링 후 results.json 저장
  verify.ts      - results.json을 읽어 실제 사이트와 제목 매칭률로 검증
  sites/         - 사이트별 크롤러 (33개 파일, 38개 사이트)
url.txt          - 크롤링 대상 URL 목록
```

### 사이트 크롤러 규칙

각 사이트 파일(`crawlers/sites/*.ts`)은 동일한 인터페이스를 따름:

```ts
export const config: SiteConfig = { id, name, url };
export async function scrape(page: Page, config?: SiteConfig): Promise<JobPosting[]>;
```

- `ggcf.ts`는 경기문화재단 계열 6개 사이트를 하나로 통합 (`configs` 배열 export)
- 새 사이트 추가 시: sites/ 파일 생성 → run.ts에 import 및 sites 배열 등록
- `page.$$eval()`로 DOM에서 직접 추출하는 패턴 사용 (서버 렌더링 페이지)
- SPA/JS 렌더링 페이지는 `waitForSelector()` 또는 추가 대기 필요
- 봇 감지가 있는 사이트(nyj)는 스크립트 차단으로 우회

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
