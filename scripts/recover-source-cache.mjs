// One-time public-data recovery from known successful Actions artifacts.
// Credentials and signed download URLs stay in memory and are never logged/saved.
import { execFileSync } from 'node:child_process';
import { inflateRawSync } from 'node:zlib';
import { writeFile } from 'node:fs/promises';
const auth = process.env.GITHUB_TOKEN || execFileSync('git', ['credential', 'fill'], {input:'protocol=https\nhost=github.com\n\n',encoding:'utf8',windowsHide:true}).match(/^password=(.+)$/m)?.[1];
if (!auth) throw new Error('GitHub 인증을 찾을 수 없음');
const headers = {Authorization:`Bearer ${auth}`,Accept:'application/vnd.github+json','User-Agent':'Work-Finder-recovery'};
const api = async path => {
 const response = await fetch(`https://api.github.com/repos/GuNamKyu/Work-Finder/${path}`,{headers});
 if (!response.ok) throw new Error(`GitHub API HTTP ${response.status}`);
 return response;
};
function jsonEntry(zip, name) {
 let end = zip.length - 22;
 while (end >= Math.max(0,zip.length-65557) && zip.readUInt32LE(end)!==0x06054b50) end--;
 if (end < 0) throw new Error('유효하지 않은 ZIP');
 let at = zip.readUInt32LE(end+16);
 for(let i=0;i<zip.readUInt16LE(end+10);i++) {
  if(zip.readUInt32LE(at)!==0x02014b50) throw new Error('ZIP 중앙 디렉터리 오류');
  const method=zip.readUInt16LE(at+10),size=zip.readUInt32LE(at+20),len=zip.readUInt16LE(at+28),extra=zip.readUInt16LE(at+30),comment=zip.readUInt16LE(at+32),offset=zip.readUInt32LE(at+42);
  const path=zip.subarray(at+46,at+46+len).toString();
  if(path===name || path.endsWith(`/${name}`)) {
   const start=offset+30+zip.readUInt16LE(offset+26)+zip.readUInt16LE(offset+28);
   const bytes=zip.subarray(start,start+size);
   return JSON.parse((method===8?inflateRawSync(bytes):bytes).toString('utf8'));
  }
  at+=46+len+extra+comment;
 }
 throw new Error(`아카이브에 ${name} 없음`);
}
const recovered=[];
const provenance=[];
for (const [runId, ids] of [[36364659952,['gojobs','khs','cha','csv-culture','1365-volunteer']],[36361968359,['gjf-youth']]]) {
 const {artifacts}=await(await api(`actions/runs/${runId}/artifacts`)).json();
 const artifact=artifacts.find(a=>a.name.startsWith('crawl-results-')&&!a.expired);
 if(!artifact) throw new Error(`실행 ${runId}의 수집 아카이브 없음`);
 const response=await api(`actions/artifacts/${artifact.id}/zip`);
 const zip=Buffer.from(await response.arrayBuffer());
 const all=[...jsonEntry(zip,'results.json'),...jsonEntry(zip,'experience-results.json')];
 for(const id of ids) {
  const r=all.find(r=>r.site.id===id&&!r.error);
  if(!r) throw new Error(`실행 ${runId}에서 ${id} 정상값 없음`);
  recovered.push(r);
  provenance.push({siteId:id,runId,crawledAt:r.crawledAt,count:r.postings.length});
 }
}
await writeFile('data/source-recovery-seed.json',JSON.stringify(recovered,null,2));
await writeFile('data/source-recovery-provenance.json',JSON.stringify({recoveredAt:new Date().toISOString(),note:'이전 정상 수집 기록이며 현재 모집 여부 확정이 아님. 초기 캐시 복구용; 이후 정상 수집값보다 우선하지 않음.',sources:provenance},null,2));
console.log(JSON.stringify(provenance,null,2));
