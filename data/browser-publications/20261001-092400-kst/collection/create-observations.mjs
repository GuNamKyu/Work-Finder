import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const runDir = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1').replaceAll('/', '\\');
const repo = 'C:\\Users\\namkyu-gu\\workspace\\Work-Finder';
const runId = '20261001-092400-kst';
const inventory = JSON.parse(await readFile(join(runDir, 'inventory.json'), 'utf8'));
const captures = [
  ['museum-go-kr','2026-10-01T01:05:31.761Z','2026-10-01T01:05:37.141Z','국립중앙박물관>소식·참여>소식>채용 안내>목록',0],
  ['gogung','2026-10-01T01:05:37.146Z','2026-10-01T01:05:43.442Z','채용공고 | 새소식 | 소식·행사 | gogung',11],
  ['nrich','2026-10-01T01:05:43.446Z','2026-10-01T01:05:47.963Z','채용정보 - 국립문화유산연구원',0],
  ['nfm','2026-10-01T01:05:47.968Z','2026-10-01T01:05:54.170Z','국립민속박물관 > 소식 > 알림·공고 > 채용안내(목록보기)',0],
  ['ncs','2026-10-01T01:05:54.175Z','2026-10-01T01:06:02.124Z','공정채용 > 구직자 취업준비 > 직무설계 < 채용공고 | NCS 국가직무능력표준, NCS 공정채용',11],
  ['much','2026-10-01T01:06:10.339Z','2026-10-01T01:06:15.517Z','대한민국역사박물관>소개·소식>알림>채용정보',11],
  ['gmuseum','2026-10-01T01:06:15.521Z','2026-10-01T01:06:19.897Z','경기도박물관협회',11],
  ['hangeul','2026-10-01T01:06:19.901Z','2026-10-01T01:06:24.279Z','채용공고 | 새소식 | 소식 | 국립한글박물관',0],
  ['gojobs','2026-10-01T01:06:24.283Z','2026-10-01T01:06:30.917Z','모집공고 < 일반채용 | 나라일터',5],
  ['kaah','2026-10-01T00:41:48.590Z','2026-10-01T00:41:53.360Z','한국문화유산협회',16],
  ['khs','2026-10-01T00:42:55.650Z','2026-10-01T00:44:27.000Z','시험/채용 목록- 국가유산청',11],
  ['museum-seoul','2026-10-01T01:06:30.921Z','2026-10-01T01:06:36.840Z','소식·참여 > 알림 > 공고/구인 | 서울역사박물관',11],
  ['baekje','2026-10-01T01:06:44.179Z','2026-10-01T01:06:49.856Z','열린마당 > 알림 > 공고/구인 목록페이지 | 한성백제박물관',12],
  ['craftmuseum','2026-10-01T01:06:49.860Z','2026-10-01T01:06:54.867Z','공고/채용 < 소식 < 소개 < SeMoCA',0],
  ['yongsan','2026-10-01T01:06:54.873Z','2026-10-01T01:06:59.198Z','용산역사박물관 > 공지사항',0],
  ['ep-museum','2026-10-01T01:06:59.202Z','2026-10-01T01:07:05.007Z','공지사항 | 은평역사한옥박물관',2],
  ['namu-sdm','2026-10-01T01:07:05.011Z','2026-10-01T01:07:11.479Z','목록 | 채용공고 | 새소식 | 소식·행사 | 서대문자연사박물관',12],
  ['warmemo','2026-10-01T01:07:18.751Z','2026-10-01T01:07:23.362Z','전쟁기념사업회 전쟁기념관 > 소개·소식> 알림> 채용공고',10],
  ['nmkpg','2026-10-01T01:07:23.367Z','2026-10-01T01:07:31.662Z','공지사항 < 공지사항/보도자료 < 알림마당 | 국립대한민국임시정부기념관',0],
  ['kimkoo','2026-10-01T01:07:31.667Z','2026-10-01T01:07:36.259Z','백범김구기념관 - KimKoo Museum & Library',21],
  ['seosomun','2026-10-01T01:07:36.263Z','2026-10-01T01:07:42.048Z','서소문성지 역사박물관 |',0],
  ['jfac','2026-10-01T01:07:42.052Z','2026-10-01T01:07:48.297Z','채용정보 | 종로문화재단',13],
  ['cha','2026-10-01T00:40:19.617Z','2026-10-01T00:40:26.052Z','시험/채용 목록- 국가유산청',11],
  ['musenet','2026-10-01T00:40:26.056Z','2026-10-01T00:40:30.873Z','공고',0],
  ['gcm','2026-10-01T00:40:30.877Z','2026-10-01T00:40:35.777Z','소식참여',0],
  ['ngcm','2026-10-01T00:40:57.529Z','2026-10-01T00:41:03.273Z','소식참여',0],
  ['jgpm','2026-10-01T00:41:03.278Z','2026-10-01T00:41:08.307Z','소식참여',0],
  ['silhak','2026-10-01T00:41:08.310Z','2026-10-01T00:41:12.986Z','공지사항',0],
  ['gjicp','2026-10-01T00:45:20.074Z','2026-10-01T00:45:27.334Z','공지사항',0],
  ['bcmuseum','2026-10-01T00:45:27.340Z','2026-10-01T00:45:37.217Z','새소식 | 부천시박물관',0],
  ['nyj','2026-10-01T00:45:37.221Z','2026-10-01T00:45:42.089Z','개발자도구감지',0],
  ['hnart','2026-10-01T00:46:03.229Z','2026-10-01T00:46:07.665Z','공지사항 목록',11],
  ['hsmuseum','2026-10-01T00:46:07.669Z','2026-10-01T00:46:13.567Z','화성시역사박물관',26],
  ['anseong','2026-10-01T00:46:13.572Z','2026-10-01T00:46:27.541Z','공지사항 목록 | 안성시 문화관광',11],
  ['artic','2026-10-01T00:50:31.779Z','2026-10-01T00:50:37.573Z','목록 : 공지사항 | 알림 | 이천시립박물관',2],
  ['ddc','2026-10-01T00:50:37.576Z','2026-10-01T00:50:42.980Z','알림마당 - 동두천시 자유수호평화박물관',14],
  ['history-seoul','2026-10-01T00:50:42.985Z','2026-10-01T00:50:47.220Z','서울역사편찬원 > 편찬원 소개 > 공지사항 > 알림',0],
  ['job-gg','2026-10-01T00:54:16.840Z','2026-10-01T00:54:17.749Z','공공일자리 | 잡아바 채용정보',63],
  ['namuk','2026-10-01T00:54:34.975Z','2026-10-01T00:54:39.268Z','국립농업박물관 채용 | 채용 공고',0],
  ['museum-or-kr','2026-10-01T00:54:39.272Z','2026-10-01T00:54:43.822Z','채용공고 – 사단법인 한국박물관협회',12],
  ['seoul','2026-10-01T00:54:43.827Z','2026-10-01T00:54:47.609Z','채용시험 | 서울특별시',10],
  ['korea-kr','2026-10-01T00:54:47.612Z','2026-10-01T00:54:52.987Z','채용정보 | 정책자료 | 대한민국 정책브리핑',21],
  ['kdp-aks','2026-10-01T00:54:52.990Z','2026-10-01T00:54:57.502Z','한국학자료통합플랫폼 - 한국학 소식',21],
  ['work24-youth','2026-10-01T00:59:50.896Z','2026-10-01T01:00:20.909Z','프로그램 정보 | 홈 > 일경험 프로그램 > 프로그램 정보 | 청년일경험 포털',48],
  ['gjf-youth','2026-10-01T00:56:30.549Z','2026-10-01T00:56:38.883Z','경기도일자리재단 - 청년',0],
  ['csv-culture','2026-10-01T01:00:36.339Z','2026-10-01T01:00:58.679Z','문화품앗이 문화체육자원봉사 연결시스템 [봉사자 모집공고]',10],
  ['1365-volunteer','2026-10-01T00:56:44.255Z','2026-10-01T00:56:50.966Z','시간인증봉사(목록보기) | 1365 자원봉사포털',0],
  ['museum-notice-volunteer','2026-10-01T00:56:50.971Z','2026-10-01T00:56:57.031Z','국립중앙박물관>소식·참여>소식>알림>전체>목록',0]
];
const meta = new Map(captures.map(([id, startedAt, checkedAt, title, rowCount]) => [id, { id, startedAt, checkedAt, title, rowCount }]));
if (meta.size !== inventory.sources.length) throw new Error('Capture/source inventory count mismatch');

const khsList = 'https://www.khs.go.kr/multiBbz/selectMultiBbzList.do?mn=NS_01_06&bbzId=newexam';
const candidates = new Map();
function ev(field, url, text, source = 'list') { return { field, url, text, source }; }
function add(siteId, posting, evidence) {
  if (!candidates.has(siteId)) candidates.set(siteId, []);
  candidates.get(siteId).push({ posting, evidence });
}

const artTitle = '국립문화유산연구원 미술문화유산연구실 공무직근로자(연구원 가급, 라급) 채용 공고';
const artUrl = 'https://www.khs.go.kr/multiBbz/selectMultiBbzView.do?id=9984&no=34582&bbzId=newexam&pageIndex=1&pageUnit=10&strWhere=&searchWrd=&sdate=&edate=&mn=NS_01_06';
const artRow = artTitle + ' / 접수 마감 2026-10-07';
add('khs', { title: artTitle, organization: '국립문화유산연구원', url: artUrl, applicationEndAt: '2026-10-07', deadlineDate: '2026-10-07', roleText: '지정동산문화유산 정기조사 및 보고서 작성 지원', detailStatus: 'verified', detailWarning: '응시자격 세부요건이 담긴 HWPX 첨부파일은 열어 확인하지 못했으므로 자격 적합성은 미확인' }, [
  ev('title', khsList, artRow),
  ev('applicationEndAt', artUrl, '원서접수 기간 2026.10.06 ~ 2026.10.07', 'detail'),
  ev('deadlineDate', artUrl, '원서접수 기간 2026.10.06 ~ 2026.10.07', 'detail'),
  ev('roleText', artUrl, '지정동산문화유산 정기조사 및 보고서 작성 지원 업무', 'detail'),
  ev('detailWarning', artUrl, '응시자격은 첨부 HWPX에 수록되어 있으나 해당 첨부는 열어 확인하지 않음', 'detail')
]);

const buyeoTitle = '국립부여문화유산연구소 기간제근로자(선임연구원/연구원, 고고학) 신규 채용 공고';
const buyeoUrl = 'https://www.khs.go.kr/multiBbz/selectMultiBbzView.do?id=9979&no=34577&bbzId=newexam&pageIndex=1&pageUnit=10&strWhere=&searchWrd=&sdate=&edate=&mn=NS_01_06';
const buyeoText = buyeoTitle + ' / 원서접수 2026.09.30 ~ 2026.10.08';
add('khs', { title: buyeoTitle, organization: '국립부여문화유산연구소', url: buyeoUrl, applicationStartAt: '2026-09-30', applicationEndAt: '2026-10-08', deadlineDate: '2026-10-08', roleText: '왕궁리·관북리 유적 고고학 조사 관련 기간제 연구 업무', detailStatus: 'verified', detailWarning: '첨부서류의 자격 세부항목은 별도 검토 필요' }, [
  ev('title', khsList, buyeoText),
  ev('applicationStartAt', buyeoUrl, '원서접수 기간 2026.09.30 ~ 2026.10.08', 'detail'),
  ev('applicationEndAt', buyeoUrl, '원서접수 기간 2026.09.30 ~ 2026.10.08', 'detail'),
  ev('deadlineDate', buyeoUrl, '원서접수 기간 2026.09.30 ~ 2026.10.08', 'detail'),
  ev('roleText', buyeoUrl, '익산 왕궁리유적 및 부여 관북리유적 고고학 조사 관련 업무', 'detail')
]);

const gyeongjuTitle = '국립경주문화유산연구소 기간제근로자(금척리고분군-고고) 채용 공고';
const gyeongjuUrl = 'https://www.khs.go.kr/multiBbz/selectMultiBbzView.do?id=9978&no=34576&bbzId=newexam&pageIndex=1&pageUnit=10&mn=NS_01_06&strWhere=&searchWrd=&sdate=&edate=';
const gyeongjuText = gyeongjuTitle + ' / 원서접수 2026.10.06 ~ 2026.10.09 18:00';
add('khs', { title: gyeongjuTitle, organization: '국립경주문화유산연구소', url: gyeongjuUrl, applicationStartAt: '2026-10-06', applicationEndAt: '2026-10-09', deadlineDate: '2026-10-09', roleText: '금척리고분군 고고학 조사 관련 기간제 업무', detailStatus: 'verified', detailWarning: '첨부서류의 자격 세부항목은 별도 검토 필요' }, [
  ev('title', khsList, gyeongjuText),
  ev('applicationStartAt', gyeongjuUrl, '원서접수 기간 2026.10.06 ~ 2026.10.09 18:00', 'detail'),
  ev('applicationEndAt', gyeongjuUrl, '원서접수 기간 2026.10.06 ~ 2026.10.09 18:00', 'detail'),
  ev('deadlineDate', gyeongjuUrl, '원서접수 기간 2026.10.06 ~ 2026.10.09 18:00', 'detail'),
  ev('roleText', gyeongjuUrl, '금척리고분군 고고학 조사 업무', 'detail')
]);

const museumList = 'https://www.museum.go.kr/MUSEUM/contents/M0701030000.do?catCustomType=post&catId=54';
const iksanTitle = '국립익산박물관 공무직근로자(사무보조) 채용 공고';
add('museum-go-kr', { title: iksanTitle, organization: '국립익산박물관', applicationStartAt: '2026-10-08', applicationEndAt: '2026-10-13', deadlineDate: '2026-10-13', detailStatus: 'list_only' }, [
  ev('title', museumList, iksanTitle + ' / 접수 2026.10.08~10.13 / 채용중'),
  ev('applicationStartAt', museumList, iksanTitle + ' / 접수 2026.10.08~10.13'),
  ev('applicationEndAt', museumList, iksanTitle + ' / 접수 2026.10.08~10.13'),
  ev('deadlineDate', museumList, iksanTitle + ' / 접수 2026.10.08~10.13')
]);

const guideTitle = '2026년 국립중앙박물관 고객지원팀 공무직 채용 공고(중국어 전시해설사)';
const guideUrl = 'https://www.museum.go.kr/MUSEUM/contents/M0701030000.do?schM=view&catCustomType=post&catId=54&arcId=24007&cp=1&sv=';
add('museum-go-kr', { title: guideTitle, organization: '국립중앙박물관', url: guideUrl, status: '채용중', detailStatus: 'verified', detailWarning: '목록은 접수 2026.09.28~10.06, 상세 일정표는 2026.09.28~10.14로 마감일이 상충하므로 원문/담당부서 재확인 필요' }, [
  ev('title', museumList, guideTitle + ' / 접수 2026.09.28~10.06 / 채용중'),
  ev('status', museumList, guideTitle + ' / 채용중'),
  ev('detailWarning', guideUrl, '상세 본문 일반 기간 2026.09.28~10.14; 일정표 최종 접수일 2026.10.14. 목록 표시 최종 접수일은 2026.10.06으로 상충', 'detail')
]);

const csvUrl = 'https://csv.culture.go.kr/frt/biz/provol/selectProvolList.do';
const inDangTitle = '[대구보건대학교 인당뮤지엄] <부지현의 코스모스> 전시 10월 자원봉사자 모집';
const inDangRow = inDangTitle + ' / 모집 2026.09.28~2026.10.29 / 활동 2026.10.09~2026.10.31 / 성인';
add('csv-culture', { title: inDangTitle, organization: '대구보건대학교 인당뮤지엄', experienceType: 'volunteer', applicationEndAt: '2026-10-29', programStartAt: '2026-10-09', programEndAt: '2026-10-31', eligibilityText: '성인', detailStatus: 'list_only' }, [
  ev('title', csvUrl, inDangRow), ev('applicationEndAt', csvUrl, inDangRow), ev('programStartAt', csvUrl, inDangRow), ev('programEndAt', csvUrl, inDangRow), ev('eligibilityText', csvUrl, inDangRow)
]);
const hoeamsaTitle = '2026 유네스코 세계유산 자원봉사단(WHV) 「Living Heritage at Hoeamsa」 청소년 문화유산 기획·지원단 모집';
const hoeamsaRow = hoeamsaTitle + ' / 모집 2026.09.27~2026.10.03 / 활동 2026.10.03~2026.10.10 / 모집중';
add('csv-culture', { title: hoeamsaTitle, organization: '유네스코 세계유산 자원봉사단', experienceType: 'volunteer', applicationEndAt: '2026-10-03', programStartAt: '2026-10-03', programEndAt: '2026-10-10', detailStatus: 'list_only', detailWarning: '참여 자격의 연령 범위는 목록에 상세히 표시되지 않아 원문 확인 필요' }, [
  ev('title', csvUrl, hoeamsaRow), ev('applicationEndAt', csvUrl, hoeamsaRow), ev('programStartAt', csvUrl, hoeamsaRow), ev('programEndAt', csvUrl, hoeamsaRow), ev('detailWarning', csvUrl, hoeamsaRow)
]);

const volunteerUrl = 'https://www.1365.go.kr/vols/1572247904127/partcptn/timeCptn.do';
function volunteer(title, organization, row, applicationEndAt, programStartAt, programEndAt, extra = {}) {
  add('1365-volunteer', { title, organization, experienceType: 'volunteer', applicationEndAt, programStartAt, programEndAt, detailStatus: 'list_only', ...extra }, [
    ev('title', volunteerUrl, row), ev('applicationEndAt', volunteerUrl, row), ev('programStartAt', volunteerUrl, row), ev('programEndAt', volunteerUrl, row),
    ...(extra.eligibilityText ? [ev('eligibilityText', volunteerUrl, row)] : []), ...(extra.region ? [ev('region', volunteerUrl, row)] : [])
  ]);
}
volunteer('암사동선사유적박물관 자원봉사자 모집 (2026.10.09~10.11 오후팀)', '서울암사동유적', '암사동선사유적박물관 자원봉사자 모집 / 봉사 2026.10.09~10.11 / 신청 2026.09.11~10.07 / 성인', '2026-10-07', '2026-10-09', '2026-10-11', { region: '서울특별시 강동구' });
volunteer('허준축제 허준박물관 전시 부스 도우미 (10:00~13:00)', '강서문화원·허준박물관', '허준축제 허준박물관 전시 부스 도우미 / 봉사 2026.10.10~10.11 10:00~13:00 / 신청 2026.09.30~10.07 / 성인', '2026-10-07', '2026-10-10', '2026-10-11', { region: '서울특별시 강서구' });
volunteer('상명대학교박물관 기획전시실 전시지킴이 및 관리보조 오후팀', '상명대학교박물관', '상명대학교박물관 기획전시실 전시지킴이 및 관리보조 오후팀 / 봉사 2026.09.01~10.30 / 신청 2026.08.12~10.23 / 성인', '2026-10-23', '2026-09-01', '2026-10-30', { region: '서울특별시 종로구' });
volunteer('상명대학교박물관 기획전시실 전시지킴이 및 관리보조 오전팀', '상명대학교박물관', '상명대학교박물관 기획전시실 전시지킴이 및 관리보조 오전팀 / 봉사 2026.09.01~10.30 / 신청 2026.08.25~10.29 / 성인', '2026-10-29', '2026-09-01', '2026-10-30', { region: '서울특별시 종로구' });
volunteer('국립항공박물관 10월 전시실 오전 자원봉사', '국립항공박물관', '국립항공박물관 10월 전시실 오전 자원봉사 / 봉사 2026.10.01~10.31 / 신청 2026.09.23~10.28 / 성인', '2026-10-28', '2026-10-01', '2026-10-31', { region: '서울특별시 강서구' });
volunteer('국립항공박물관 10월 전시실 오후 자원봉사', '국립항공박물관', '국립항공박물관 10월 전시실 오후 자원봉사 / 봉사 2026.10.01~10.31 / 신청 2026.09.23~10.28 / 성인', '2026-10-28', '2026-10-01', '2026-10-31', { region: '서울특별시 강서구' });
volunteer('2026 수원광교박물관 문화행사 가을문화축제 행사 요원', '수원광교박물관', '수원광교박물관 가을문화축제 행사 요원 / 봉사 2026.10.09 / 신청 2026.09.11~10.07 / 성인', '2026-10-07', '2026-10-09', '2026-10-09', { region: '경기도 수원시' });
volunteer('이천시립박물관 10월 자원봉사자 모집(QR승인)', '이천문화재단(이천시립박물관·서희역사관)', '이천시립박물관 10월 자원봉사 / 봉사 2026.10.01~10.31 / 신청 2026.09.15~10.30 / 성인', '2026-10-30', '2026-10-01', '2026-10-31', { region: '경기도 이천시' });
volunteer('시흥오이도박물관 상설전시실 안내데스크 방문객 안내 (성인 주말 오후)', '시흥오이도박물관(시흥시 관광과)', '시흥오이도박물관 상설전시실 안내데스크 방문객 안내 / 봉사 2026.10.03~10.31 / 신청 2026.09.18~10.30 / 성인', '2026-10-30', '2026-10-03', '2026-10-31', { region: '경기도 시흥시' });
volunteer('경기도자박물관 교육프로그램 키트 준비·보조 및 환경정비', '(재)한국도자재단 경기도자박물관', '경기도자박물관 교육키트 준비·보조 및 환경정비 / 봉사 2026.09.23~11.01 / 신청 2026.09.22~10.31 / 성인', '2026-10-31', '2026-09-23', '2026-11-01', { region: '경기도 광주시' });
volunteer('자연생태박물관 전시장 관리 및 안내 (2026년 10~12월 오전)', '부천시 공원조성과', '자연생태박물관 전시장 관리 및 안내 오전 / 봉사 2026.10.01~12.31 / 신청 2026.09.07~12.25 / 성인', '2026-12-25', '2026-10-01', '2026-12-31', { region: '경기도 부천시' });

const finishedAt = '2026-10-01T01:07:48.297Z';
const startedAt = '2026-10-01T00:24:04.496Z';
const overrides = { 'nyj': 'https://nyj.go.kr/tracer/info.jsp' };
const sources = inventory.sources.map(site => {
  const c = meta.get(site.id);
  if (!c) throw new Error('Missing Chrome capture: ' + site.id);
  const url = overrides[site.id] || site.url;
  const failed = site.id === 'nyj';
  const scope = site.id === '1365-volunteer'
    ? '서울·경기, 모집중, 제목 박물관 조건. 5개 페이지/46행을 Chrome UI에서 읽었으나 정규화된 후보 일부만 기록; 모든 상세 미확인.'
    : site.id === 'csv-culture'
      ? '문화·모집중 조건의 1페이지(전체 5페이지 중)만 Chrome UI로 확인.'
      : site.id === 'work24-youth'
        ? '청년일경험 목록 48건씩 보기의 1페이지(전체 8페이지 중) 확인.'
        : 'Chrome UI에서 확인한 현재 화면/검색범위. 전체 페이지 및 상세 확인은 미완료.';
  const rowText = c.rowCount ? 'structuredRowCount=' + c.rowCount : 'structuredRowCount=0 (화면 내 구조화된 행 추출은 확인되지 않음; 공고 0건을 뜻하지 않음)';
  const baseEvidence = failed ? [] : [{ url, text: 'Chrome UI 확인: ' + c.title + '; checkedAt=' + c.checkedAt + '; ' + rowText + '; ' + scope, source: 'list' }];
  return {
    siteId: site.id,
    startedAt: c.startedAt,
    checkedAt: c.checkedAt,
    coverage: failed ? 'failed' : 'partial',
    error: failed ? 'Chrome에서 개발자 도구 감지 차단 화면이 노출되어 우회하지 않고 중단함.' : '확인 범위의 Chrome UI는 검토했으나 전체 페이지 또는 전체 공고 상세를 확인하지 않아 완전한 후보 집합으로 볼 수 없음.',
    scope,
    expectedCount: null,
    listEvidence: baseEvidence,
    postings: candidates.get(site.id) || []
  };
});
const observations = { schemaVersion: 1, runId, inventoryFingerprint: inventory.fingerprint, startedAt, finishedAt, sources };
const review = {
  schemaVersion: 1, runId, inventoryFingerprint: inventory.fingerprint, startedAt, finishedAt,
  browser: 'Chrome UI', sourceCount: sources.length, coverage: { partial: sources.filter(s => s.coverage === 'partial').length, failed: sources.filter(s => s.coverage === 'failed').length, unvisited: 0 },
  captures: captures.map(([id, sourceStartedAt, checkedAt, title, structuredRowCount]) => ({ siteId: id, startedAt: sourceStartedAt, checkedAt, title, structuredRowCount, observedUrl: overrides[id] || inventory.sources.find(s => s.id === id)?.url })),
  collectionNotes: [
    '미술 키워드 제거 외에, 복원 공고 제목을 재검사했을 때 독립 차단어 가급도 일치해 해당 키워드 한 항목을 추가 제거했다. 1급~5급 및 가급 연구원 등 나머지 제외어는 유지했다.',
    '모든 등록 소스의 Chrome 방문 기록을 실행 observation에 포함했다. 페이지 전체를 열지 않은 소스는 partial, 브라우저 차단은 failed로 표시했다.',
    '1365는 서울·경기 5개 페이지, 46개 결과를 확인했으나 핵심 후보만 정규화해 partial로 보존했다.',
    '문화품앗이는 41개 결과 중 1페이지/5페이지만 확인했다.',
    '잡아바 박물관 검색 결과의 경비원 공고는 기존 경비 제외어가 적용되어 노출 후보에서 제외된다.'
  ],
  restoredCandidate: {
    priorSource: 'nrich', priorPostingId: '48402', title: artTitle, priorBehavior: '지난 실행에서 해당 제목이 제외 집계에 들어갔다. 당시에는 미술과 가급이 모두 제목과 일치했으며, 현재는 두 독립 차단어를 제거해 다시 통과한다.',
    currentSource: 'khs', currentCheckUrl: artUrl, outcome: '현행 규칙에서 제외되지 않으며, 국가유산청 원문에서 접수 마감 2026-10-07 및 직무를 재확인해 후보로 저장했다.',
    uncertainty: '응시자격은 HWPX 첨부 미확인 상태로 미상 처리한다.'
  },
  detailChecks: [
    { siteId: 'khs', checkedAt: '2026-10-01T00:43:09.000Z', title: artTitle, fields: ['title', 'applicationEndAt', 'roleText'], attachmentEligibility: '미확인' },
    { siteId: 'khs', checkedAt: '2026-10-01T00:44:08.000Z', title: buyeoTitle, fields: ['title', 'applicationStartAt', 'applicationEndAt', 'roleText'], attachmentEligibility: '미확인' },
    { siteId: 'khs', checkedAt: '2026-10-01T00:44:27.000Z', title: gyeongjuTitle, fields: ['title', 'applicationStartAt', 'applicationEndAt', 'roleText'], attachmentEligibility: '미확인' }
  ],
  lineageDiagnostics: {
    builderInventoryGenerator: 'installed workfinder/scripts/inventory.mjs',
    builderFingerprint: inventory.fingerprint,
    repositoryInventoryGenerator: 'scripts/inventory.mjs',
    repositoryGeneratorFingerprint: '52db63368736e3e30c955267a66bb371cf73946694c46d3ba735a6f70748e112',
    finding: 'The skill inventory generator previously hashed raw CRLF while the repository publisher normalized CRLF to LF. The skill now performs the same normalization and both generators produce the same fingerprint.'
  },
  scheduleConflicts: [
    '국립중앙박물관 중국어 전시해설사 공고: 목록 접수 마감 2026-10-06, 상세 일정표 접수 마감 2026-10-14로 상충; 자료에는 확정 날짜를 넣지 않고 경고를 보존했다.',
    '하남문화재단 공고 PDF: 본문 일부 연도 표기 오탈자와 일부 페이지 세부 검토 미완료; 마감 2026-10-02, 이후 전형일은 참고 정보로만 취급한다.'
  ],
  limitations: [
    '다수 소스는 최신 목록 1페이지만 확인했다. partial은 미확인 페이지에 후보가 더 있을 수 있다는 뜻이다.',
    '남양주시 소스는 브라우저 개발자 도구 감지 차단 화면으로 실패 처리했다.',
    '첨부 응시자격, 일정 충돌, 목록-only 자원봉사는 사용자 지원 가능성을 확정하지 않는다.'
  ]
};
await writeFile(join(runDir, 'observations.json'), JSON.stringify(observations, null, 2), 'utf8');
await writeFile(join(runDir, 'review.json'), JSON.stringify(review, null, 2), 'utf8');
console.log(JSON.stringify({ observations: join(runDir, 'observations.json'), review: join(runDir, 'review.json'), sourceCount: sources.length, postings: sources.reduce((n, s) => n + s.postings.length, 0), fingerprint: inventory.fingerprint }));
