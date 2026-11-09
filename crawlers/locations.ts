// 공고의 근무지·기관 위치. 원문(목록)에 적힌 지역을 우선하고, 조사해 둔 기관 소재지(data/institution-locations.json)를 함께 보여 준다.
import { readFileSync } from 'node:fs';
import type { JobPosting, WorkLocation } from './types.js';

interface Institution {
  id: string; names: string[]; siteIds?: string[]; siteDefault?: boolean;
  area: string; address?: string; verified: boolean; sourceUrl: string; note?: string;
}
export interface LocationTable { checkedAt: string; siteAreaFallback?: Record<string, string>; institutions: Institution[] }

let cache: LocationTable | null = null;
export function loadLocationTable(path = new URL('../data/institution-locations.json', import.meta.url)): LocationTable {
  if (!cache) cache = JSON.parse(readFileSync(path, 'utf8')) as LocationTable;
  return cache;
}
export function setLocationTable(table: LocationTable | null): void { cache = table; }

const norm = (s: string) => s.replace(/\(재\)|\(사\)|재단법인|사단법인|\(주\)|주식회사|[\s·ㆍ.,()[\]]/g, '');
const SIDO = '서울특별시|서울|부산광역시|대구광역시|인천광역시|광주광역시|대전광역시|울산광역시|세종특별자치시|경기도|경기|강원특별자치도|강원도|강원|충청북도|충북|충청남도|충남|전북특별자치도|전라북도|전북|전라남도|전남|경상북도|경북|경상남도|경남|제주특별자치도|제주';
const AREA_RE = new RegExp(`(${SIDO})\\s*([가-힣]{1,6}[시군구])?`);

/** 텍스트(기관명·제목 머리말)에 적힌 시·도/시·군·구. 없으면 null. */
export function areaFromText(text: string): string | null {
  const city = text.match(/^\s*\[([가-힣]{1,6}[시군])\]/);
  if (city) return city[1];
  const m = text.match(AREA_RE);
  return m ? [m[1], m[2]].filter(Boolean).join(' ') : null;
}

function findInstitution(posting: JobPosting, siteId: string, table: LocationTable): Institution | null {
  const org = norm(posting.organization || '');
  if (org) {
    const exact = table.institutions.find(i => i.names.some(n => norm(n) === org));
    if (exact) return exact;
    const part = table.institutions.find(i => i.names.some(n => norm(n).length >= 5 && org.includes(norm(n))));
    if (part) return part;
  }
  return table.institutions.find(i => i.siteDefault && (i.siteIds || []).includes(siteId)) || null;
}

export function resolveLocation(posting: JobPosting, siteId: string, table: LocationTable = loadLocationTable()): WorkLocation {
  const inst = findInstitution(posting, siteId, table);
  const parts: string[] = [];
  const out: WorkLocation = { status: 'unknown', text: '' };
  if (posting.region && posting.region.trim()) { out.workArea = posting.region.trim(); out.workAreaBasis = 'posting_region'; }
  else if (/^\s*\[[가-힣]{1,6}[시군]\]/.test(posting.title)) { out.workArea = areaFromText(posting.title) || undefined; out.workAreaBasis = 'title'; }
  else if (!inst) {
    const fromOrg = areaFromText(posting.organization || '');
    if (fromOrg) { out.workArea = fromOrg; out.workAreaBasis = 'organization_text'; }
  }
  const label = { posting_region: '원문 표기', title: '제목 표기', organization_text: '기관명 표기', board: '게시처 기준' };
  if (out.workArea && out.workAreaBasis) parts.push(`근무지역 ${out.workArea}(${label[out.workAreaBasis]})`);
  if (inst) {
    out.institutionArea = inst.area; out.institutionVerified = inst.verified; out.sourceUrl = inst.sourceUrl; out.checkedAt = table.checkedAt;
    if (inst.address) out.institutionAddress = inst.address;
    parts.push(`기관 소재지 ${inst.address || inst.area}${inst.verified ? '' : ' (시 단위·미검증)'}`);
  } else {
    const fb = table.siteAreaFallback?.[siteId];
    if (fb && !out.workArea) { out.workArea = fb; out.workAreaBasis = 'board'; parts.push(`근무지역 ${fb}(${label.board})`); }
  }
  out.status = inst ? (inst.verified && inst.address ? 'known' : 'partial') : out.workArea ? 'partial' : 'unknown';
  out.text = parts.join(' · ') || '위치 미확인 — 원문에서 근무지를 확인하세요';
  return out;
}
