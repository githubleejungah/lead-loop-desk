// 광고주 리포트 시험(AC-33~42). 숫자는 계산 모듈과 따로 다시 셈해 대조한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as seed from '../site/js/data/seed.js';
import { judge, apply } from '../site/js/core/leads.js';
import { byMedia, responseBuckets, unitCost } from '../site/js/core/report.js';

const NOW = seed.DEMO_NOW;
const judged = () => judge(seed.leads, seed.invalidNumbers);
const row = (rep, id) => rep.rows.find((r) => r.id === id);

test('ac33 깔때기 7칸: 시작 상태 매체별 · 합계', () => {
  const rep = byMedia(judged(), seed.media);
  const pick = (f) => [f.spend, f.leads, f.valid, f.connected, f.booked, f.visited, f.contracted];
  assert.deepEqual(pick(row(rep, 'meta').funnel), [2000000, 20, 16, 9, 4, 2, 1]);
  assert.deepEqual(pick(row(rep, 'google').funnel), [2000000, 12, 12, 10, 5, 4, 2]);
  assert.deepEqual(pick(row(rep, 'tiktok').funnel), [1000000, 8, 7, 5, 2, 1, 1]);
  assert.deepEqual(pick(rep.total.funnel), [5000000, 40, 35, 24, 11, 7, 4]);
});

test('ac35 단가는 광고비 ÷ 건수, 원 단위 반올림', () => {
  assert.equal(unitCost(2000000, 12), 166667);
  assert.equal(unitCost(1000000, 7), 142857);
  assert.equal(unitCost(2000000, 3), 666667);
});

test('ac36 시작 상태 CPA: Meta 100,000 · Google 166,667 · TikTok 125,000', () => {
  const rep = byMedia(judged(), seed.media);
  assert.deepEqual(['meta', 'google', 'tiktok'].map((m) => row(rep, m).costs.cpa), [100000, 166667, 125000]);
});

test('ac37 시작 상태 내원 단가: Meta 1,000,000 · Google 500,000 · TikTok 1,000,000', () => {
  const rep = byMedia(judged(), seed.media);
  assert.deepEqual(['meta', 'google', 'tiktok'].map((m) => row(rep, m).costs.perVisit), [1000000, 500000, 1000000]);
});

test('ac38 시연 사례 1(M01 내원까지) 뒤 Meta 내원 단가 666,667', () => {
  let list = judged();
  let l = list.find((x) => x.id === seed.CASE1_LEAD_ID);
  for (let i = 0; i < 3; i += 1) l = apply(l, { type: 'advance' }, NOW).lead;
  assert.equal(l.stage, 3);
  list = list.map((x) => (x.id === l.id ? l : x));
  const rep = byMedia(list, seed.media);
  assert.equal(row(rep, 'meta').costs.perVisit, 666667);
  assert.equal(rep.total.funnel.visited, 8);
});

test('ac39 0건이면 단가 없음(—), 0으로 나누지 않음', () => {
  assert.equal(unitCost(1000000, 0), null);
  const rep = byMedia([], seed.media);
  assert.equal(row(rep, 'meta').costs.perVisit, null);
});

test('ac40 응답 시간 구간 3개 · 응대 대기', () => {
  const b = responseBuckets(judged(), NOW);
  assert.deepEqual(b.rows.map((r) => [r.label, r.count, r.visited]), [['1시간 안', 23, 6], ['1시간 넘음', 9, 1], ['미응대', 1, 0]]);
  assert.equal(b.pending, 2);
  assert.ok(b.rows[0].rate > b.rows[1].rate);
});

test('ac42 매체 3개 × 단가 3개 = 9칸, 따로 다시 셈한 값과 차이 0원', () => {
  const list = judged();
  const rep = byMedia(list, seed.media);
  const validOf = (l) => l.end !== 'invalid' && l.end !== 'duplicate';
  for (const m of seed.media) {
    const mine = list.filter((l) => l.media === m.id);
    const leads = mine.length;
    const valid = mine.filter(validOf).length;
    const visits = mine.filter((l) => validOf(l) && l.stage >= 3).length;
    const exp = [leads, valid, visits].map((n) => (n ? Math.round(m.spend / n) : null));
    const got = ['cpa', 'perValid', 'perVisit'].map((k) => row(rep, m.id).costs[k]);
    assert.deepEqual(got, exp, m.id);
  }
});
