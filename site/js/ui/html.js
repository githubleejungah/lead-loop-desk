// 화면 글자 도우미. 모든 글자는 이스케이프한다.
const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(v) {
  return String(v).replace(/[&<>"']/g, (c) => MAP[c]);
}

export const won = (n) => (n == null ? '—' : `${n.toLocaleString('ko-KR')}원`);
export const num = (n) => (n == null ? '—' : n.toLocaleString('ko-KR'));

const KST = 9 * 60 * 60 * 1000;
export function kstTime(t) {
  const d = new Date(t + KST);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

export function ago(t, now) {
  const m = Math.floor((now - t) / 60000);
  if (m < 60) return `${m}분 전`;
  if (m < 24 * 60) return `${Math.floor(m / 60)}시간 전`;
  return `${Math.floor(m / (24 * 60))}일 전`;
}
