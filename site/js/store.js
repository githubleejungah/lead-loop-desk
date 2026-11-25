// 리드 상태(메모리)와 계산기 손잡이 9개(저장)를 들고 있다(ADR 0002, docs/data-model.md 1절).
import * as seed from './data/seed.js';
import { judge, apply } from './core/leads.js';
import { isValidKnobs } from './core/revenue.js';

export const STORAGE_KEY = 'lld:v1:knobs';

function pick(obj) {
  const out = {};
  for (const k of seed.knobKeys) out[k] = obj[k];
  return out;
}

// storageGetter: localStorage를 돌려주는 함수. 접근만 해도 예외가 날 수 있어 함수로 받는다.
export function createStore(storageGetter, now = seed.DEMO_NOW) {
  let leads = judge(seed.leads, seed.invalidNumbers);
  let knobs = { ...seed.defaultKnobs };
  let saveFailed = false;
  const listeners = new Set();
  const notify = () => { for (const fn of listeners) fn(); };

  function storage() {
    try {
      const s = storageGetter();
      if (!s) throw new Error('no storage');
      return s;
    } catch {
      saveFailed = true;
      return null;
    }
  }

  function loadKnobs() {
    const s = storage();
    if (!s) return knobs;
    let raw = null;
    try {
      raw = s.getItem(STORAGE_KEY);
    } catch {
      saveFailed = true;
      return knobs;
    }
    if (raw) {
      try {
        const obj = JSON.parse(raw);
        if (obj && obj.v === 1 && isValidKnobs(obj)) knobs = pick(obj);
      } catch {
        // 깨진 값은 버리고 기본값
      }
    }
    return knobs;
  }

  function persist() {
    const s = storage();
    if (!s) return;
    try {
      s.setItem(STORAGE_KEY, JSON.stringify({ v: 1, ...knobs }));
      saveFailed = false;
    } catch {
      saveFailed = true;
    }
  }

  function setKnobs(next) {
    if (!isValidKnobs(next)) throw new Error('invalid knobs');
    knobs = pick(next);
    persist();
    notify();
  }

  // 상담원 행동 1개. 규칙 판단은 core/leads.js가 한다.
  function act(id, action) {
    const i = leads.findIndex((l) => l.id === id);
    if (i < 0) return { ok: false, reason: '없는 리드입니다.' };
    const r = apply(leads[i], action, now);
    if (!r.ok) return r;
    leads = leads.map((l, j) => (j === i ? r.lead : l));
    notify();
    return r;
  }

  return {
    now,
    loadKnobs,
    leads: () => leads,
    lead: (id) => leads.find((l) => l.id === id) ?? null,
    act,
    knobs: () => ({ ...knobs }),
    setKnobs,
    resetKnobs: () => setKnobs({ ...seed.defaultKnobs }),
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    get saveFailed() { return saveFailed; },
  };
}
