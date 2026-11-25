// 매체 되돌리기 대기열(순수 함수 + 해시). 외부 전송은 하지 않는다(AC-30 · ADR 0001).
// 근거: docs/requirements.md A4 · AC-24~30, docs/flows.md F4, docs/data-model.md 3-1.
import { isValid } from './leads.js';

const DAY = 24 * 60 * 60 * 1000;

// 리드 하나가 그 매체 대기열에 들어가는지와 빠지는 이유(AC-24~27)
export function eligibility(l, rules, now) {
  if (!isValid(l) || l.stage < 3) return { listed: false };
  if (!l.consent) return { listed: true, ok: false, reason: '동의 없음' };
  if (rules.maxDaysFromLead != null && now - l.createdAt > rules.maxDaysFromLead * DAY) {
    return { listed: true, ok: false, reason: `리드 생성 뒤 ${rules.maxDaysFromLead}일 넘음` };
  }
  if (rules.maxDaysFromClick != null && l.clickAt != null && now - l.clickAt > rules.maxDaysFromClick * DAY) {
    return { listed: true, ok: false, reason: `클릭 뒤 ${rules.maxDaysFromClick}일 넘음` };
  }
  return { listed: true, ok: true };
}

// 매체 조건(AC-28). monthlyLeads = 리포트 기간 그 매체 리드 수
export function mediaCondition(rules, monthlyLeads) {
  if (!rules.sendable) return { ok: false, text: rules.note };
  if (rules.minMonthlyLeads && monthlyLeads < rules.minMonthlyLeads) {
    return { ok: false, text: `조건 미달 — 리포트용으로만 (월 리드 ${monthlyLeads}건 / 필요 ${rules.minMonthlyLeads}건)` };
  }
  return { ok: true, text: '보낼 수 있음(모의 기록)' };
}

// 매체별 대기열
export function queue(leads, mediaList, mediaRules, now) {
  return mediaList.map((m) => {
    const rules = mediaRules[m.id];
    const mine = leads.filter((l) => l.media === m.id);
    const condition = mediaCondition(rules, mine.length);
    const items = [];
    for (const l of mine) {
      const e = eligibility(l, rules, now);
      if (!e.listed) continue;
      const sent = l.sentAt != null;
      items.push({ id: l.id, ok: e.ok, reason: e.reason ?? null, sent, sendable: condition.ok && e.ok && !sent });
    }
    return { media: m.id, name: m.name, condition, items };
  });
}

// 번호 정규화(data-model 3-1): Google '+8210…', Meta '8210…'
export function normalizePhone(phone, mediaId) {
  const digits = String(phone).replace(/\D/g, '');
  const national = digits.startsWith('0') ? digits.slice(1) : digits;
  return mediaId === 'google' ? `+82${national}` : `82${national}`;
}

// SHA-256 소문자 16진수 64자(AC-29). 브라우저 · Node 20 모두 전역 crypto.subtle.
export async function hashPhone(phone, mediaId) {
  const data = new TextEncoder().encode(normalizePhone(phone, mediaId));
  const buf = await globalThis.crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const shortHash = (h) => `${h.slice(0, 12)}…`;
