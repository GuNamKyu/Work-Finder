# 수집 대상 외 관련 기관 후보 — 서울·경기 (2026-10-26 조사)

현재 수집 대상(43 + 5)은 [sources-2026-10-26.md](sources-2026-10-26.md)를 참고한다.
범위는 서울·경기만 다룬다. 인천은 경기권이지만 이번 조사에서는 제외했다.

**URL 확인 기준**
- **게시판 확인**: 2026-10-26에 해당 URL을 직접 열어 채용(또는 봉사) 목록이나 메뉴 링크를 확인했다.
- **홈페이지만**: 기관 홈페이지 접속(200)과 제목만 확인했다. 채용 게시판은 JS 메뉴 등이라 주소를 미확인했다.
- **미확인**: 홈페이지 주소도 확정하지 못했다.

**제외어 검토**
- 후보 기관명을 실제 `passesExclusions()`(crawlers/base.ts)에 넣어 확인했다. 제목은 "직원 채용 공고", "사무국장 채용 공고", "문화강좌 강사 채용", "기간제 근로자 채용" 네 가지를 썼다.
- **기관명 때문에 모두 버려지는 곳(⚠)**:
  - 문화관광재단 3곳(화성시·포천·여주세종)은 제외어 `관광재단`에 걸린다.
  - 서울시립과학관·국립과천과학관은 제외어 `과학관`에 걸린다.
- **나머지 후보**: 직원·사무국장·기간제 채용은 통과한다. "강사 채용"은 제외어 `강사`로 걸러진다. 문화원 공지에 많은 문화강좌 강사 모집은 자동으로 빠지고, 직원·사무국장 채용만 남는다.
- **박물관·미술관 예외**: 기관명에 박물관·미술관이 있는 곳(국립현대미술관, 국립항공박물관, 경기도미술관)은 박물관 예외 규칙으로 강사 공고까지 통과한다.

**기존 경유**: 현재 `crawlers/results.json`·`experience-results.json`에 해당 기관 공고가 다른 소스를 통해 이미 들어오는지 표시했다. 문화원·구 문화재단 공고는 지금 수집 결과에 거의 없다.

## 크롤링 검증 결과 (2026-10-26)

**검증 방법**
- 실제 수집 경로인 `crawlSite()`(제외어 → 상세 날짜 보강 → 마감 제외)를 그대로 호출했다. 결과 파일에는 저장하지 않았다.
- **정상 기준**: 목록에서 제목·등록일·상세 링크가 있는 행이 1건 이상 나오고, 표본이 실제 화면과 일치한다.
- 원본 행(raw)과 최종 노출(final)은 따로 적었다. final 0은 결과 발표나 마감 공고만 남은 경우라 수집 실패가 아니다.

### A. 정상 → 추가 완료 (20개 소스, 이 중 njp는 이후 종합 사이트 우선으로 제외)

| ID | 기관 | raw | final | 비고 |
|---|---|---|---|---|
| kccf | 한국문화원연합회 (서울·경기 문화원) | 20 | 16 | 지역 선택 SU·GG 각각 수집, 한 지역 실패 시 partial |
| ggcf | 경기문화재단 본부 | 15 | 0 | `ggcf.ts`에 `.list-wrap .list` 분기 추가. 상태 배지(예정/진행/종료)를 status로 읽음 → 현재 1페이지는 모두 종료 |
| njp | 백남준아트센터 | 10 | 3 | 이후 ggcf 우선으로 제외(아래 "종합 사이트 우선 정리") |
| kh | 국가유산진흥원 | 11 | 3 | |
| arte | 한국문화예술교육진흥원 | 15 | 1 | 목록의 마감일을 deadlineDate로 수집 |
| gokams | 예술경영지원센터 (자체 채용) | 10 | 4 | |
| yongsan-cf | 용산문화재단 | 6 | 2 | |
| seocho-cf | 서초문화재단 | 10 | 4 | |
| gfac | 관악문화재단 | 19 | 9 | 아코디언에 과거 전 차수(515건)가 있어 최근 3차수로 제한 |
| naruart | 광진문화재단 | 15 | 4 | |
| ddmac | 동대문문화재단 | 20 | 7 | 상세는 `?type=view&uid=` GET으로 열림 확인 |
| efac | 은평문화재단 | 10 | 0 | 현재 남은 글이 모두 마감·결과 발표 |
| nowonarts | 노원문화재단 | 10 | 5 | |
| idfac | 동작문화재단 | 15 | 1 | |
| snart | 성남문화재단 | 10 | 0 | 결과 발표 위주. 공연장 안내원 모집은 제외어 `공연장` |
| ansanart | 안산문화재단 | 10 | 4 | |
| gunpocf | 군포문화재단 | 10 | 3 | 제목 링크가 `#none`이라 상세 URL 없음. 행 `data-id`를 postingId로 사용 |
| nyjcf | 남양주시문화재단 | 18 | 1 | |
| gcart | 과천문화재단 | 10 | 0 | 접수기간·채용상태가 목록에 있음. 현재 남은 글은 마감·결과 |
| nsart | 광주시문화재단 | 10 | 0 | 현재 남은 글이 결과 발표·제외어(대표이사 등) |

### B·C. 보류·제외 사이트

수집은 되지만 범위 필터가 필요한 곳(B)과 비정상이거나 추가가 불필요한 곳(C), 종합 사이트에 밀린 개별 사이트는 모두 [excluded-sources.json](../excluded-sources.json)에 사유·근거와 함께 옮겼다. 이 문서에는 따로 두지 않는다.

### 종합 사이트 우선 정리 (2026-10-26)

중복 사이트는 공고를 종합한 사이트를 우선한다. 실제 게시판을 대조해 겹침을 측정했고, 개별 사이트 7곳을 등록에서 뺐다.

| 개별 사이트 | 우선 종합 사이트 | 측정 |
|---|---|---|
| gcm·jgpm·silhak | ggcf (경기문화재단 본부) | 각 10건 중 10건이 본부 게시판(417건)에 있음 |
| gjicp | ggcf | 10건 중 9건, 빠진 1건은 용역 공고 |
| njp | ggcf | 10건 중 9건, 빠진 1건은 제외어(강사)로 걸러짐 |
| nrich | khs (국가유산청) | khs 250건 기간의 nrich 48건 모두 있음 |
| korea-kr | gojobs (나라일터) | 20건 중 18건, 빠진 2건은 제외어로 걸러짐 |

- **개별 수집 유지**: musenet(경기도박물관)·ngcm(경기북부어린이박물관)은 본부에 없는 교육강사·자원봉사 공고가 있고, 박물관 이름 예외로 제외어도 통과해 개별 수집을 유지한다.
- **겹침이 미미해 그대로 둔 쌍**: kdp-aks·museum-or-kr·gmuseum과 개별 박물관, gojobs와 국립박물관은 측정 기간 안의 겹침이 1건 이하이거나 흔한 제목의 우연 일치라 종합 사이트로 보기 어렵다.

**기존 소스 회귀 확인**: `ggcf.ts`를 공유하는 기존 6곳(musenet·gcm·ngcm·jgpm·silhak·gjicp)도 다시 돌려 변경 전과 같은 행 수를 확인했다.
silhak은 등록일이 비어 있는데, 변경 전 코드(HEAD)에서도 같아 이번 변경과 무관한 기존 문제다.

**미검증**: 아래 표에서 "홈페이지만"·"미확인"으로 표시된 기관은 채용 게시판 URL을 확보하지 못해 크롤링을 검증하지 않았다.

---

아래는 처음 조사한 후보 목록이다. **추가됨**으로 표시한 곳은 위 A그룹으로 이미 수집 대상에 들어갔다.

## 1순위 — 통합 게시판 (소스 1개로 여러 기관 커버)

| 후보 | 커버 범위 | 목록 URL | 확인 | 구현 메모 |
|---|---|---|---|---|
| **한국문화원연합회 채용공고** (추가됨: kccf) | 전국 문화원·연합회 채용. 지역(서울/경기)·문화원 필터 있음 → 서울 25 + 경기 31 문화원을 소스 하나로 커버 | [kccf.or.kr 채용공고](https://kccf.or.kr/bbs/list.do?bbsId=N000000000000000000017&selMenuId=MK0030) | 게시판 확인 (총 285건. 최근 강서·용인·마포·광명·용산·은평·화성문화원) | 목록이 AJAX(DataTables) 렌더링 → `waitForSelector` 필요. `지방문화원` 열로 서울·경기 필터 |
| **경기문화재단 본부 채용** (추가됨: ggcf) | 재단 본부와 산하 전 기관 채용 (경기상상캠퍼스, 남한산성역사문화관 기간제 포함) | [ggcf.kr 채용](https://www.ggcf.kr/boards/bulletinBoards/articles?category=03) | 게시판 확인 (417건) | `ggcf.ts`와 같은 플랫폼. 경로만 `boards/bulletinBoards` → 셀렉터 확인 후 configs에 추가 |
| **클린아이 잡플러스** (행정안전부) | 지방 공기업·출자출연기관 전체. 자치구·시군 문화재단도 출연기관이라 대부분 올라올 것으로 **추정**한다. 첫 페이지에서는 문화재단 공고를 직접 보지 못했다 | [job.cleaneye.go.kr 채용정보](https://job.cleaneye.go.kr/user/ypRecruitment.do) | 게시판 확인 (총 79,576건, 근무지·모집분야·고용형태 필터) | 노이즈가 매우 많음. 근무지 서울·경기, 문화·예술 계열 분야로 좁힌 뒤 제외어 적용 |
| **문화체육관광부 채용정보** | 문체부 본부와 소속기관 (국립현대미술관·국립중앙도서관·국립국악원 등) | [mcst.go.kr 채용정보](https://www.mcst.go.kr/site/s_notice/notice/jobList.jsp) | 게시판 확인 | 국외 한국문화원 공고 등 비대상이 섞임 → 제외어 필요 |
| **잡알리오** (공공기관 채용정보시스템) | 공공기관 (국립박물관문화재단, 국가유산진흥원, 한국문화예술교육진흥원, 예술경영지원센터 등) | [job.alio.go.kr](https://job.alio.go.kr/recruit.do) | 게시판 확인 | 기관 검색 조건으로 문화 계열만 조회. ncs·gojobs와 일부 중복 가능 |
| 서울특별시문화원연합회 | 서울 25개 문화원 공지·채용 | [seoulccf.or.kr](http://www.seoulccf.or.kr/mpage) | 홈페이지만 (메인에 "[강서문화원] 사무국장 채용", "[은평문화원] 사무국장 공개채용" 노출) | kccf와 대부분 중복 → kccf 우선, 보조 |
| 경기도문화원연합회 | 경기 31개 문화원 | [kccfgg.org](http://kccfgg.org/) | 홈페이지만 (본문 JS 렌더링) | kccf와 중복 가능성 높음 |
| 예술경영지원센터 채용·일자리 정보 | 예술분야 기업·단체 일자리 | [채용정보](https://www.gokams.or.kr/01_news/jobposting_list.aspx) · [일자리 정보](https://www.gokams.or.kr/01_news/job_list_new.aspx) | 메뉴 확인, 일자리 목록은 2026-10-26에 "통신 오류"로 비어 있었음 | 재확인 필요. 민간 공연·예술단체 위주라 관련성 중간 |

## 2순위 — 경기문화재단 계열 (`ggcf.ts` 재사용)

| 기관 | 목록 URL | 확인 | 메모 |
|---|---|---|---|
| 경기도미술관 | [gmoma.ggcf.kr notice category=03](https://gmoma.ggcf.kr/boards/notice/articles?category=03) | 응답 200, 내용 미확인 (HTML에 '채용' 문자열은 있으나 메뉴 텍스트일 수 있음) | musenet과 같은 `notice` 경로 |
| 백남준아트센터 | [njp.ggcf.kr news category=03](https://njp.ggcf.kr/boards/news/articles?category=03) | 응답 200, 내용 미확인 | 기존 5곳과 같은 `news` 경로 |
| 경기창작캠퍼스 | [gcc.ggcf.kr notice category=03](https://gcc.ggcf.kr/boards/notice/articles?category=03) | 응답 200, 내용 미확인 | |
| 남한산성역사문화관 | [nmuseum.ggcf.kr](https://nmuseum.ggcf.kr/) | 홈페이지만 (`boards/*` 500) | 본부 게시판(1순위)으로 커버 |
| 경기상상캠퍼스 / 경기문화예술교육지원센터 | [sscampus.ggcf.kr](https://sscampus.ggcf.kr/) / [ggarte.ggcf.kr](https://ggarte.ggcf.kr/) | 홈페이지만 | 본부 게시판으로 커버 |

> 1순위의 경기문화재단 본부 게시판을 추가하면 2순위 기관의 정규·기간제 채용 대부분이 커버된다. 개별 사이트는 인턴·자원봉사 공지가 본부에 안 올라오는 경우에만 추가할 가치가 있다.

## 3순위 — 개별 기관 (국립·공공, 서울·경기 소재)

| 기관 | 지역 | 채용/관련 URL | 확인 | 기존 경유 |
|---|---|---|---|---|
| 국가유산진흥원 | 서울 | [인재채용](https://www.kh.or.kr/brd/board/721/L/CATEGORY/719/menu/377?brdCodeField=CATEGORY&brdCodeValue=719) | 게시판 확인 | 잡알리오로 커버 가능 |
| 한국문화예술교육진흥원 | 서울 | [채용공고](https://arte.or.kr/notice/job/notice/Job_BoardList.do) | 게시판 확인 | 잡알리오로 커버 가능 |
| 서울시립과학관 | 서울 | [채용정보](https://science.seoul.go.kr/board/normal?menuId=62&bbsId=22) | 게시판 확인 | ⚠ 제외어 `과학관` |
| 국립현대미술관 | 서울·과천 | [mmca.go.kr](https://www.mmca.go.kr/) (채용 메뉴는 JS) | 홈페이지만 | 문체부 채용정보로 커버 가능 |
| 국립국악원 | 서울 | [gugak.go.kr](https://www.gugak.go.kr/site/main/index001) (채용 메뉴는 JS) | 홈페이지만 | 문체부 채용정보 |
| 서울시립미술관(SeMA) | 서울 | [sema.seoul.go.kr](https://sema.seoul.go.kr/) | 홈페이지만 | seoul 소스에 일부 가능 |
| 국립항공박물관 | 서울 | [aviation.or.kr](https://www.aviation.or.kr/) | 홈페이지만 | — |
| 국립과천과학관 | 경기 과천 | [sciencecenter.go.kr](https://www.sciencecenter.go.kr/gnsm/) | 홈페이지만 | ⚠ 제외어 `과학관` |
| 궁능유적본부 | 서울 | [royal.khs.go.kr](https://royal.khs.go.kr/) | 홈페이지만 | khs 게시판에 포함 가능 |
| 한국도자재단 (경기도자미술관 운영) | 경기 이천·여주·광주 | [kocef.org](https://www.kocef.org/) | 홈페이지만 | 클린아이로 커버 가능 |
| 국립중앙박물관문화재단 | 서울 | 미확인 (`cfmk.or.kr` DNS 없음) | 미확인 | museum-or-kr 경유 2건 있음 |
| 수원시립미술관 | 경기 수원 | [suma.suwon.go.kr](https://suma.suwon.go.kr/) | 홈페이지만 | — |
| 수원시 박물관(수원·수원화성·수원광교) | 경기 수원 | `swmuseum.suwon.go.kr` 접속 시간초과 | 미확인 | 1365 봉사 경유만 |
| 양주시립회암사지박물관 | 경기 양주 | [yangju.go.kr/museum](https://www.yangju.go.kr/museum/) | 홈페이지만 | — |
| 송파책박물관 | 서울 송파 | [bookmuseum.go.kr](https://www.bookmuseum.go.kr/) | 홈페이지만 | 1365 봉사 경유만 |
| 판교박물관, 추사박물관, 허준박물관, 용인박물관, 안양박물관, 오이도박물관, 오산시립미술관, 서울우리소리박물관 | 서울·경기 | 추정 주소가 모두 404/DNS 실패 | 미확인 | 대부분 1365 봉사 경유만 |

## 4순위 — 서울 자치구·경기 시군 문화재단

클린아이 잡플러스(1순위)를 넣으면 상당수가 커버된다. 아래는 개별 게시판 정보다.

| 재단 | 지역 | URL | 확인 | 비고 |
|---|---|---|---|---|
| 서울문화재단 | 서울 | [sfac.or.kr](https://www.sfac.or.kr/) | 홈페이지만 | seoul·클린아이 경유 가능 |
| 용산문화재단 | 서울 용산 | [채용공고](https://yongsanculture.or.kr/site/main/archive/post/category/jobNotice) | 게시판 확인 | jfac.ts와 같은 `/site/main/archive/post/category/` 플랫폼 |
| 서초문화재단 | 서울 서초 | [채용공고](https://www.seochocf.or.kr/site/main/archive/post/category/%EA%B3%B5%EC%A7%80%EC%82%AC%ED%95%AD?metaCode1=RECRUIT) | 게시판 확인 | jfac.ts 플랫폼 재사용 가능 |
| 관악문화재단 | 서울 관악 | [채용정보](https://gfac.or.kr/site/main/recruit/accordionList) | 게시판 확인 (2026-10-23 공고 있음) | 같은 `/site/main/` 계열 |
| 광진문화재단 | 서울 광진 | [채용공고](https://www.naruart.or.kr/community/recruit_list.php) | 게시판 확인 | |
| 동대문문화재단 | 서울 동대문 | [인재채용](https://ddmac.or.kr/sub04/sub03.php) | 게시판 확인 | |
| 노원문화재단 | 서울 노원 | [채용공고](https://www.nowonarts.kr/channels/job/posts) | 게시판 확인 | |
| 은평문화재단 | 서울 은평 | [채용정보](https://www.efac.or.kr/page08/sub02.php) | 게시판 확인 | |
| 동작문화재단 | 서울 동작 | [채용공고](http://www.idfac.or.kr/bbs/board.php?bo_table=job) | 게시판 확인 | |
| 금천문화재단 | 서울 금천 | [gcfac.or.kr](https://gcfac.or.kr/mpage) | 메뉴 확인 (JS 링크) | |
| 중구문화재단 · 성동문화재단 · 중랑문화재단 · 성북문화재단 · 강북문화재단 · 도봉문화재단 · 마포문화재단 · 양천문화재단 · 구로문화재단 · 영등포문화재단 · 강동문화재단 | 서울 | [caci](https://www.caci.or.kr/) · [sdfac](https://www.sdfac.or.kr/) · [jnfac](https://www.jnfac.or.kr/) · [sbculture](https://www.sbculture.or.kr/) · [gbcf](https://www.gbcf.or.kr/) · [dbfac](https://www.dbfac.or.kr/) · [mfac](https://www.mfac.or.kr/) · [yfac](https://yfac.kr/) · [guroartsvalley](https://www.guroartsvalley.or.kr/) · [ydpcf](https://www.ydpcf.or.kr/) · [gdfac](https://www.gdfac.or.kr/) | 홈페이지만 | 성북문화재단은 성북선잠박물관 등 운영 |
| 서대문·강서·강남·송파 문화재단 | 서울 | — | 미확인 | |
| 성남문화재단 | 경기 성남 | [채용안내](https://www.snart.or.kr/main/pst/list.do?pst_id=recruit) | 게시판 확인 | |
| 안산문화재단 | 경기 안산 | [채용안내](https://www.ansanart.com/lay1/bbs/S1T84C408/A/62/list.do) | 게시판 확인 | |
| 군포문화재단 | 경기 군포 | [채용공고](https://www.gunpocf.or.kr/cf/ntt/nttList/BBS007) | 게시판 확인 | |
| 남양주시문화재단 | 경기 남양주 | [채용공고](https://www.nyjcf.or.kr/www/25) | 게시판 확인 | |
| 양평문화재단 | 경기 양평 | [채용공고](https://ypcf.or.kr/recruit) | 게시판 확인 | |
| 과천문화재단 | 경기 과천 | [채용공고](https://www.gcart.or.kr/kr/commu/recruitList.do) | 게시판 확인 | |
| 광주시문화재단 | 경기 광주 | [채용공고](https://www.nsart.or.kr/board/recruit.do) | 게시판 확인 | |
| 화성시문화관광재단 | 경기 화성 | [채용](https://www.hcf.or.kr/hcf/60) | 게시판 확인 | ⚠ 제외어 `관광재단` |
| 포천문화관광재단 | 경기 포천 | [채용안내](https://www.pcfac.or.kr/sub07/sub03.php) | 게시판 확인 | ⚠ 제외어 `관광재단` |
| 여주세종문화관광재단 | 경기 여주 | [채용공고](http://www.yjcf.or.kr/brd/board/217/L/menu/342) | 게시판 확인 | ⚠ 제외어 `관광재단` |
| 수원문화재단 · 고양문화재단 · 용인문화재단 · 김포문화재단 · 파주문화재단 · 평택시문화재단 · 구리문화재단 · 의정부문화재단 | 경기 | [swcf](https://www.swcf.or.kr/) · [artgy](https://www.artgy.or.kr/) · [yicf](https://www.yicf.or.kr/) · [gcf](https://www.gcf.or.kr/main/main.do) · [pajucf](https://www.pajucf.or.kr/) · [pccf](https://www.pccf.or.kr/) · [guriart](https://www.guriart.or.kr/) · [uac](https://www.uac.or.kr/) | 홈페이지만 | |
| 부천문화재단 · 안양문화예술재단 · 광명문화재단 | 경기 | [bcf](https://www.bcf.or.kr/) · [ayac](https://ayac.or.kr/) · [gmcf](https://www.gmcf.or.kr/) | 미확인 (인증서 체인 오류로 자동 확인 실패, 브라우저 재확인 필요) | |
| 이천문화재단 · 하남문화재단 | 경기 | artic.or.kr · hnart.or.kr | — | **이미 수집 중** (artic, hnart 소스) |
| 오산·시흥·의왕·양주·가평·연천 문화재단 | 경기 | — | 미확인 (재단 존재 여부 포함) | |

## 부록 A — 서울·경기 지방문화원 (56곳)

목록은 kccf 채용공고 게시판의 지역별 문화원 필터 기준이다(서울 25, 경기 31). 1순위의 kccf 게시판 하나로 모두 커버된다. 아래는 개별 홈페이지로, 2026-10-26 자동 확인 결과다.
**채용 전용 게시판이 따로 확인된 곳**: [중랑문화원](https://www.ejnc.kr/bbs/board.php?bo_table=0504), [노원문화원](https://www.nwcc.or.kr/sub/notification/notice/recruit.php), [은평문화원](https://epculture.or.kr/sub05/sub02.php). 나머지는 공지사항 게시판에 채용을 섞어 올린다. 예를 들어 성동·강남·포천은 강사 채용, 용산·관악은 사무국장·원장 공고를 공지사항에 올린다.

| 서울 | 홈페이지 | 경기 | 홈페이지 |
|---|---|---|---|
| 종로문화원 | [종로문화원.kr](http://www.xn--2o2bi6co4o4ubcz4a.kr/) | 수원문화원 | 미확인 |
| 중구문화원 | [junggucc.or.kr](http://www.junggucc.or.kr/) | 고양문화원 | [goyangcc.or.kr](http://www.goyangcc.or.kr/) |
| 용산문화원 | [ysac.or.kr](https://www.ysac.or.kr/) | 용인문화원 | [ycc50.org](https://www.ycc50.org/) |
| 성동문화원 | [ssdc.or.kr](http://www.ssdc.or.kr/) | 성남문화원 | [seongnamculture.or.kr](https://www.seongnamculture.or.kr/) |
| 광진문화원 | [kjcc.or.kr](https://kjcc.or.kr/) | 부천문화원 | [bucheonculture.or.kr](https://www.bucheonculture.or.kr/) |
| 동대문문화원 | 미확인 | 화성문화원 | [hscc.or.kr](https://hscc.or.kr/) |
| 중랑문화원 | [ejnc.kr](https://www.ejnc.kr/) | 안산문화원 | [ansanculture.or.kr](https://www.ansanculture.or.kr/) |
| 성북문화원 | [isbcc.or.kr](https://www.isbcc.or.kr/) | 남양주문화원 | `nyj.or.kr` (인증서 오류, 미확인) |
| 강북문화원 | [gbculture.or.kr](https://www.gbculture.or.kr/) | 안양문화원 | [anyangculture.or.kr](http://anyangculture.or.kr/) |
| 도봉문화원 | 미확인 | 평택문화원 | [ptmunhwa.or.kr](https://www.ptmunhwa.or.kr/) |
| 노원문화원 | [nwcc.or.kr](https://www.nwcc.or.kr/) | 시흥문화원 | [shcc.or.kr](http://shcc.or.kr/) |
| 은평문화원 | [epculture.or.kr](https://epculture.or.kr/) | 파주문화원 | [pajucc.or.kr](https://pajucc.or.kr/main.html) |
| 서대문문화원 | 미확인 | 의정부문화원 | 미확인 |
| 마포문화원 | [mapocc.or.kr](http://www.mapocc.or.kr/) | 김포문화원 | 미확인 |
| 양천문화원 | [양천문화원.kr](https://xn--z92b72qn1at0nqrn.kr/) | 광주문화원 | [gjmh.or.kr](https://www.gjmh.or.kr/) |
| 강서문화원 | [kcc2000.or.kr](https://www.kcc2000.or.kr/) | 광명문화원 | `gmcc.or.kr` (시간초과, 미확인) |
| 구로문화원 | 미확인 | 군포문화원 | [gpmunhwa.or.kr](https://www.gpmunhwa.or.kr/) |
| 금천문화원 | 미확인 | 하남문화원 | [하남문화원.kr](https://www.xn--q20b93roljctocfb.kr/) |
| 영등포문화원 | 미확인 | 오산문화원 | [oscc.or.kr](https://oscc.or.kr/) |
| 동작문화원 | 미확인 | 양주문화원 | [yangju.org](https://www.yangju.org/) |
| 관악문화원 | [gacc.or.kr](http://www.gacc.or.kr/) | 이천문화원 | [cc2000.or.kr](https://www.cc2000.or.kr/) |
| 서초문화원 | [socc.or.kr](http://socc.or.kr/) | 구리문화원 | `gurimh.or.kr` (403, 미확인) |
| 강남문화원 | [sgnc.or.kr](https://www.sgnc.or.kr/) | 안성문화원 | [ascc.or.kr](https://ascc.or.kr/) |
| 송파문화원 | [spcc.or.kr](https://www.spcc.or.kr/) | 포천문화원 | [pcmh.or.kr](http://www.pcmh.or.kr/) |
| 강동문화원 | [gdcc.or.kr](https://www.gdcc.or.kr/) | 의왕문화원 | [uwcc.or.kr](https://uwcc.or.kr/) |
| | | 양평문화원 | [ypculture.org](https://ypculture.org/) |
| | | 여주문화원 | 미확인 |
| | | 동두천문화원 | [munhwawon.com](http://www.munhwawon.com/) |
| | | 가평문화원 | [gpc.or.kr](https://www.gpc.or.kr/) |
| | | 과천문화원 | [gccc.or.kr](http://www.gccc.or.kr/) |
| | | 연천문화원 | [연천문화원.kr](https://xn--z92b19qita13pqrn.kr/) |

## 부록 B — 직무경험(자원봉사·인턴) 후보

| 후보 | 유형 | URL | 확인 | 메모 |
|---|---|---|---|---|
| 국립현대미술관 자원봉사 | 자원봉사 | [mmca.go.kr/pr/volunteer.do](https://www.mmca.go.kr/pr/volunteer.do) | 메뉴 링크 확인 | 서울·과천·덕수궁관 |
| 서울시립과학관 자원봉사 | 자원봉사 | [science.seoul.go.kr 자원봉사](https://science.seoul.go.kr/tmpl/category/volunteer/teen?menuId=23) | 메뉴 링크 확인 | 청소년 대상일 수 있음, 대상 조건 확인 필요 |
| 서울 암사동 유적 자원봉사 | 자원봉사 | [sunsa.gangdong.go.kr 자원봉사](https://sunsa.gangdong.go.kr/site/main/content/volunteer_work) | 메뉴 링크 확인 | 1365 경유 16건 이미 있음 → 중복 가능 |
| 경기도자원봉사센터 / 경기청년봉사단 플랫폼 | 자원봉사 | [ggvc.or.kr](https://www.ggvc.or.kr/) · [youth.ggvc.or.kr](https://youth.ggvc.or.kr/) | 홈페이지 확인 | 모집은 1365와 연동 → 중복 가능성 높음 |
| 서울시자원봉사센터 | 자원봉사 | [volunteer.seoul.go.kr](https://volunteer.seoul.go.kr/) | 홈페이지만 | 1365 연동 여부 확인 필요 |
| 서울청년포털 (청년인턴 직무캠프 등) | 청년 일경험 | [youth.seoul.go.kr](https://youth.seoul.go.kr/) | 홈페이지만 | 서울 공공·민간 인턴 모집 |
| 국립중앙도서관 봉사·활동 | 자원봉사 | [nl.go.kr](https://www.nl.go.kr/) | 링크만 확인 | 관련성 낮음 |

## 남은 작업 (2026-10-26 추가 이후)

kccf, 경기문화재단 본부, 백남준아트센터와 게시판이 확인된 문화재단·공공기관 20곳은 추가를 마쳤다(위 A그룹).

1. **클린아이 잡플러스·잡알리오·문체부 채용정보(`excluded-sources.json`의 held)의 필터를 설계한다.** 근무지 서울·경기, 문화 분야 기관만 남기는 조건을 정하고, 기존 ncs·gojobs와의 중복을 측정한 뒤 추가 여부를 정한다.
2. **`관광재단`·`과학관` 제외어 정책을 정한다.** 문화관광재단 3곳과 과학관 2곳을 수집하려면 기관명 예외가 필요하다.
3. **"홈페이지만"·"미확인" 기관의 채용 게시판 URL을 확보한다.** 서울문화재단, 수원·고양·용인 문화재단 등이 대상이다.
4. **경기도미술관(gmoma) 날짜 추출을 고친다.** 실학박물관(silhak)의 등록일 누락도 함께 본다.

새 사이트를 추가할 때는 `add-crawler` 스킬 절차(url.txt → `crawlers/sites/` → `run.ts` 등록 → 검증)를 따른다.
