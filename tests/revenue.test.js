// 요금 계산기 · 저장 시험(AC-44~51).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as seed from '../site/js/data/seed.js';
import { annual, validate, isValidKnobs } from '../site/js/core/revenue.js';
import { createStore, STORAGE_KEY } from '../site/js/store.js';

function memStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), _m: m };
}

test('ac44 손잡이 9개 기본값', () => {
  assert.equal(seed.knobKeys.length, 9);
  assert.deepEqual(seed.defaultKnobs, {
    soloFee: 300000, linkFee: 200000, soloCount: 50, convPct: 10, adSpend: 10000000, feePct: 15, agencyCount: 20, extraMonths: 3, linkCount: 10,
  });
  assert.ok(isValidKnobs(seed.defaultKnobs));
});

test('ac45 연 매출 4줄 + 합계', () => {
  const r = annual(seed.defaultKnobs);
  assert.equal(r.lines.length, 4);
  assert.equal(r.total, r.lines.reduce((s, l) => s + l.value, 0));
});

test('ac46 기본값: 180,000,000 · 90,000,000 · 90,000,000 · 24,000,000 = 384,000,000', () => {
  const r = annual(seed.defaultKnobs);
  assert.deepEqual(r.lines.map((l) => l.value), [180000000, 90000000, 90000000, 24000000]);
  assert.equal(r.total, 384000000);
  // 따로 다시 셈
  const k = seed.defaultKnobs;
  const conv = k.soloCount * (k.convPct / 100) * k.adSpend * (k.feePct / 100) * 12;
  assert.equal(Math.round(conv), r.lines[1].value);
});

test('ac47 범위 밖 · 빈칸 · 문자는 받지 않음', () => {
  assert.equal(validate('convPct', '101').ok, false);
  assert.equal(validate('convPct', '').ok, false);
  assert.equal(validate('convPct', 'abc').ok, false);
  assert.equal(validate('convPct', '1.5').ok, false);
  assert.equal(validate('convPct', '-1').ok, false);
  assert.deepEqual(validate('adSpend', '20,000,000'), { ok: true, value: 20000000 });
  // 저장소: 바로 전 값 유지(검사를 통과한 값만 setKnobs로 감)
  const s = createStore(() => memStorage());
  assert.throws(() => s.setKnobs({ ...s.knobs(), convPct: 101 }));
  assert.equal(s.knobs().convPct, 10);
});

test('ac48 거절 이유에 허용 범위가 들어감', () => {
  const r = validate('feePct', '200');
  assert.match(r.reason, /허용 범위 0~100%/);
});

test('ac49 되돌리기는 9개를 1번에 기본값으로', () => {
  const st = memStorage();
  const s = createStore(() => st);
  s.setKnobs({ ...s.knobs(), soloCount: 80, feePct: 12 });
  assert.equal(JSON.parse(st.getItem(STORAGE_KEY)).soloCount, 80);
  let calls = 0;
  s.subscribe(() => { calls += 1; });
  s.resetKnobs();
  assert.deepEqual(s.knobs(), seed.defaultKnobs);
  assert.equal(calls, 1);
});

test('ac51 저장소를 쓸 수 없으면 기본값으로 동작하고 안내', () => {
  const s = createStore(() => { throw new Error('blocked'); });
  s.loadKnobs();
  assert.deepEqual(s.knobs(), seed.defaultKnobs);
  assert.equal(s.saveFailed, true);
  // 깨진 저장값은 버림
  const s2 = createStore(() => memStorage({ [STORAGE_KEY]: '{"v":1,"soloFee":"x"}' }));
  s2.loadKnobs();
  assert.deepEqual(s2.knobs(), seed.defaultKnobs);
  // 정상 저장값은 읽음
  const s3 = createStore(() => memStorage({ [STORAGE_KEY]: JSON.stringify({ v: 1, ...seed.defaultKnobs, soloCount: 70 }) }));
  s3.loadKnobs();
  assert.equal(s3.knobs().soloCount, 70);
});
