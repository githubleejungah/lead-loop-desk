// 광고주 리포트 계산(순수 함수). 화면의 모든 리포트 숫자는 여기서 나온다(AC-42).
// 근거: docs/requirements.md A2 · AC-33~40, docs/data-model.md 3절.
import { isValid, timer } from './leads.js';

// 광고비 ÷ 건수, 원 단위 반올림. 0건이면 null('—', AC-39)
export function unitCost(spend, count) {
  if (!count) return null;
  return Math.round(spend / count);
}

export function funnel(leads, spend) {
  const valid = leads.filter(isValid);
  return {
    spend,
    leads: leads.length,
    valid: valid.length,
    connected: valid.filter((l) => l.stage >= 1).length,
    booked: valid.filter((l) => l.stage >= 2).length,
    visited: valid.filter((l) => l.stage >= 3).length,
    contracted: valid.filter((l) => l.stage >= 4).length,
  };
}

export function costs(f) {
  return {
    cpa: unitCost(f.spend, f.leads),
    perValid: unitCost(f.spend, f.valid),
    perVisit: unitCost(f.spend, f.visited),
  };
}

// 매체별 + 합계
export function byMedia(leads, mediaList) {
  const rows = mediaList.map((m) => {
    const f = funnel(leads.filter((l) => l.media === m.id), m.spend);
    return { id: m.id, name: m.name, funnel: f, costs: costs(f) };
  });
  const spend = mediaList.reduce((s, m) => s + m.spend, 0);
  const tf = funnel(leads, spend);
  return { rows, total: { id: 'total', name: '합계', funnel: tf, costs: costs(tf) } };
}

// 응답 시간 구간(AC-40): 1시간 안 · 1시간 넘음 · 미응대, 그리고 응대 대기
export function responseBuckets(leads, now) {
  const b = { within: [], late: [], missed: [], pending: [] };
  for (const l of leads.filter(isValid)) {
    if (l.firstResponseAt != null) {
      const base = l.handedOffAt != null && l.handedOffAt <= l.firstResponseAt ? l.handedOffAt : l.createdAt;
      const min = Math.floor((l.firstResponseAt - base) / 60000);
      (min <= 60 ? b.within : b.late).push(l);
      continue;
    }
    const tm = timer(l, now);
    if (tm && tm.state === 'missed') b.missed.push(l);
    else if (tm && tm.state === 'over') b.late.push(l);
    else b.pending.push(l);
  }
  const row = (key, label, arr) => {
    const visited = arr.filter((l) => l.stage >= 3).length;
    return { key, label, count: arr.length, visited, rate: arr.length ? Math.round((visited / arr.length) * 100) : null };
  };
  return {
    rows: [row('within', '1시간 안', b.within), row('late', '1시간 넘음', b.late), row('missed', '미응대', b.missed)],
    pending: b.pending.length,
  };
}
