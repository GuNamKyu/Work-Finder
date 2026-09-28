# GitHub 자동 수집 비활성화 — 2026-09-28

사용자 요청으로 `GuNamKyu/Work-Finder`의 **채용공고 크롤링 & 배포**
워크플로우(ID `248953310`, `.github/workflows/crawl.yml`)를 GitHub에서 비활성화했다.
REST API로 `active → disabled_manually` 전환을 확인했다.
확인 시각은 2026-09-28 23:11:30 KST이며 진행 중·대기 중 실행은 없었다.

YAML의 오전 6시/오후 6시 cron 정의는 복구를 위해 남겼지만 워크플로우가 비활성화되어 실행되지 않는다.
기존 크롤러의 수동 실행도 비활성화된다. 따라서 기존 자동 수집·배포 및 예약 Discord 발송은 중단된다.
홈페이지와 공고 데이터·누적 이력·즐겨찾기·숨김 기록·Discord 웹훅 비밀값은 변경하거나 삭제하지 않았다.
저장소의 GitHub Actions 전체는 끄지 않았다.

`$workfinder`의 Chrome 확인 결과는 별도 `publish-browser.yml` 수동 게시 경로를 사용한다.
이 확인 시점에는 이 전용 워크플로우가 아직 등록되지 않았으며, skill의 최초 실제 게시 실행에서
검증된 스냅샷과 함께 설치한다. 이 과정에서 기존 자동 크롤러를 재활성화하지 않는다.

`docs/deployment-2026-09-28.md`와 `docs/discord-notifications.md`의 정기 실행 설명은 비활성화 이전의
설정/검증 기록이다. 현재 실행 상태는 이 기록과 GitHub의 실제 워크플로우 상태를 함께 확인한다.
자동 수집 재개는 사용자의 별도 요청이 있을 때만 수행한다.

검증 데이터: `data/workflow-control-2026-09-28.json`.
