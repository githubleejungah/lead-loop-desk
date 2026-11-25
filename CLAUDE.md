# 작업 규칙 — lead-loop-desk

## 스택 (ADR 0001, 제안)
- 정적 HTML · CSS · JavaScript(ES 모듈), 빌드 없음. GitHub Pages.
- 시험: Node 기본 시험 도구(`node --test`).

## 규칙
- 데이터는 모두 가상. 실제 회사 이름 · 고객 · 전화번호 · 가격 금지. 공개본에 지원 회사 이름 · 제품 이름을 쓰지 않는다('광고 대행사', '리드 CRM'). 가리지 않은 원문은 저장소 밖 지원 폴더에 둔다.
- 순서: 요구(docs/requirements.md) 확인 → 아키텍처 · 데이터 · 흐름 설계 승인 → 코드.
- 숫자는 근거(인터뷰 답 A · 문서 D · 관찰 O · 추론 I)를 단다. 근거 없는 숫자는 가정 표에 질문으로 올린다.
- 상태 규칙 · 판정 규칙 · 단가 · 매출 계산은 순수 함수 모듈에만 둔다. 화면 숫자와 다시 계산한 숫자가 같은지 시험한다.
- 되풀이되는 곳(부재 재연락 · 재배정)은 끝나는 조건을 둔다.
- 전화번호는 화면에서 가리고, 매체 되돌리기 미리 보기는 해시 값만 보인다. 실제 외부 전송은 하지 않는다.
- 구조 · 데이터 · 흐름이 바뀌면 같은 커밋에서 docs/도 고친다.
- push · 배포는 사용자 승인 뒤. Pages 배포는 올리기(build 작업)와 배포(deploy 작업, needs)를 나눈다.

## 자주 쓰는 명령
- 요구 문서 검사: `python "C:/dev/workspace-igm/self study/ref-project/sdd/99_toolchain/01_automation/doc_lint.py" ears docs/requirements.md --strict`
- 시험: `node --test tests/`
- 로컬 보기: `python -m http.server 8798 --directory site` → http://localhost:8798
- 공개 전 회사 이름 검사: 저장소 밖 지원 폴더 스크립트
