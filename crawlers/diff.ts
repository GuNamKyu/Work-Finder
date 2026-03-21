// 이전 크롤링 결과와 현재 결과를 비교하여 신규 공고 키 목록 생성
import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { CrawlResult } from './types';

const __dirname = dirname(fileURLToPath(import.meta.url));

function postingKey(siteId: string, title: string): string {
  return `${siteId}::${title}`;
}

async function main() {
  const prevPath = join(__dirname, 'results.prev.json');
  const currPath = join(__dirname, 'results.json');
  const outPath = join(__dirname, 'new-postings.json');

  let prevResults: CrawlResult[] = [];
  try {
    prevResults = JSON.parse(await readFile(prevPath, 'utf-8'));
  } catch {
    console.log('이전 결과 없음 — 모든 공고를 신규로 처리');
  }

  let currResults: CrawlResult[];
  try {
    currResults = JSON.parse(await readFile(currPath, 'utf-8'));
  } catch {
    console.error('results.json을 찾을 수 없습니다.');
    process.exit(1);
  }

  // 이전 공고 키 셋
  const prevKeys = new Set<string>();
  for (const r of prevResults) {
    for (const p of r.postings) {
      prevKeys.add(postingKey(r.site.id, p.title));
    }
  }

  // 현재 공고 중 이전에 없던 것 = 신규
  const newKeys: string[] = [];
  for (const r of currResults) {
    for (const p of r.postings) {
      const key = postingKey(r.site.id, p.title);
      if (!prevKeys.has(key)) {
        newKeys.push(key);
      }
    }
  }

  await writeFile(outPath, JSON.stringify(newKeys, null, 2));
  console.log(`신규 공고: ${newKeys.length}건 (전체 ${currResults.reduce((s, r) => s + r.postings.length, 0)}건)`);
}

main().catch(console.error);
