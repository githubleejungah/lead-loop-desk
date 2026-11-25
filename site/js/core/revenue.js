// 요금 3단 연 매출 계산 · 입력 검사(순수 함수). 근거: docs/requirements.md A5 · AC-44~49, docs/data-model.md 2-3 · 3절.
import { knobKeys, knobMeta } from '../data/seed.js';

// 연 매출 4줄 + 합계(원 단위 정수)
export function annual(k) {
  const solo = k.soloFee * k.soloCount * 12;
  const conv = Math.round((k.soloCount * k.convPct * k.adSpend * k.feePct * 12) / 10000);
  const keep = Math.round((k.agencyCount * k.adSpend * k.feePct * k.extraMonths) / 100);
  const link = k.linkFee * k.linkCount * 12;
  return {
    lines: [
      { key: 'solo', label: '① 단독 구독', formula: '단독 고객 수 × 단독 월 요금 × 12', value: solo },
      { key: 'conv', label: '② 단독 → 대행 전환', formula: '단독 고객 수 × 전환율 × 월 광고비 × 수수료율 × 12', value: conv },
      { key: 'keep', label: '③ 대행 고객 유지', formula: '대행 고객 수 × 월 광고비 × 수수료율 × 늘어난 유지 개월', value: keep },
      { key: 'link', label: '④ 매체 연동 추가', formula: '연동 고객 수 × 연동 월 요금 × 12', value: link },
    ],
    total: solo + conv + keep + link,
  };
}

// 입력 글자 하나를 검사한다(AC-47 · AC-48). 정수 · 허용 범위만 받는다. 쉼표는 허용.
export function validate(name, text) {
  const meta = knobMeta[name];
  if (!meta) return { ok: false, reason: '없는 칸입니다.' };
  const range = `허용 범위 ${meta.min.toLocaleString('ko-KR')}~${meta.max.toLocaleString('ko-KR')}${meta.unit}`;
  const s = String(text ?? '').replace(/,/g, '').trim();
  if (s === '') return { ok: false, reason: `빈칸은 받지 않습니다. ${range}` };
  if (!/^\d+$/.test(s)) return { ok: false, reason: `숫자(정수)만 받습니다. ${range}` };
  const v = Number(s);
  if (!Number.isSafeInteger(v) || v < meta.min || v > meta.max) return { ok: false, reason: `범위 밖입니다. ${range}` };
  return { ok: true, value: v };
}

export function isValidKnobs(obj) {
  if (!obj || typeof obj !== 'object') return false;
  return knobKeys.every((k) => {
    const v = obj[k];
    const m = knobMeta[k];
    return Number.isSafeInteger(v) && v >= m.min && v <= m.max;
  });
}
