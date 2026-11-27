# Step 0 · 실행 기반

## 먼저 읽을 파일

AGENTS.md, docs/PRD.md, docs/ARCHITECTURE.md, docs/ADR.md, docs/UI_GUIDE.md. phases/0-mvp/index.json의 이전 단계 요약에서 실제 구현 파일도 확인한다.

## 구현 범위

Next.js·TypeScript, SQLite, 테스트별 임시 DB, 모바일 네 화면의 탐색 골격을 구성한다. npm test는 Vitest 파일명 필터를 지원하게 한다. 기술 문서와 UI 가이드의 예시를 실제 구조와 화면 원칙으로 갱신한다.

## 완료 기준

빈 DB 초기화를 반복해도 유효하고 재시작 후 데이터가 남는다. 모바일에서 네 화면에 접근할 수 있다.

## 검증 절차

위 기준의 테스트를 먼저 작성한다. 테스트 파일명에 project-setup를 포함하고 기존 테스트도 함께 실행한다.

```sh
npm test -- project-setup
npm test
npm run lint
npm run build
```

phases/0-mvp/index.json의 step 0에 결과를 기록한다. 통과하면 completed와 summary, 사용자 조치가 필요하면 blocked와 blocked_reason, 세 번 수정 후에도 실패하면 error와 error_message를 기록한다. 해당 단계의 검증 전에는 완료로 표시하지 않는다.
