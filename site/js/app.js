// 역할 전환 · 처음 그리기 · 바뀜 → 두 화면 다시 그리기(docs/architecture.md 3절).
import * as seed from './data/seed.js';
import { createStore } from './store.js';
import { queue, hashPhone, shortHash } from './core/sendback.js';
import { byMedia, responseBuckets } from './core/report.js';
import { annual, validate } from './core/revenue.js';
import { renderAgent } from './ui/agent.js';
import { renderAdvertiser } from './ui/advertiser.js';

const store = createStore(() => window.localStorage);
store.loadKnobs();

let role = 'agent';
let selectedId = seed.CASE1_LEAD_ID;
let message = null;
const calcUi = { drafts: {}, errors: {} };
const hashes = new Map(); // 'media:id' → 64자 해시

const $agent = document.getElementById('view-agent');
const $adv = document.getElementById('view-advertiser');

function queueGroups() {
  return queue(store.leads(), seed.media, seed.mediaRules, store.now);
}

async function fillHashes() {
  for (const el of document.querySelectorAll('[data-hash-id]')) {
    const key = `${el.dataset.hashMedia}:${el.dataset.hashId}`;
    if (!hashes.has(key)) {
      const lead = store.lead(el.dataset.hashId);
      if (!lead) continue;
      hashes.set(key, await hashPhone(lead.phone, el.dataset.hashMedia));
    }
    el.textContent = shortHash(hashes.get(key));
    el.title = 'SHA-256 해시 앞 12자(원래 번호는 보이지 않음)';
  }
}

function render() {
  const t0 = performance.now();
  const leads = store.leads();
  $agent.innerHTML = renderAgent({
    leads, selectedId, now: store.now, templates: seed.templates, queueGroups: queueGroups(), message, advertiser: seed.advertiser,
  });
  const knobs = store.knobs();
  $adv.innerHTML = renderAdvertiser({
    rep: byMedia(leads, seed.media),
    buckets: responseBuckets(leads, store.now),
    calc: { knobs, knobKeys: seed.knobKeys, knobMeta: seed.knobMeta, ...calcUi, result: annual(knobs), saveFailed: store.saveFailed },
    advertiser: seed.advertiser,
  });
  $agent.hidden = role !== 'agent';
  $adv.hidden = role !== 'advertiser';
  for (const b of document.querySelectorAll('[data-role]')) b.setAttribute('aria-pressed', String(b.dataset.role === role));
  window.__lastRenderMs = performance.now() - t0; // AC-41 확인용
  fillHashes();
}

store.subscribe(render);

function leadAct(action) {
  const r = store.act(selectedId, action);
  message = r.ok ? { ok: true, text: r.lead.log.at(-1).text } : { ok: false, text: r.reason };
  render(); // 성공이면 store 알림으로 한 번 그린 뒤, 결과 안내 줄을 넣어 다시 그림
}

function commitKnob(input) {
  const name = input.dataset.knob;
  const r = validate(name, input.value);
  if (!r.ok) {
    calcUi.errors[name] = r.reason; // 바로 전 값 유지(AC-47 · AC-48)
    delete calcUi.drafts[name];
    render();
    return;
  }
  calcUi.errors = {};
  delete calcUi.drafts[name];
  const k = store.knobs();
  if (r.value === k[name]) { render(); return; }
  store.setKnobs({ ...k, [name]: r.value });
}

document.addEventListener('click', (e) => {
  const roleBtn = e.target.closest('[data-role]');
  if (roleBtn) { role = roleBtn.dataset.role; render(); return; }
  const btn = e.target.closest('[data-action]');
  if (!btn || btn.disabled) return;
  const a = btn.dataset.action;
  if (a === 'select') { selectedId = btn.dataset.id; message = null; render(); return; }
  if (a === 'lead-act') {
    const action = { type: btn.dataset.type };
    if (btn.dataset.kind) action.kind = btn.dataset.kind;
    leadAct(action);
    return;
  }
  if (a === 'template') {
    const t = seed.templates.find((x) => x.id === btn.dataset.tpl);
    leadAct({ type: 'template', name: t ? t.name : '메시지' });
    return;
  }
  if (a === 'send') {
    const g = queueGroups().find((x) => x.media === btn.dataset.media);
    if (!g || !g.condition.ok) return;
    const ids = g.items.filter((i) => i.sendable).map((i) => i.id);
    for (const id of ids) store.act(id, { type: 'sent', media: g.name });
    message = { ok: true, text: `${g.name}로 ${ids.length}건 보냄(모의) — 외부 전송 없음` };
    render();
    return;
  }
  if (a === 'reset-knobs') { calcUi.errors = {}; calcUi.drafts = {}; store.resetKnobs(); }
});

document.addEventListener('submit', (e) => {
  if (e.target.matches('[data-form="correct"]')) {
    e.preventDefault();
    const reason = new FormData(e.target).get('reason');
    leadAct({ type: 'correct', reason });
  }
});

document.addEventListener('change', (e) => {
  if (e.target.matches('[data-knob]')) commitKnob(e.target);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.matches('[data-knob]')) e.target.blur();
});

render();
