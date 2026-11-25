// 리드 규칙(순수 함수): 판정 · 상태 · 정정 · 부재 · 타이머 · 넘기기 · 가림.
// 근거: docs/requirements.md A3 · AC-08~23 · AC-31, docs/flows.md F1~F3.

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const KST = 9 * 60 * MIN;

export const STAGES = ['새 리드', '연결', '예약', '내원', '계약'];
export const END_LABELS = {
  absent_closed: '부재 종료',
  not_self: '본인 아님',
  declined: '상담 거절',
  invalid: '결번',
  duplicate: '중복',
};
export const AUTO_ENDS = ['invalid', 'duplicate'];
export const PERSON_ENDS = ['absent_closed', 'not_self', 'declined'];
export const FIRST_RESPONSE_MIN = 60; // AS-08
export const WARN_MIN = 30; // AS-11
export const DUP_DAYS = 7; // D5
export const MAX_ABSENT = 4; // A3: 첫 통화 + 재연락 3번
export const MASK_AFTER_DAYS = 90; // D5
export const REASON_MAX = 100;

// 시작 판정: 결번 목록 → 결번, 7일 안 같은 번호가 먼저 있으면 → 중복(AC-13 · AC-14)
export function judge(list, invalidNumbers) {
  const bad = new Set(invalidNumbers);
  const sorted = [...list].sort((a, b) => a.createdAt - b.createdAt);
  const firstSeen = new Map(); // 번호 → 유효로 남은 가장 최근 리드 생성 시각
  const out = new Map();
  for (const lead of sorted) {
    const l = { ...lead, log: [...lead.log] };
    if (bad.has(l.phone)) {
      l.end = 'invalid';
      l.stage = 0;
    } else {
      const prev = firstSeen.get(l.phone);
      if (prev != null && l.createdAt - prev <= DUP_DAYS * DAY) {
        l.end = 'duplicate';
        l.stage = 0;
      } else {
        firstSeen.set(l.phone, l.createdAt);
      }
    }
    out.set(l.id, l);
  }
  return list.map((x) => out.get(x.id));
}

export const isValid = (l) => !AUTO_ENDS.includes(l.end);
export const statusLabel = (l) => (l.end ? END_LABELS[l.end] : STAGES[l.stage]);

function kstDayStart(t) {
  return Math.floor((t + KST) / DAY) * DAY - KST;
}

// 부재 n번째 뒤 다음 재연락 시각(AS-10): 1 → +2시간, 2 → 다음 날 10:00, 3 → 3일 뒤 10:00
export function nextCallTime(absentCount, now) {
  if (absentCount === 1) return now + 2 * 60 * MIN;
  if (absentCount === 2) return kstDayStart(now) + DAY + 10 * 60 * MIN;
  if (absentCount === 3) return kstDayStart(now) + 3 * DAY + 10 * 60 * MIN;
  return null;
}

// 첫 응대 타이머(AC-18~21). 응대했거나 끝 상태면 null.
export function timer(l, now) {
  if (l.firstResponseAt != null || l.end) return null;
  const base = l.handedOffAt ?? l.createdAt;
  const elapsed = Math.floor((now - base) / MIN);
  const remaining = FIRST_RESPONSE_MIN - elapsed;
  if (remaining > WARN_MIN) return { state: 'ok', remaining };
  if (remaining > 0) return { state: 'warn', remaining };
  if (l.handedOffAt != null) return { state: 'missed', remaining: 0 };
  return { state: 'over', remaining: 0 };
}

const reject = (reason) => ({ ok: false, reason });

function done(l, now, text, { respond = true } = {}) {
  const next = { ...l, log: [...l.log, { at: now, text }] };
  if (respond && next.firstResponseAt == null) next.firstResponseAt = now;
  return { ok: true, lead: next };
}

// 상담원 행동 하나를 적용한다. 규칙에 맞지 않으면 { ok: false, reason }.
export function apply(l, action, now) {
  const t = action.type;
  if (t === 'set-stage') {
    const target = action.stage;
    if (l.end) return reject('끝 상태라 진행할 수 없습니다.');
    if (!Number.isInteger(target) || target < 0 || target >= STAGES.length) return reject('없는 단계입니다.');
    if (target <= l.stage) return reject('앞선 단계로는 바꿀 수 없습니다. 잘못 눌렀으면 \'정정\'을 쓰세요(리드마다 1번).');
    if (target !== l.stage + 1) return reject('한 번에 바로 다음 단계 1개로만 바꿀 수 있습니다.');
    return done({ ...l, stage: target, nextCallAt: null }, now, `상태: ${STAGES[l.stage]} → ${STAGES[target]}`);
  }
  if (t === 'advance') return apply(l, { type: 'set-stage', stage: l.stage + 1 }, now);

  if (t === 'absent') {
    if (l.end) return reject('끝 상태라 부재를 표시할 수 없습니다.');
    if (l.stage !== 0) return reject('부재는 연결 전(새 리드)에서만 표시합니다.');
    const n = l.absentCount + 1;
    if (n >= MAX_ABSENT) {
      return done({ ...l, absentCount: n, end: 'absent_closed', nextCallAt: null }, now, `부재 ${n}번째 → 부재 종료`);
    }
    return done({ ...l, absentCount: n, nextCallAt: nextCallTime(n, now) }, now, `부재 ${n}번째 → 재연락 예정`);
  }

  if (t === 'end') {
    if (l.end) return reject('이미 끝 상태입니다.');
    if (action.kind === 'not_self') {
      if (l.stage !== 0) return reject('본인 아님은 연결 전에만 표시합니다.');
    } else if (action.kind === 'declined') {
      if (l.stage < 1) return reject('상담 거절은 연결 뒤에만 표시합니다.');
    } else {
      return reject('사람이 표시할 수 있는 끝 상태가 아닙니다.');
    }
    return done({ ...l, end: action.kind, nextCallAt: null }, now, `끝 상태: ${END_LABELS[action.kind]}`);
  }

  if (t === 'template') {
    if (AUTO_ENDS.includes(l.end)) return reject('결번 · 중복 리드에는 보내지 않습니다.');
    const name = action.name ?? '메시지';
    return done(l, now, `보냄(모의): ${name}`);
  }

  if (t === 'correct') {
    const reason = String(action.reason ?? '').trim();
    if (l.corrected) return reject('정정은 리드마다 1번만 할 수 있습니다.');
    if (AUTO_ENDS.includes(l.end)) return reject('결번 · 중복 판정은 정정하지 않습니다.');
    if (reason.length < 1 || reason.length > REASON_MAX) return reject(`정정 사유를 1~${REASON_MAX}자로 넣어 주세요.`);
    if (l.end) {
      const back = { ...l, end: null, corrected: true };
      if (l.end === 'absent_closed') {
        back.absentCount = MAX_ABSENT - 1;
        back.nextCallAt = nextCallTime(MAX_ABSENT - 1, now);
      }
      return done(back, now, `정정: ${END_LABELS[l.end]} 지움 — 사유: ${reason}`, { respond: false });
    }
    if (l.stage === 0) return reject('되돌릴 단계가 없습니다.');
    return done({ ...l, stage: l.stage - 1, corrected: true }, now, `정정: ${STAGES[l.stage]} → ${STAGES[l.stage - 1]} — 사유: ${reason}`, { respond: false });
  }

  if (t === 'handoff') {
    const tm = timer(l, now);
    if (!tm || tm.state !== 'over') return reject('넘기기는 첫 응대 기준을 넘긴 리드에서 1번만 할 수 있습니다.');
    const to = l.owner === 'A' ? 'B' : 'A';
    return done({ ...l, owner: to, handedOffAt: now }, now, `담당 ${l.owner} → ${to} 넘김`, { respond: false });
  }

  if (t === 'sent') {
    if (l.sentAt != null) return reject('이미 보냈습니다.');
    return done({ ...l, sentAt: now }, now, `되돌리기 보냄(모의): ${action.media ?? ''}`.trim(), { respond: false });
  }

  return reject('알 수 없는 행동입니다.');
}

// 가림(AC-03 · AC-31)
export function maskPhone(phone) {
  const m = /^(\d{3})-(\d{3,4})-(\d{4})$/.exec(phone);
  return m ? `${m[1]}-****-${m[3]}` : '***';
}

export function displayName(l, now) {
  if (now - l.createdAt > MASK_AFTER_DAYS * DAY) {
    const chars = [...l.name];
    return chars[0] + '*'.repeat(Math.max(chars.length - 1, 1));
  }
  return l.name;
}

// 다음 단계에서 상담원이 누를 수 있는 버튼 목록(AC-12: 끝 상태면 진행 버튼 0개)
export function actionsFor(l, now) {
  if (AUTO_ENDS.includes(l.end)) return [];
  const out = [];
  if (!l.end) {
    if (l.stage < STAGES.length - 1) out.push({ type: 'advance', label: `다음 단계: ${STAGES[l.stage + 1]}` });
    if (l.stage === 0) out.push({ type: 'absent', label: `부재 (${l.absentCount}/${MAX_ABSENT})` });
    if (l.stage === 0) out.push({ type: 'end', kind: 'not_self', label: '본인 아님' });
    if (l.stage >= 1) out.push({ type: 'end', kind: 'declined', label: '상담 거절' });
    const tm = timer(l, now);
    if (tm && tm.state === 'over') out.push({ type: 'handoff', label: `담당 ${l.owner === 'A' ? 'B' : 'A'}에게 넘기기` });
  }
  return out;
}
