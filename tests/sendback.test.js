// 되돌리기 대기열 시험(AC-24~30).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as seed from '../site/js/data/seed.js';
import { judge, apply } from '../site/js/core/leads.js';
import { queue, eligibility, mediaCondition, normalizePhone, hashPhone } from '../site/js/core/sendback.js';

const NOW = seed.DEMO_NOW;
const DAY = 24 * 60 * 60000;
const judged = () => judge(seed.leads, seed.invalidNumbers);
const group = (list, m) => queue(list, seed.media, seed.mediaRules, NOW).find((g) => g.media === m);

test('ac24 대기열에는 내원 · 계약 리드만', () => {
  const list = judged();
  const ids = queue(list, seed.media, seed.mediaRules, NOW).flatMap((g) => g.items.map((i) => i.id)).sort();
  assert.deepEqual(ids, ['G01', 'G02', 'G03', 'G04', 'M06', 'M07', 'T01']);
});

test('ac25 동의 없으면 빠지고 이유 "동의 없음"', () => {
  const g02 = group(judged(), 'google').items.find((i) => i.id === 'G02');
  assert.equal(g02.ok, false);
  assert.equal(g02.reason, '동의 없음');
});

test('ac26 Meta 생성 뒤 28일 넘으면 빠짐', () => {
  const m07 = group(judged(), 'meta').items.find((i) => i.id === 'M07');
  assert.equal(m07.ok, false);
  assert.match(m07.reason, /28일/);
});

test('ac27 Google 클릭 뒤 90일 넘으면 빠짐', () => {
  const l = { ...judged().find((x) => x.id === 'G01'), clickAt: NOW - 91 * DAY };
  const e = eligibility(l, seed.mediaRules.google, NOW);
  assert.equal(e.ok, false);
  assert.match(e.reason, /90일/);
  const ok = eligibility({ ...l, clickAt: NOW - 89 * DAY }, seed.mediaRules.google, NOW);
  assert.equal(ok.ok, true);
});

test('ac28 Meta 월 리드 200건 미만이면 조건 미달 · 보내기 0개', () => {
  const g = group(judged(), 'meta');
  assert.equal(g.condition.ok, false);
  assert.match(g.condition.text, /^조건 미달 — 리포트용으로만/);
  assert.equal(g.items.filter((i) => i.sendable).length, 0);
  assert.equal(mediaCondition(seed.mediaRules.meta, 200).ok, true);
  // TikTok은 조사 전(설계 5절)
  assert.equal(group(judged(), 'tiktok').condition.ok, false);
  // Google은 보낼 수 있음 3건
  assert.deepEqual(group(judged(), 'google').items.filter((i) => i.sendable).map((i) => i.id), ['G01', 'G03', 'G04']);
});

test('ac29 해시는 SHA-256 64자, 원래 번호를 담지 않음', async () => {
  for (const l of judged()) {
    for (const m of ['meta', 'google']) {
      const h = await hashPhone(l.phone, m);
      assert.match(h, /^[0-9a-f]{64}$/);
      assert.ok(!h.includes(l.phone));
    }
  }
  assert.equal(normalizePhone('010-0000-0001', 'google'), '+821000000001');
  assert.equal(normalizePhone('010-0000-0001', 'meta'), '821000000001');
  // 정규화한 글자를 그대로 SHA-256한 값과 같은지 확인
  const known = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode('+821000000001'));
  const hex = [...new Uint8Array(known)].map((b) => b.toString(16).padStart(2, '0')).join('');
  assert.equal(await hashPhone('010-0000-0001', 'google'), hex);
});

test('ac30 보내기는 기록 1줄, 같은 리드 다시 보내기 없음', () => {
  const l = judged().find((x) => x.id === 'G01');
  const r = apply(l, { type: 'sent', media: 'Google' }, NOW);
  assert.ok(r.ok);
  assert.equal(r.lead.sentAt, NOW);
  assert.match(r.lead.log.at(-1).text, /보냄\(모의\)/);
  assert.equal(apply(r.lead, { type: 'sent' }, NOW).ok, false);
  const list = judged().map((x) => (x.id === 'G01' ? r.lead : x));
  const it = group(list, 'google').items.find((i) => i.id === 'G01');
  assert.equal(it.sent, true);
  assert.equal(it.sendable, false);
});
