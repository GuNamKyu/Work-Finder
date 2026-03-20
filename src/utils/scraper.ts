export interface PostingFound {
  title: string;
  regDate: string;
  deadlineDate: string | null;
}

export interface ScrapeResult {
  hasKeyword: boolean;
  postings: PostingFound[];
  error?: string;
}

const KEYWORDS = ['채용', '공고', '모집'];

// Dates from 2000 to now, matching formats like:
// 2023-10-23, 2023.10.23, 23/10/23, 23년 10월 23일, 2023. 10. 23.
const DATE_REGEX = /(20\d{2}|\d{2})[-./년]\s*(0?[1-9]|1[0-2])[-./월]\s*(0?[1-9]|[12][0-9]|3[01])일?/g;

function parseDateSegments(yearStr: string, monthStr: string, dayStr: string): Date | null {
  try {
    let year = parseInt(yearStr, 10);
    // If year is 2 digits like 23, make it 2023
    if (year < 100) year += 2000;
    
    let month = parseInt(monthStr, 10) - 1; // 0-indexed month
    let day = parseInt(dayStr, 10);
    
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
    return null;
  } catch {
    return null;
  }
}

function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export const scrapeWebsite = async (url: string): Promise<ScrapeResult> => {
  try {
    let htmlTexts: string[] = [];

    if (url.includes('ncs.go.kr/blind/bl04/RecrtNotifList.do')) {
      // 1. 공정채용 특수 처리
      const targetUrl = new URL(url);
      targetUrl.searchParams.set('searchNcsLclasCd', '08');
      targetUrl.searchParams.set('searchNcsMclasCd', '01');
      targetUrl.searchParams.set('searchNcsSclasCd', '04');
      targetUrl.searchParams.set('searchNcsSbclasCd', '01');
      
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl.toString())}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error(`Proxy Network Error: ${response.status}`);
      const data = await response.text();
      if (data) htmlTexts.push(data);

    } else if (url.includes('gojobs.go.kr') || url.includes('job.gg.go.kr')) {
      // 2. 나라일터 & 경기도 공공일자리 특수 처리
      const keywords = ['기념관', '연구원', '박물관', '문화재단'];
      
      let baseUrlStr = '';
      let searchParam = '';
      if (url.includes('gojobs.go.kr')) {
        baseUrlStr = 'https://gojobs.go.kr/apmList.do?menuNo=401&mngrMenuYn=N&selMenuNo=400';
        searchParam = 'searchSelectninsttnm';
      } else {
        baseUrlStr = 'https://job.gg.go.kr/pblcEmpmn/list.do';
        searchParam = 'pbj_srchTxt';
      }
      
      const fetchPromises = keywords.map(async (kw) => {
        const targetUrl = new URL(baseUrlStr);
        targetUrl.searchParams.set(searchParam, kw);
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl.toString())}`;
        
        try {
           const response = await fetch(proxyUrl);
           if (response.ok) {
             const data = await response.text();
             return data || '';
           }
        } catch (e) {
           console.error(`Fetch error for keyword ${kw} at ${baseUrlStr}`, e);
        }
        return '';
      });
      
      const results = await Promise.all(fetchPromises);
      htmlTexts = results.filter(res => res.length > 0);
      
      if (htmlTexts.length === 0) {
        throw new Error(`No contents found at ${url}`);
      }

    } else {
      // 3. 기존 일반 처리 방식
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error(`Proxy Network Error: ${response.status}`);
      }
      const data = await response.text();
      if (!data) {
        throw new Error(`No contents found at ${url}`);
      }
      htmlTexts.push(data);
    }

    const EXCLUDE_WORDS = [
      '합격', '결과', '취소', 
      '응시현황', '채용과정', 
      '대표이사', '가급 연구원', 
      '1급', '2급', '3급', '4급', '5급',
      '전자통신', '방과후학교 강사', '마주봄 교사', 
      '기간제교사채용', '기간제교원', '사회복지사업 강사', 
      '장애인', '특수교육', '의료인', '의사', 
      '오케스트라', '동아리', '시간강사', '초단시간', 
      '조리원', '요리교실', '진로직업', '외부강사', 
      '강사', '매니저', '가족센터', '제과제빵', 
      '시설미화원', '검찰청', '예술단', '공연장', 
      '조리', '실장', '본부장',
      '선거지원단', '교원', '교사', '주차', 
      '청사관리', '행정실무사', '환경정비', 
      '킨텍스', '농업경영', '회계'
    ];
    const EXTENDED_KEYWORDS = [...KEYWORDS, '채용중'];
    
    interface RawPosting {
      title: string;
      regDate: Date;
      deadlineDate: Date | null;
    }
    const foundPostings: RawPosting[] = [];
    
    const now = new Date();
    // Normalize to 00:00:00 so today's deadlines don't expire mid-day
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // HTML 문서별로 DOM 트리를 이용해 개별 공고 컨테이너 단위로 검색
    for (const htmlText of htmlTexts) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, 'text/html');
      
      doc.querySelectorAll('script, style, noscript').forEach(el => el.remove());
      
      // 논리적 공고 행 단위 컨테이너 탐색 (표의 행, 리스트 항목, 보드 아이템 등)
      let containers = Array.from(doc.querySelectorAll('tbody tr, ul li, ol li, .item, .row, .list_item, .list > div, .board_list > div, .article-list > div'));
      
      // 만약 구조화된 리스트가 없는 페이지(단독 공고 상세 페이지 등)라면 body 전체를 컨테이너로 간주
      if (containers.length === 0 && doc.body) {
         containers = [doc.body];
      }
      
      for (const container of containers) {
         const text = container.textContent || '';
         
         const hasKeyword = EXTENDED_KEYWORDS.some(kw => text.includes(kw));
         const hasExclude = EXCLUDE_WORDS.some(kw => text.includes(kw));

         if (hasKeyword && !hasExclude) {
             const datesInLine: Date[] = [];
             DATE_REGEX.lastIndex = 0; // reset regex
             let match;
             while ((match = DATE_REGEX.exec(text)) !== null) {
               const parsedD = parseDateSegments(match[1], match[2], match[3]);
               if (parsedD && parsedD > new Date(2000, 0, 1) && parsedD <= new Date(2100, 0, 1)) {
                 datesInLine.push(parsedD);
               }
             }

             if (datesInLine.length > 0) {
                 let reg: Date;
                 let deadline: Date | null = null;
                 
                 if (datesInLine.length === 1) {
                   reg = datesInLine[0];
                 } else {
                   // Sort ascending: earliest is regDate, latest is deadlineDate
                   datesInLine.sort((a, b) => a.getTime() - b.getTime());
                   reg = datesInLine[0];
                   deadline = datesInLine[datesInLine.length - 1];
                 }

                 // 만약 마감일이 명시되어 있고, 그 마감일이 '오늘 시작 시간'보다 과거라면 이 공고는 이미 종료된 것임 (제외)
                 if (deadline && deadline < todayStart) {
                   continue; // EXPIRED
                 }

                 // Filter by date (within 45 days)
                 const diffTime = todayStart.getTime() - reg.getTime();
                 const diffDays = diffTime / (1000 * 60 * 60 * 24);
                 
                 if (Math.abs(diffDays) <= 45) {
                     // 제목 추출 로직: 제일 긴/명시적인 <a> 텍스트를 뽑음
                     let title = '';
                     const aTags = Array.from(container.querySelectorAll('a'));
                     // 가장 텍스트가 긴 <a> 태그를 제목으로 추출 (기관명 등 짧은 태그 거르기 위함)
                     const longestA = aTags.reduce((prev, current) => (prev.textContent?.trim().length || 0) > (current.textContent?.trim().length || 0) ? prev : current, aTags[0] || null);

                     if (longestA && longestA.textContent) {
                         title = longestA.textContent.replace(/\s+/g, ' ').trim();
                     } else {
                         // 링크가 없다면, 텍스트를 줄바꿈/탭 기준으로 쪼개서 키워드 있는 줄을 제목으로
                         const lines = text.split(/[\n\t]+/).map(l => l.trim()).filter(l => l.length > 0);
                         const kwLine = lines.find(l => EXTENDED_KEYWORDS.some(kw => l.includes(kw)));
                         title = kwLine || lines[0] || '채용 공고';
                     }
                     
                     // 50자를 넘어가면 자르기 (너무 긴 텍스트 방지)
                     if (title.length > 80) {
                         title = title.substring(0, 80) + '...';
                     }

                     foundPostings.push({ title, regDate: reg, deadlineDate: deadline });
                 }
             }
         }
      }
    }

    if (foundPostings.length === 0) {
      return { hasKeyword: false, postings: [] }; 
    }

    // Sort ascending by registration date (일찍 등록된 순서대로 === 과거순 정렬)
    foundPostings.sort((a, b) => a.regDate.getTime() - b.regDate.getTime());
    
    // Convert to string formatted postings
    const finalPostings = foundPostings.map(p => ({
      title: p.title,
      regDate: formatDate(p.regDate),
      deadlineDate: p.deadlineDate ? formatDate(p.deadlineDate) : null
    }));

    return {
      hasKeyword: true,
      postings: finalPostings
    };
    
  } catch (error: any) {
    return {
      hasKeyword: false,
      postings: [],
      error: error?.message || 'Unknown error'
    };
  }
};
