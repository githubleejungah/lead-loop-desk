// 고정 가상 데이터의 정본(docs/data-model.md 2-2 · 2-3, AS-09 · AS-14). 실제 회사 · 고객 · 번호가 아니다.
// 번호는 실제로 쓰이지 않는 010-0000- 앞자리만 쓴다.

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

// 시연 기준 시각: 2026-11-25 10:00 한국 시간(ADR 0004)
export const DEMO_NOW = Date.parse('2026-11-25T10:00:00+09:00');
export const REPORT_DAYS = 31;

export const advertiser = { name: '가상 치과', industry: '임플란트 치과' };

export const media = [
  { id: 'meta', name: 'Meta', spend: 2000000 },
  { id: 'google', name: 'Google', spend: 2000000 },
  { id: 'tiktok', name: 'TikTok', spend: 1000000 },
];

// 매체 되돌리기 조건(D3 · D4). TikTok은 요구에서 다루지 않아 조사 전으로 둔다(data-model 5절).
export const mediaRules = {
  meta: { sendable: true, minMonthlyLeads: 200, maxDaysFromLead: 28 },
  google: { sendable: true, minMonthlyLeads: 0, maxDaysFromClick: 90 },
  tiktok: { sendable: false, note: '연동 조건 조사 전 — 리포트용으로만' },
};

export const invalidNumbers = ['010-0000-0902', '010-0000-0903'];

export const templates = [
  { id: 'first', name: '첫 안내', text: '상담 신청 감사합니다. 담당 상담원이 곧 연락드립니다.' },
  { id: 'booking', name: '예약 확인', text: '방문 예약이 확인되었습니다. 일정 변경은 이 메시지에 답해 주세요.' },
  { id: 'absent', name: '부재 안내', text: '연락드렸으나 통화가 어려워 다시 연락드리겠습니다.' },
];

// 리드 한 줄: id, 매체, 이름, 번호 끝 4자리, 몇 분 전 생성, 나머지 칸
function L(id, mediaId, name, tail, agoMin, o = {}) {
  const createdAt = DEMO_NOW - agoMin * MIN;
  return {
    id,
    media: mediaId,
    name,
    phone: `010-0000-${tail}`,
    createdAt,
    clickAt: mediaId === 'google' ? createdAt : null,
    consent: o.consent ?? true,
    stage: o.stage ?? 0,
    end: o.end ?? null,
    absentCount: o.absent ?? 0,
    nextCallAt: o.nextCallAt ?? null,
    firstResponseAt: o.resp == null ? null : createdAt + o.resp * MIN,
    owner: o.owner ?? 'A',
    handedOffAt: o.handedAgo == null ? null : DEMO_NOW - o.handedAgo * MIN,
    corrected: false,
    sentAt: null,
    log: [],
  };
}

const d = (days) => days * 24 * 60; // 일 → 분

export const leads = [
  // Meta 20건: 결번 2 · 중복 2 · 유효 16 (연결 이상 9 · 예약 이상 4 · 내원 이상 2 · 계약 1)
  L('M01', 'meta', '김하나', '0001', 20),                                   // 시연 사례 1
  L('M02', 'meta', '이두리', '0902', d(3), { consent: false, resp: 15 }),    // 결번
  L('M03', 'meta', '박세나', '0903', d(9), { consent: false, resp: 20 }),    // 결번
  L('M04', 'meta', '최다온', '0010', d(5), { resp: 10 }),                    // M10과 같은 번호, 3일 차이 → 중복
  L('M05', 'meta', '정마루', '0011', d(2), { resp: 12 }),                    // M11과 같은 번호, 4일 차이 → 중복
  L('M06', 'meta', '강보람', '0006', d(10), { stage: 4, resp: 15 }),
  L('M07', 'meta', '조새봄', '0007', d(30), { stage: 3, resp: 90 }),         // 28일 넘음
  L('M08', 'meta', '윤가람', '0008', d(12), { stage: 2, resp: 20 }),
  L('M09', 'meta', '장한결', '0009', d(3), { stage: 2, resp: 10 }),
  L('M10', 'meta', '임나래', '0010', d(8), { stage: 1, resp: 120 }),
  L('M11', 'meta', '한누리', '0011', d(6), { stage: 1, consent: false, resp: 30 }),
  L('M12', 'meta', '오다솜', '0012', d(9), { stage: 1, resp: 25 }),
  L('M13', 'meta', '서하늘', '0013', d(14), { stage: 1, end: 'declined', resp: 40 }),
  L('M14', 'meta', '신바다', '0014', d(4), { stage: 1, resp: 5 }),
  L('M15', 'meta', '권별', '0015', d(7), { end: 'not_self', consent: false, resp: 12 }),
  L('M16', 'meta', '황솔', '0016', d(20), { end: 'absent_closed', absent: 4, resp: 70 }),
  L('M17', 'meta', '안이슬', '0017', d(1), { absent: 1, resp: 65, nextCallAt: DEMO_NOW + 60 * MIN }),
  L('M18', 'meta', '송빛나', '0018', d(2), { absent: 2, resp: 30, nextCallAt: DEMO_NOW + DAY }),
  L('M19', 'meta', '유초롱', '0019', d(1), { resp: 8 }),
  L('M20', 'meta', '홍단비', '0020', 75, { consent: false }),               // 초과 → 넘기기 제안

  // Google 12건: 유효 12 (연결 이상 10 · 예약 이상 5 · 내원 이상 4 · 계약 2)
  L('G01', 'google', '문가온', '0101', d(9), { stage: 4, resp: 10 }),
  L('G02', 'google', '양소리', '0102', d(15), { stage: 4, consent: false, resp: 20 }), // 동의 없음
  L('G03', 'google', '배은별', '0103', d(5), { stage: 3, resp: 18 }),
  L('G04', 'google', '백하람', '0104', d(11), { stage: 3, resp: 35 }),
  L('G05', 'google', '허라온', '0105', d(2), { stage: 2, resp: 15 }),
  L('G06', 'google', '남윤슬', '0106', d(6), { stage: 1, resp: 95 }),
  L('G07', 'google', '노아름', '0107', d(13), { stage: 1, resp: 22 }),
  L('G08', 'google', '하늘빛', '0108', d(17), { stage: 1, consent: false, resp: 45 }),
  L('G09', 'google', '곽지음', '0109', d(19), { stage: 1, end: 'declined', resp: 28 }),
  L('G10', 'google', '성다인', '0110', d(3), { stage: 1, resp: 14 }),
  L('G11', 'google', '차시온', '0111', 150, { owner: 'B', handedAgo: 70 }),  // 넘긴 뒤에도 응대 없음 → 미응대
  L('G12', 'google', '주예솔', '0112', d(22), { end: 'absent_closed', absent: 4, consent: false, resp: 80 }),

  // TikTok 8건: 중복 1 · 유효 7 (연결 이상 5 · 예약 이상 2 · 내원 이상 1 · 계약 1)
  L('T01', 'tiktok', '우채원', '0201', d(7), { stage: 4, resp: 12 }),
  L('T02', 'tiktok', '민서율', '0202', d(4), { stage: 2, consent: false, resp: 25 }),
  L('T03', 'tiktok', '진아린', '0203', d(4), { stage: 1, resp: 30 }),
  L('T04', 'tiktok', '엄도윤', '0204', d(10), { stage: 1, resp: 100 }),
  L('T05', 'tiktok', '채하윤', '0205', d(16), { stage: 1, resp: 50 }),
  L('T06', 'tiktok', '원지아', '0206', 35),                                  // 남은 25분 → 주의
  L('T07', 'tiktok', '천로아', '0207', d(1), { absent: 1, resp: 75, nextCallAt: DEMO_NOW + 2 * 60 * MIN }),
  L('T08', 'tiktok', '방유나', '0203', d(1), { consent: false, resp: 9 }),   // T03과 같은 번호, 3일 차이 → 중복
];

export const CASE1_LEAD_ID = 'M01';

// 요금 계산기 손잡이 9개(AS-01~07 · AS-15) · 허용 범위(AS-16)
export const knobKeys = ['soloFee', 'linkFee', 'soloCount', 'convPct', 'adSpend', 'feePct', 'agencyCount', 'extraMonths', 'linkCount'];

export const defaultKnobs = {
  soloFee: 300000,
  linkFee: 200000,
  soloCount: 50,
  convPct: 10,
  adSpend: 10000000,
  feePct: 15,
  agencyCount: 20,
  extraMonths: 3,
  linkCount: 10,
};

export const knobMeta = {
  soloFee: { label: '단독 구독 월 요금', unit: '원', min: 0, max: 5000000 },
  linkFee: { label: '매체 연동 추가 월 요금', unit: '원', min: 0, max: 5000000 },
  soloCount: { label: '단독 구독 고객 수', unit: '곳', min: 0, max: 10000 },
  convPct: { label: '단독 → 대행 전환율', unit: '%', min: 0, max: 100 },
  adSpend: { label: '대행 고객 월 광고비', unit: '원', min: 0, max: 1000000000 },
  feePct: { label: '대행 수수료율', unit: '%', min: 0, max: 100 },
  agencyCount: { label: '리드 CRM 쓰는 대행 고객 수', unit: '곳', min: 0, max: 10000 },
  extraMonths: { label: '늘어난 유지 개월', unit: '개월', min: 0, max: 60 },
  linkCount: { label: '매체 연동 추가 고객 수', unit: '곳', min: 0, max: 10000 },
};
