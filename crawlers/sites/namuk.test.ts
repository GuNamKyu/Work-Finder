import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePostingLinks } from './namuk.js';

test('국립농업박물관 채용 포털은 공고 상세 링크를 중복 없이 수집한다', () => {
  const postings = parsePostingLinks([
    { title: ' 2026년 청년인턴 채용 (장애인 제한) ', href: '/career/jobs/128392' },
    { title: '같은 공고의 다른 추적 URL', href: 'https://namukrecruit.recruiter.co.kr/career/jobs/128392?source=list#top' },
    { title: '다른 도메인', href: 'https://example.org/career/jobs/2' },
    { title: '', href: '/career/jobs/3' },
  ]);

  assert.equal(postings.length, 1);
  assert.equal(postings[0].title, '2026년 청년인턴 채용 (장애인 제한)');
  assert.equal(postings[0].organization, '국립농업박물관');
  assert.equal(postings[0].url, 'https://namukrecruit.recruiter.co.kr/career/jobs/128392');
});

test('국립농업박물관 링크 문구에서 상태·접수기간을 제목과 분리한다', () => {
  const [p] = parsePostingLinks([{
    title: '접수중 국립농업박물관 2026년 제6차 직원 채용(일반직 5급 - 학예) 공채 일반채용 신입/경력 D-7 2026.10.27 ~ 2026.11.03 17:00',
    href: '/career/jobs/131704',
  }]);
  assert.equal(p.title, '국립농업박물관 2026년 제6차 직원 채용(일반직 5급 - 학예)');
  assert.equal(p.status, '접수중');
  assert.equal(p.regDate, '2026-10-27');
  assert.equal(p.deadlineDate, '2026-11-03');
});
