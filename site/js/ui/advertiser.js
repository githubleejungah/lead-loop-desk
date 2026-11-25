// 광고주 화면: 깔때기 · 단가 · 응답 시간 구간 · 요금 계산기(AC-02 · AC-33~50).
// 리드 이름 · 번호는 받지 않는다. 집계만 받는다(AC-02).
import { esc, won, num } from './html.js';

const FUNNEL_COLS = [
  ['spend', '광고비', won],
  ['leads', '리드', num],
  ['valid', '유효 리드', num],
  ['connected', '연결', num],
  ['booked', '예약', num],
  ['visited', '내원', num],
  ['contracted', '계약', num],
];
const COST_COLS = [
  ['cpa', 'CPA(신청 1건당)'],
  ['perValid', '유효 리드 단가'],
  ['perVisit', '내원 단가'],
];

// 한국어 주격 조사: 메타 → 가, 구글 · 틱톡 → 이
const subj = (id) => (id === 'meta' ? '가' : '이');

function cheapest(rows, key) {
  const vals = rows.filter((r) => r.costs[key] != null);
  if (!vals.length) return null;
  return vals.reduce((a, b) => (b.costs[key] < a.costs[key] ? b : a));
}

export function renderFunnel(rep) {
  const all = [...rep.rows, rep.total];
  const head = `<tr><th scope="col">매체</th>${FUNNEL_COLS.map(([, l]) => `<th scope="col">${esc(l)}</th>`).join('')}</tr>`;
  const body = all.map((r) => `<tr class="${r.id === 'total' ? 'total' : ''}"><th scope="row">${esc(r.name)}</th>${FUNNEL_COLS.map(([k, l, f]) => `<td data-label="${esc(l)}" data-cell="funnel-${esc(r.id)}-${k}">${esc(f(r.funnel[k]))}</td>`).join('')}</tr>`).join('');
  return `<table class="t stack"><caption>깔때기(최근 31일)</caption><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

export function renderCosts(rep) {
  const all = [...rep.rows, rep.total];
  const best = Object.fromEntries(COST_COLS.map(([k]) => [k, cheapest(rep.rows, k)?.id]));
  const head = `<tr><th scope="col">매체</th>${COST_COLS.map(([, l]) => `<th scope="col">${esc(l)}</th>`).join('')}</tr>`;
  const body = all.map((r) => `<tr class="${r.id === 'total' ? 'total' : ''}"><th scope="row">${esc(r.name)}</th>${COST_COLS.map(([k, l]) => {
    const mark = r.id !== 'total' && best[k] === r.id ? ' best' : '';
    return `<td class="${mark.trim()}" data-label="${esc(l)}" data-cell="cost-${esc(r.id)}-${k}">${esc(won(r.costs[k]))}${mark ? ' <span class="tag">가장 쌈</span>' : ''}</td>`;
  }).join('')}</tr>`).join('');
  const c = cheapest(rep.rows, 'cpa');
  const v = cheapest(rep.rows, 'perVisit');
  const insight = c && v && c.id !== v.id
    ? `<p class="insight">신청 1건당은 <strong>${esc(c.name)}</strong>${subj(c.id)} 가장 싸지만, 내원 1명당은 <strong>${esc(v.name)}</strong>${subj(v.id)} 가장 쌉니다. 예산은 내원 단가로 나눠 보세요.</p>`
    : '';
  return `<table class="t stack"><caption>매체별 단가(광고비 ÷ 건수, 원 단위 반올림)</caption><thead>${head}</thead><tbody>${body}</tbody></table>${insight}`;
}

export function renderBuckets(b) {
  const body = b.rows.map((r) => `<tr><th scope="row">${esc(r.label)}</th><td data-label="리드">${esc(num(r.count))}</td><td data-label="내원 이상">${esc(num(r.visited))}</td><td data-label="내원율" data-cell="rate-${esc(r.key)}">${r.rate == null ? '—' : `${r.rate}%`}</td></tr>`).join('');
  return `<table class="t stack"><caption>첫 응대 시간별 내원율(유효 리드)</caption><thead><tr><th scope="col">구간</th><th scope="col">리드</th><th scope="col">내원 이상</th><th scope="col">내원율</th></tr></thead><tbody>${body}</tbody></table>
  <p class="hint">아직 기준 1시간 안이라 응대 대기 중인 리드 ${b.pending}건은 구간에서 뺐습니다.</p>`;
}

export function renderCalculator({ knobs, knobKeys, knobMeta, drafts, errors, result, saveFailed }) {
  const fields = knobKeys.map((k) => {
    const m = knobMeta[k];
    const val = drafts[k] ?? String(knobs[k]);
    const err = errors[k] ? `<span class="err" id="err-${esc(k)}" role="alert">${esc(errors[k])}</span>` : '';
    return `<div class="field"><label for="knob-${esc(k)}">${esc(m.label)} <span class="unit">(${esc(m.unit)})</span></label>
      <input id="knob-${esc(k)}" data-knob="${esc(k)}" inputmode="numeric" value="${esc(val)}"${errors[k] ? ` aria-invalid="true" aria-describedby="err-${esc(k)}"` : ''}>${err}</div>`;
  }).join('');
  const lines = result.lines.map((l) => `<tr><th scope="row">${esc(l.label)}<br><span class="hint">${esc(l.formula)}</span></th><td data-cell="rev-${esc(l.key)}">${esc(won(l.value))}</td></tr>`).join('');
  return `<section class="panel calc" aria-labelledby="calc-title">
    <h3 id="calc-title">대행사용 · 요금 3단 매출 계산기</h3>
    <table class="t tiers"><caption>요금 3단</caption><thead><tr><th scope="col">단</th><th scope="col">대상</th><th scope="col">월 요금</th></tr></thead><tbody>
      <tr><th scope="row">대행 포함</th><td>월 광고비 일정 금액 이상 대행 고객</td><td>무료</td></tr>
      <tr><th scope="row">단독</th><td>대행 없이 리드 CRM만</td><td>${esc(won(knobs.soloFee))}</td></tr>
      <tr><th scope="row">연동 추가</th><td>매체 되돌리기 · 상담 메신저</td><td>+${esc(won(knobs.linkFee))}</td></tr>
    </tbody></table>
    <div class="fields">${fields}</div>
    <div class="row"><button type="button" class="btn" data-action="reset-knobs">기본값으로 되돌리기</button></div>
    <table class="t revenue"><caption>연 매출(추가분)</caption><tbody>${lines}<tr class="total"><th scope="row">합계</th><td data-cell="rev-total">${esc(won(result.total))}</td></tr></tbody></table>
    <p class="note" data-assume-note>모든 값은 가정입니다. 수수료율 15%는 이 회사 값이 아닙니다.</p>
    ${saveFailed ? '<p class="note" data-save-note>브라우저 저장을 쓸 수 없어 기본값으로 동작합니다. 바꾼 값은 새로고침하면 사라집니다.</p>' : ''}
  </section>`;
}

export function renderAdvertiser({ rep, buckets, calc, advertiser }) {
  return `<section>
    <h2>광고주 리포트 <span class="tag">${esc(advertiser.name)}</span></h2>
    <p class="lead">신청 1건당 광고비(CPA)만이 아니라, 진짜 손님이 된 내원 1명당 광고비를 봅니다. 상담원이 상태를 바꾸면 같은 규칙으로 바로 다시 셉니다.</p>
    <div class="panel">${renderFunnel(rep)}</div>
    <div class="panel">${renderCosts(rep)}</div>
    <div class="panel">${renderBuckets(buckets)}
      <p class="note" data-media-note>매체 발표: 상담 결과를 CRM에서 매체로 되돌리면 양질 리드 단가 15% 하락(매체 발표 평균, 결과는 다를 수 있음).</p>
    </div>
    ${renderCalculator(calc)}
  </section>`;
}
