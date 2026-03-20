import { scrapeWebsite } from './src/utils/scraper.js';

async function test() {
  const url1 = 'https://www.museum.go.kr/MUSEUM/contents/M0701030000.do?catCustomType=post&catId=54';
  const url2 = 'https://www.hangeul.go.kr/news/newsList.do?bbs_id=30&curr_menu_cd=0106010600';

  console.log("Testing 국립중앙박물관...");
  const res1 = await scrapeWebsite(url1);
  console.log(res1);

  console.log("\\nTesting 국립한글박물관...");
  const res2 = await scrapeWebsite(url2);
  console.log(res2);
}

test();
