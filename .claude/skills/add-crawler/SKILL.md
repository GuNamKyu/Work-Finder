---
name: add-crawler
description: "url.txt에 새 URL이 추가되었을 때 해당 사이트의 Playwright 크롤러를 자동 생성하고 검증하는 스킬. 사용자가 새 사이트 추가, 크롤러 만들어줘, url.txt에 URL 추가했어, 새 사이트 크롤링 등을 언급하면 이 스킬을 사용한다. url.txt 파일이 변경되었거나 새 채용공고 사이트를 크롤링해야 할 때도 트리거한다."
---

# 새 크롤러 추가 스킬

url.txt에 등록된 URL 중 아직 크롤러가 없는 사이트를 감지하고, Playwright로 사이트 구조를 분석한 뒤 맞춤 크롤러를 생성/등록/검증하는 워크플로우.

## 전체 흐름

1. **새 URL 감지** — url.txt와 기존 크롤러 비교
2. **사이트 구조 분석** — playwright-cli로 방문하여 HTML 구조 파악
3. **크롤러 생성** — crawlers/sites/에 사이트별 .ts 파일 작성
4. **run.ts 등록** — import 추가 및 sites 배열에 등록
5. **테스트 크롤링** — `bun run crawl -- <site-id>` 로 실행
6. **결과 검증** — 실제 사이트와 비교하여 정확성 확인

---

## Step 1: 새 URL 감지

url.txt의 각 URL에서 도메인을 추출하고, crawlers/sites/ 내 기존 크롤러의 config.url과 비교한다.

```bash
# url.txt 읽기
cat url.txt
# 기존 크롤러의 URL 목록 확인
grep -r "url:" crawlers/sites/*.ts
```

매칭되지 않는 URL이 새로 추가해야 할 크롤러 대상이다.

## Step 2: 사이트 구조 분석

각 새 URL에 대해 playwright-cli로 방문하여 게시판 구조를 파악한다.

```bash
playwright-cli open "<URL>"
playwright-cli snapshot
playwright-cli eval "document.querySelector('table tbody, .board-list, ul.list-body')?.outerHTML?.substring(0, 3000) || document.body.innerHTML.substring(0, 3000)"
playwright-cli close
```

파악해야 할 핵심 정보:
- **행(row) 셀렉터**: `table tbody tr`, `ul li`, `div.tr` 등
- **제목 셀렉터**: 행 내에서 제목 텍스트가 있는 요소와 링크
- **날짜 셀렉터**: 등록일, 마감일이 있는 요소
- **URL 구성**: 상세 페이지 링크 패턴 (상대경로, JS 호출 등)
- **특이사항**: SPA 렌더링, 봇 감지, AJAX 로딩 여부

구조 파악이 어려우면 추가 eval을 실행한다:
```bash
# 행 수 확인
playwright-cli eval "document.querySelectorAll('table tbody tr').length"
# 첫 번째 행의 HTML 구조
playwright-cli eval "document.querySelector('table tbody tr')?.innerHTML?.substring(0, 500)"
# 채용 키워드 포함 요소 탐색
playwright-cli eval "Array.from(document.querySelectorAll('*')).filter(e => e.textContent?.includes('채용') && e.children.length < 5).slice(0,3).map(e => e.tagName + '.' + e.className + ': ' + e.textContent?.substring(0,100))"
```

## Step 3: 크롤러 파일 생성

crawlers/sites/ 에 새 파일을 생성한다. 파일명은 도메인에서 추출한 kebab-case ID를 사용한다.

### 필수 인터페이스

모든 크롤러는 이 구조를 따라야 한다:

```typescript
import type { Page } from 'playwright';
import type { JobPosting, SiteConfig } from '../types';
import { normalizeDate, truncate } from '../base';

export const config: SiteConfig = {
  id: '<kebab-case-id>',      // run.ts에서 참조할 고유 ID
  name: '<기관명 한글>',        // 출력에 표시될 이름
  url: '<크롤링 대상 URL>',
};

export async function scrape(page: Page): Promise<JobPosting[]> {
  // 사이트별 추출 로직
}
```

### 추출 패턴 가이드

**일반 테이블 구조** (가장 흔함):
```typescript
return page.$$eval('table tbody tr', (rows) => {
  return rows.map(row => {
    const tds = row.querySelectorAll('td');
    if (tds.length < 3) return null;
    const titleEl = tds[1]?.querySelector('a');
    const title = titleEl?.textContent?.trim() || '';
    const href = titleEl?.getAttribute('href') || '';
    const date = tds[N]?.textContent?.trim() || '';  // N은 날짜 열 인덱스
    return { title, date, href };
  }).filter(Boolean);
}).then(items =>
  (items as any[]).map(item => ({
    title: truncate(item.title),
    organization: '<기관명>',
    regDate: normalizeDate(item.date),
    deadlineDate: null,
    url: item.href ? `https://<domain>${item.href}` : null,
  }))
);
```

**div 기반 리스트 구조**:
- 셀렉터를 `.list-type1`, `.board-list-area > li`, `div.tr` 등으로 변경
- 내부 요소 접근도 구조에 맞게 조정

**SPA/JS 렌더링 사이트**:
- `await page.waitForSelector('<목록-셀렉터>', { timeout: 10000 })` 추가
- `await page.waitForTimeout(3000~5000)` 으로 렌더링 대기

**봇 감지가 있는 사이트**:
- JS 차단 우회 패턴 사용 (nyj.ts 참조)
- `page.route('**/*', ...)` 로 스크립트 리소스만 차단

**숨겨진 라벨이 있는 사이트** (seosomun 등):
- `.blind` 클래스 요소를 cloneNode 후 제거하여 순수 텍스트 추출

### 주의사항
- `page.$$eval()` 내부는 브라우저 컨텍스트이므로 외부 변수 참조 불가
- `normalizeDate()`는 YYYY-MM-DD, YYYY.MM.DD, YY-MM-DD 등을 처리
- `truncate()`는 기본 80자까지 자르고 `...` 추가
- URL 조합 시 상대경로/절대경로 주의
- `.js` 확장자를 import에 붙이지 않음 (Bun 런타임)

## Step 4: run.ts에 등록

crawlers/run.ts 파일에 3곳을 수정한다:

1. **import 추가** (기존 import 블록 끝에):
```typescript
import * as newSite from './sites/<file-name>';
```

2. **sites 배열에 등록** (`];` 바로 위에):
```typescript
[newSite.config, newSite.scrape],
```

3. import 변수명은 파일명의 camelCase 변환을 사용한다.

## Step 5: 테스트 크롤링

```bash
bun run crawl -- <site-id>
```

확인 사항:
- 에러 없이 실행되는지
- 공고가 1건 이상 추출되는지
- 제목이 올바르게 파싱되는지 (깨진 문자, 불필요한 접두사 없는지)
- 날짜가 YYYY-MM-DD 형식인지

0건이 나오면:
1. 셀렉터가 실제 DOM과 일치하는지 playwright-cli로 재확인
2. 페이지가 JS 렌더링 의존인지 확인 (networkidle 대기 필요 여부)
3. 봇 감지 여부 확인

## Step 6: 결과 검증

테스트 크롤링 성공 후, 실제 사이트를 playwright-cli로 방문하여 크롤링 결과의 첫 3건 제목이 페이지에 실제로 존재하는지 확인한다.

```bash
playwright-cli open "<URL>"
playwright-cli snapshot
# 스냅샷에서 크롤링된 제목이 보이는지 확인
playwright-cli close
```

제목이 매칭되지 않으면 셀렉터를 수정하고 Step 5부터 반복한다.

## 사이트 ID 명명 규칙

도메인에서 추출하되 짧고 명확하게:
- `www.museum.go.kr` → `museum-go-kr`
- `gmuseum.kr` → `gmuseum`
- `www.warmemo.or.kr` → `warmemo`
- 서브도메인이 고유하면 서브도메인 사용: `musenet.ggcf.kr` → `musenet`
