import { scrapeWebsite } from './src/utils/scraper.js';

async function test() {
  console.log("=== Testing NCS 공정채용 ===");
  try {
    const res1 = await scrapeWebsite('https://www.ncs.go.kr/blind/bl04/RecrtNotifList.do');
    console.log("NCS Result:", res1);
  } catch(e) {
    console.error("NCS Error", e);
  }

  console.log("\n=== Testing 나라일터 ===");
  try {
    const res2 = await scrapeWebsite('https://gojobs.go.kr/apmList.do');
    console.log("나라일터 Result:", res2);
  } catch(e) {
    console.error("나라일터 Error", e);
  }
}

test();
