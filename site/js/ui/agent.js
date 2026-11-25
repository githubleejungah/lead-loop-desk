// 상담원 화면: 리드 목록 · 리드 카드 · 상담 메신저(모의) · 되돌리기 대기열(AC-03 · AC-08~32).
// 화면 함수는 HTML 문자열만 돌려준다(Node 시험용).
import { esc, kstTime, ago } from './html.js';
import { STAGES, END_LABELS, MAX_ABSENT, timer, maskPhone, displayName, statusLabel, actionsFor, isValid } from '../core/leads.js';

const MEDIA_NAME = { meta: 'Meta', google: 'Google', tiktok: 'TikTok' };

function timerBadge(l, now) {
  const tm = timer(l, now);
  if (!tm) return '';
  if (tm.state === 'ok') return `<span class="badge">남은 ${tm.remaining}분</span>`;
  if (tm.state === 'warn') return `<span class="badge warn">주의 · 남은 ${tm.remaining}분</span>`;
  if (tm.state === 'over') return '<span class="badge bad">초과</span>';
  return '<span class="badge bad">미응대</span>';
}

function statusChip(l) {
  const cls = l.end ? (isValid(l) ? 'chip end' : 'chip auto') : 'chip';
  const extra = !l.end && l.stage === 0 && l.absentCount > 0 ? ` · 부재 ${l.absentCount}` : '';
  return `<span class="${cls}">${esc(statusLabel(l))}${esc(extra)}</span>`;
}

function sortKey(l, now) {
  const tm = timer(l, now);
  const order = { over: 0, missed: 1, warn: 2, ok: 3 };
  if (tm) return [0, order[tm.state], -l.createdAt];
  if (!isValid(l)) return [2, 0, -l.createdAt];
  return [1, 0, -l.createdAt];
}

export function renderLeadList(leads, selectedId, now) {
  const sorted = [...leads].sort((a, b) => {
    const x = sortKey(a, now);
    const y = sortKey(b, now);
    for (let i = 0; i < x.length; i += 1) if (x[i] !== y[i]) return x[i] - y[i];
    return 0;
  });
  const items = sorted.map((l) => `
    <li><button type="button" class="lead-row${l.id === selectedId ? ' selected' : ''}" data-action="select" data-id="${esc(l.id)}" aria-pressed="${l.id === selectedId}">
      <span class="lr-id">${esc(l.id)}</span>
      <span class="lr-media">${esc(MEDIA_NAME[l.media])}</span>
      <span class="lr-name">${esc(displayName(l, now))}</span>
      <span class="lr-phone">${esc(maskPhone(l.phone))}</span>
      <span class="lr-status">${statusChip(l)} ${timerBadge(l, now)}</span>
    </button></li>`).join('');
  return `<ul class="lead-list" aria-label="리드 목록">${items}</ul>`;
}

function stepper(l) {
  return `<ol class="stepper" aria-label="진행 단계">${STAGES.map((s, i) => {
    const cls = i < l.stage ? 'done' : i === l.stage ? 'current' : '';
    return `<li class="${cls}">${esc(s)}</li>`;
  }).join('')}</ol>`;
}

export function renderLeadCard(l, now, templates, message) {
  if (!l) return '<div class="panel"><p class="hint">왼쪽 목록에서 리드를 고르세요.</p></div>';
  const acts = actionsFor(l, now);
  const actBtns = acts.map((a) => `<button type="button" class="btn${a.type === 'advance' ? ' primary' : ''}" data-action="lead-act" data-type="${esc(a.type)}" data-kind="${esc(a.kind ?? '')}">${esc(a.label)}</button>`).join('');
  const tm = timer(l, now);
  const handoffHint = tm && tm.state === 'over' ? '<p class="note bad-text">첫 응대 기준 1시간을 넘었습니다. 다른 담당자에게 1번 넘길 수 있습니다.</p>' : '';
  const missedHint = tm && tm.state === 'missed' ? '<p class="note bad-text">넘긴 뒤에도 1시간 안에 응대하지 못해 \'미응대\'로 남습니다. 넘기기는 더 없습니다. 지금이라도 응대할 수 있습니다.</p>' : '';
  const autoEnd = !isValid(l) ? `<p class="note">자동 판정: ${esc(END_LABELS[l.end])}. ${l.end === 'invalid' ? '과금 · 되돌리기에서 뺍니다.' : '7일 안에 같은 번호가 먼저 들어와 유효 리드에서 뺍니다.'}</p>` : '';
  const nextCall = l.nextCallAt && !l.end ? `<p class="note">다음 재연락: <strong>${esc(kstTime(l.nextCallAt))}</strong> (부재 ${l.absentCount}/${MAX_ABSENT}, ${MAX_ABSENT}번째 부재면 부재 종료)</p>` : '';
  const tplBtns = isValid(l)
    ? `<div class="tpl" role="group" aria-label="템플릿 메시지">${templates.map((t) => `<button type="button" class="btn ghost" data-action="template" data-tpl="${esc(t.id)}" title="${esc(t.text)}">${esc(t.name)}</button>`).join('')}</div><p class="hint">메시지는 기록만 남깁니다(실제 발송 없음).</p>`
    : '';
  const canCorrect = isValid(l) && !l.corrected && (l.end || l.stage > 0);
  const correct = canCorrect
    ? `<form class="correct" data-form="correct"><label for="correct-reason">정정 사유(1~100자, 리드마다 1번)</label><div class="row"><input id="correct-reason" name="reason" maxlength="100" autocomplete="off"><button type="submit" class="btn">정정</button></div></form>`
    : (l.corrected ? '<p class="hint">이 리드는 이미 정정했습니다.</p>' : '');
  const log = l.log.length
    ? `<ol class="log">${l.log.map((e) => `<li><time>${esc(kstTime(e.at))}</time> ${esc(e.text)}</li>`).join('')}</ol>`
    : '<p class="hint">이번 시연에서 남긴 기록이 없습니다.</p>';
  const msg = message ? `<p class="msg ${message.ok ? 'ok-text' : 'bad-text'}" role="status">${esc(message.text)}</p>` : '';
  return `<div class="panel lead-card">
    <div class="lc-head">
      <h3>${esc(displayName(l, now))} <span class="tag">${esc(MEDIA_NAME[l.media])}</span></h3>
      <p class="hint">${esc(l.id)} · ${esc(maskPhone(l.phone))} · ${esc(ago(l.createdAt, now))} 신청 · 담당 ${esc(l.owner)} · 선택 동의 ${l.consent ? '있음' : '없음'}</p>
      <p>${statusChip(l)} ${timerBadge(l, now)}</p>
    </div>
    ${isValid(l) ? stepper(l) : ''}
    ${autoEnd}${handoffHint}${missedHint}${nextCall}
    ${msg}
    <div class="acts">${actBtns || (isValid(l) ? '<p class="hint">끝 상태라 진행 버튼이 없습니다.</p>' : '')}</div>
    ${tplBtns}
    ${correct}
    <h4>기록</h4>
    ${log}
  </div>`;
}

export function renderQueue(groups) {
  const blocks = groups.map((g) => {
    const rows = g.items.map((it) => {
      let state;
      if (it.sent) state = '<span class="chip">보냄(모의)</span>';
      else if (!it.ok) state = `<span class="chip auto">빠짐: ${esc(it.reason)}</span>`;
      else if (!g.condition.ok) state = '<span class="chip end">리포트용</span>';
      else state = '<span class="chip ok">보낼 수 있음</span>';
      return `<li><span class="lr-id">${esc(it.id)}</span> ${state} <code class="hash" data-hash-id="${esc(it.id)}" data-hash-media="${esc(g.media)}">해시 계산 중…</code></li>`;
    }).join('');
    const sendable = g.items.filter((i) => i.sendable).length;
    const btn = g.condition.ok && sendable > 0
      ? `<button type="button" class="btn primary" data-action="send" data-media="${esc(g.media)}">${esc(g.name)}로 ${sendable}건 보내기(모의)</button>`
      : '';
    return `<div class="q-block">
      <h4>${esc(g.name)}</h4>
      <p class="${g.condition.ok ? 'hint' : 'note'}">${esc(g.condition.text)}</p>
      ${rows ? `<ul class="q-list">${rows}</ul>` : '<p class="hint">내원 · 계약 리드가 없습니다.</p>'}
      ${btn}
    </div>`;
  }).join('');
  return `<section class="panel" aria-labelledby="q-title">
    <h3 id="q-title">매체 되돌리기 대기열</h3>
    <p class="hint">내원 · 계약 리드만 오릅니다. 번호는 해시(되돌릴 수 없게 바꾼 값) 앞 12자만 보입니다. '보내기'는 기록만 남기고 외부로 보내지 않습니다.</p>
    <div class="q-grid">${blocks}</div>
  </section>`;
}

export function renderAgent({ leads, selectedId, now, templates, queueGroups, message, advertiser }) {
  const sel = leads.find((l) => l.id === selectedId) ?? null;
  return `<section>
    <h2>상담원 화면 <span class="tag">${esc(advertiser.name)}</span></h2>
    <p class="lead">광고로 들어온 상담 신청을 결번 · 중복 판정 → 첫 응대 → 예약 · 내원 · 계약까지 한 장의 리드 카드로 다룹니다.</p>
    <p class="hint">시연 기준 시각 ${esc(kstTime(now))}(고정) · 첫 응대 기준 1시간 · 생성 90일 뒤 이름을 가립니다.</p>
    <div class="agent-grid">
      <div>${renderLeadList(leads, selectedId, now)}</div>
      <div>${renderLeadCard(sel, now, templates, message)}</div>
    </div>
    ${renderQueue(queueGroups)}
  </section>`;
}
