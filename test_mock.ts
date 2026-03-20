import { scrapeWebsite } from './src/utils/scraper.js';

// Mock fetch to return custom HTML
const originalFetch = global.fetch;
(global as any).fetch = async (url: string) => {
  let html = '';
  if (url.includes('museum')) {
     html = `
       <body>
          <div>
            <h3>[채용] 중박 학예연구원 채용 공고</h3>
            <p>원서 접수: 2026. 3. 16. ~ 2026. 3. 27. 18:00까지</p>
          </div>
       </body>
     `;
  } else if (url.includes('hangeul')) {
     html = `
       <body>
          <div>
             <span>국립한글박물관 전문직 공고</span>
             <span>지원서 접수: 2026. 3. 18.(월) ~ 2026. 2. 10. 마감</span>
             <p>Note: this deadline is passed.</p>
          </div>
       </body>
     `;
  } else if (url.includes('ok')) {
     html = `
       <body>
         [공고] 정상 공고 채용중 2026-03-15
       </body>
     `;
  }

  return {
    ok: true,
    json: async () => ({ contents: html })
  };
};

async function run() {
  console.log("1. 중박 (정상 마감일 있음)");
  console.log(await scrapeWebsite('https://museum.go.kr'));

  console.log("\\n2. 한글박물관 (마감일 지남 -> 스킵되어야 함)");
  console.log(await scrapeWebsite('https://hangeul.go.kr'));

  console.log("\\n3. 단일 날짜 정상 공고");
  console.log(await scrapeWebsite('https://ok.com'));
}

run().finally(() => { global.fetch = originalFetch; });
