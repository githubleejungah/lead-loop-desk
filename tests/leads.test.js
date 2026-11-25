// 리드 규칙 시험(AC-03 · AC-07~23 · AC-31). 시험 이름은 수용 기준 번호.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as seed from '../site/js/data/seed.js';
import { judge, apply, timer, maskPhone, displayName, actionsFor, isValid, nextCallTime } from '../site/js/core/leads.js';

const NOW = seed.DEMO_NOW;
const MIN = 60000;
const DAY = 24 * 60 * MIN;
const judged = () => judge(seed.leads, seed.invalidNumbers);
const byId = (list, id) => list.find((l) => l.id === id);
const fresh = (o = {}) => ({ ...byId(judged(), 'M01'), ...o });

test('ac07 시작 상태: 치과 1곳 · 매체 3개 · 리드 40건 · 매체별 리드 수', () => {
  assert.equal(seed.advertiser.name, '가상 치과');
  assert.equal(seed.media.length, 3);
  const list = judged();
  assert.equal(list.length, 40);
  const count = (m) => list.filter((l) => l.media === m).length;
  assert.deepEqual([count('meta'), count('google'), count('tiktok')], [20, 12, 8]);
  assert.equal(list.filter((l) => l.consent).length, 30); // AS-12
  assert.deepEqual(seed.media.map((m) => m.spend), [2000000, 2000000, 1000000]);
});

test('ac08 진행은 한 번에 바로 다음 단계 1개', () => {
  let l = fresh();
  for (let s = 1; s <= 4; s += 1) {
    const r = apply(l, { type: 'advance' }, NOW);
    assert.ok(r.ok);
    assert.equal(r.lead.stage, s);
    l = r.lead;
  }
  assert.equal(apply(l, { type: 'advance' }, NOW).ok, false);
  assert.equal(apply(fresh(), { type: 'set-stage', stage: 2 }, NOW).ok, false); // 건너뛰기 거절
});

test('ac09 앞선 단계로 바꾸기는 거절하고 정정 안내', () => {
  const l = fresh({ stage: 2 });
  const r = apply(l, { type: 'set-stage', stage: 1 }, NOW);
  assert.equal(r.ok, false);
  assert.match(r.reason, /정정/);
});

test('ac10 정정: 바로 전 단계로 1번, 사유 기록', () => {
  const r = apply(fresh({ stage: 3 }), { type: 'correct', reason: '잘못 누름' }, NOW);
  assert.ok(r.ok);
  assert.equal(r.lead.stage, 2);
  assert.equal(r.lead.corrected, true);
  assert.match(r.lead.log.at(-1).text, /사유: 잘못 누름/);
  assert.equal(apply(fresh({ stage: 3 }), { type: 'correct', reason: '' }, NOW).ok, false); // 빈 사유
  assert.equal(apply(fresh({ stage: 3 }), { type: 'correct', reason: 'x'.repeat(101) }, NOW).ok, false);
});

test('ac11 두 번째 정정은 거절', () => {
  const once = apply(fresh({ stage: 3 }), { type: 'correct', reason: '1차' }, NOW).lead;
  const r = apply(once, { type: 'correct', reason: '2차' }, NOW);
  assert.equal(r.ok, false);
  assert.match(r.reason, /1번/);
});

test('ac12 끝 상태 5개는 진행 버튼 0개', () => {
  const list = judged();
  for (const id of ['M16', 'M15', 'M13', 'M02', 'M04']) {
    const l = byId(list, id);
    assert.ok(l.end, id);
    assert.equal(actionsFor(l, NOW).filter((a) => a.type === 'advance').length, 0, id);
    assert.equal(apply(l, { type: 'advance' }, NOW).ok, false, id);
  }
});

test('ac13 결번 판정 2건, 과금 리드에서 빠짐', () => {
  const list = judged();
  const inv = list.filter((l) => l.end === 'invalid').map((l) => l.id);
  assert.deepEqual(inv, ['M02', 'M03']);
  assert.ok(inv.every((id) => !isValid(byId(list, id))));
});

test('ac14 7일 안 같은 번호는 나중 리드만 중복', () => {
  const list = judged();
  assert.deepEqual(list.filter((l) => l.end === 'duplicate').map((l) => l.id).sort(), ['M04', 'M05', 'T08']);
  assert.equal(byId(list, 'M10').end, null); // 먼저 들어온 쪽은 유효
  // 7일 넘으면 중복 아님
  const a = { ...seed.leads[0], id: 'X1', phone: '010-0000-0999', createdAt: NOW - 10 * DAY };
  const b = { ...seed.leads[0], id: 'X2', phone: '010-0000-0999', createdAt: NOW - 2 * DAY };
  const r = judge([a, b], []);
  assert.equal(r[1].end, null);
  assert.equal(list.filter(isValid).length, 35);
});

test('ac15 부재 · 본인 아님은 유효 리드', () => {
  const list = judged();
  assert.ok(isValid(byId(list, 'M15')));
  assert.ok(isValid(byId(list, 'M17')));
  assert.ok(isValid(byId(list, 'M16')));
});

test('ac16 부재 1~3번째 → 당일 · 다음 날 · 3일 뒤 재연락', () => {
  let l = fresh();
  const expected = [NOW + 2 * 60 * MIN, Date.parse('2026-11-26T10:00:00+09:00'), Date.parse('2026-11-28T10:00:00+09:00')];
  for (let i = 0; i < 3; i += 1) {
    const r = apply(l, { type: 'absent' }, NOW);
    assert.ok(r.ok);
    assert.equal(r.lead.absentCount, i + 1);
    assert.equal(r.lead.nextCallAt, expected[i]);
    assert.equal(r.lead.end, null);
    l = r.lead;
  }
  assert.equal(nextCallTime(4, NOW), null);
});

test('ac17 부재 4번째면 부재 종료 · 일정 0개', () => {
  const r = apply(fresh({ absentCount: 3 }), { type: 'absent' }, NOW);
  assert.ok(r.ok);
  assert.equal(r.lead.end, 'absent_closed');
  assert.equal(r.lead.nextCallAt, null);
});

test('ac18 응대 전 리드는 남은 분을 보임', () => {
  const t = timer(byId(judged(), 'M01'), NOW);
  assert.deepEqual(t, { state: 'ok', remaining: 40 });
});

test('ac19 남은 30분 이하면 주의', () => {
  assert.deepEqual(timer(byId(judged(), 'T06'), NOW), { state: 'warn', remaining: 25 });
  assert.equal(timer({ ...fresh(), createdAt: NOW - 30 * MIN }, NOW).state, 'warn');
  assert.equal(timer({ ...fresh(), createdAt: NOW - 29 * MIN }, NOW).state, 'ok');
});

test('ac20 1시간 넘으면 초과 + 넘기기 1번', () => {
  const m20 = byId(judged(), 'M20');
  assert.equal(timer(m20, NOW).state, 'over');
  assert.equal(actionsFor(m20, NOW).filter((a) => a.type === 'handoff').length, 1);
  const r = apply(m20, { type: 'handoff' }, NOW);
  assert.ok(r.ok);
  assert.equal(r.lead.owner, 'B');
  assert.equal(timer(r.lead, NOW).state, 'ok'); // 넘긴 시각부터 다시 60분
  assert.equal(apply(r.lead, { type: 'handoff' }, NOW).ok, false);
});

test('ac21 넘긴 뒤 다시 1시간 넘으면 미응대 · 넘기기 0번', () => {
  const g11 = byId(judged(), 'G11');
  assert.equal(timer(g11, NOW).state, 'missed');
  assert.equal(actionsFor(g11, NOW).filter((a) => a.type === 'handoff').length, 0);
  assert.equal(apply(g11, { type: 'handoff' }, NOW).ok, false);
});

test('ac22 템플릿은 보냄(모의) 기록 1줄, 첫 응대 시각 기록', () => {
  const r = apply(fresh(), { type: 'template', name: '첫 안내' }, NOW);
  assert.ok(r.ok);
  assert.equal(r.lead.log.length, 1);
  assert.match(r.lead.log[0].text, /^보냄\(모의\): 첫 안내$/);
  assert.equal(r.lead.firstResponseAt, NOW);
  assert.equal(timer(r.lead, NOW), null);
});

test('ac23 시간은 시연 기준 시각 1개로 셈', () => {
  assert.equal(seed.DEMO_NOW, Date.parse('2026-11-25T10:00:00+09:00'));
  const r = apply(fresh(), { type: 'advance' }, NOW);
  assert.equal(r.lead.log[0].at, NOW);
});

test('ac03 전화번호 가운데 4자리 가림', () => {
  assert.equal(maskPhone('010-0000-0001'), '010-****-0001');
  for (const l of judged()) assert.match(maskPhone(l.phone), /^010-\*\*\*\*-\d{4}$/);
});

test('ac31 생성 90일 넘으면 성 1글자만', () => {
  const l = fresh({ name: '김하나', createdAt: NOW - 91 * DAY });
  assert.equal(displayName(l, NOW), '김**');
  assert.equal(displayName(fresh({ createdAt: NOW - 89 * DAY }), NOW), '김하나');
});
