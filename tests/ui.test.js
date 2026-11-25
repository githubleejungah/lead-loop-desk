// 화면 글자 시험: 그리기 함수의 HTML 문자열과 정적 파일을 검사한다(AC-01 · 02 · 04 · 06 · 12 · 32 · 34 · 43 · 48 · 50 · 52 · 53).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as seed from '../site/js/data/seed.js';
import { judge } from '../site/js/core/leads.js';
import { queue } from '../site/js/core/sendback.js';
import { byMedia, responseBuckets } from '../site/js/core/report.js';
import { annual } from '../site/js/core/revenue.js';
import { renderAgent, renderLeadCard } from '../site/js/ui/agent.js';
import { renderAdvertiser } from '../site/js/ui/advertiser.js';

const NOW = seed.DEMO_NOW;
const SITE = new URL('../site/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const read = (p) => readFileSync(join(SITE, p), 'utf8');
const leads = judge(seed.leads, seed.invalidNumbers);

function advHtml(extra = {}) {
  return renderAdvertiser({
    rep: byMedia(leads, seed.media),
    buckets: responseBuckets(leads, NOW),
    calc: { knobs: seed.defaultKnobs, knobKeys: seed.knobKeys, knobMeta: seed.knobMeta, drafts: {}, errors: {}, result: annual(seed.defaultKnobs), saveFailed: false, ...extra },
    advertiser: seed.advertiser,
  });
}
function agentHtml() {
  return renderAgent({ leads, selectedId: 'M01', now: NOW, templates: seed.templates, queueGroups: queue(leads, seed.media, seed.mediaRules, NOW), message: null, advertiser: seed.advertiser });
}
function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

test('ac01 역할 버튼 그룹 1개 · 버튼 2개(상담원 · 광고주), 로그인 칸 없음', () => {
  const html = read('index.html');
  assert.equal((html.match(/role="group" aria-label="화면 바꾸기"/g) || []).length, 1);
  assert.equal((html.match(/data-role="/g) || []).length, 2);
  assert.ok(!/type="password"/.test(html));
});

test('ac02 광고주 화면에 이름 · 전화번호 0개', () => {
  const html = advHtml();
  for (const l of leads) {
    assert.ok(!html.includes(l.name), l.name);
    assert.ok(!html.includes(l.phone), l.phone);
  }
  assert.ok(!/010-/.test(html));
});

test('ac04 가상 데이터 안내 1줄', () => {
  const html = read('index.html');
  assert.equal((html.match(/가상 데이터 시연입니다\. 실제 회사 · 고객 · 전화번호 · 가격이 아닙니다/g) || []).length, 1);
});

test('ac06 외부 요청 0건: fetch · XHR · 외부 주소 없음, CSP connect-src none', () => {
  const html = read('index.html');
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /default-src 'self'/);
  for (const f of walk(SITE)) {
    const s = readFileSync(f, 'utf8');
    assert.ok(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket/.test(s), f);
    assert.ok(!/(src|href)=["']https?:/.test(s), f);
  }
});

test('ac12 끝 상태 카드에는 진행 버튼 0개', () => {
  for (const id of ['M16', 'M02']) {
    const html = renderLeadCard(leads.find((l) => l.id === id), NOW, seed.templates, null);
    assert.ok(!html.includes('data-type="advance"'), id);
  }
  const live = renderLeadCard(leads.find((l) => l.id === 'M01'), NOW, seed.templates, null);
  assert.equal((live.match(/data-type="advance"/g) || []).length, 1);
});

test('ac32 보관 기간 안내 1줄', () => {
  assert.equal((agentHtml().match(/생성 90일 뒤 이름을 가립니다/g) || []).length, 1);
});

test('ac34 매체마다 단가 3개', () => {
  const html = advHtml();
  for (const m of ['meta', 'google', 'tiktok']) {
    for (const k of ['cpa', 'perValid', 'perVisit']) assert.ok(html.includes(`data-cell="cost-${m}-${k}"`), `${m}-${k}`);
  }
  assert.match(html, /신청 1건당은 <strong>Meta<\/strong>가 가장 싸지만, 내원 1명당은 <strong>Google<\/strong>이 가장 쌉니다/);
});

test('ac43 매체 발표 숫자 1줄과 단서', () => {
  assert.equal((advHtml().match(/매체 발표 평균, 결과는 다를 수 있음/g) || []).length, 1);
});

test('ac48 거절 이유 1줄이 칸 옆에', () => {
  const html = advHtml({ errors: { feePct: '범위 밖입니다. 허용 범위 0~100%' } });
  assert.equal((html.match(/class="err"/g) || []).length, 1);
  assert.match(html, /aria-invalid="true"/);
});

test('ac50 가정 안내 1줄', () => {
  assert.equal((advHtml().match(/모든 값은 가정입니다\. 수수료율 15%는 이 회사 값이 아닙니다/g) || []).length, 1);
});

test('ac52 색 토큰', () => {
  const css = read('css/style.css');
  assert.match(css, /--primary: #2563EB;/);
  assert.match(css, /--primary-dark: #1D4ED8;/);
  assert.match(css, /--primary-soft: #EDF4FF;/);
});

function lum(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

test('ac53 본문 글자 대비 4.5:1 이상', () => {
  const pairs = [
    ['#111827', '#FFFFFF'], ['#111827', '#F7F8FB'], ['#4B5563', '#FFFFFF'], ['#4B5563', '#F7F8FB'], ['#4B5563', '#EDF4FF'],
    ['#FFFFFF', '#2563EB'], ['#1D4ED8', '#EDF4FF'], ['#1D4ED8', '#FFFFFF'], ['#B42318', '#FDECEC'], ['#92400E', '#FEF3C7'],
    ['#0E7A5F', '#E6F6F0'], ['#111827', '#EDF4FF'], ['#4B5563', '#EEF0F3'],
  ];
  for (const [fg, bg] of pairs) assert.ok(ratio(fg, bg) >= 4.5, `${fg} on ${bg}: ${ratio(fg, bg).toFixed(2)}`);
});
