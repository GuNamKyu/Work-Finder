// 직무경험 공고 크롤링 대상 URL 목록
// 채용공고(url.txt)와 별도로 관리

export const EXPERIENCE_URLS = {
  // 문화자원봉사센터 - 봉사자 모집공고 (지역: 서울/경기, 구분: 문화, 봉사명: 박물관)
  csvCulture: 'https://csv.culture.go.kr/frt/biz/provol/selectProvolList.do',

  // 1365 자원봉사포털 - 시간인증봉사 목록 (봉사지역: 서울/경기, 봉사명: 박물관)
  portal1365: 'https://www.1365.go.kr/vols/1572247904127/partcptn/timeCptn.do',

  // 국립중앙박물관 - 알림 게시판 (자원봉사 키워드 검색, 1주일 이내 필터)
  museumNotice: 'https://www.museum.go.kr/MUSEUM/contents/M0701010000.do?pageSize=10&catCustomType=united&catId=128&arcDataType=&sc=&sv=%EC%9E%90%EC%9B%90%EB%B4%89%EC%82%AC',
} as const;
