# Step 0 · 업무판 자동 인계

## 읽을 파일

- AGENTS.md, docs/PRD.md, docs/ARCHITECTURE.md, docs/ADR.md, docs/UI_GUIDE.md
- src/components/tasks/TaskBoard.tsx
- e2e/mobile-e2e.spec.ts

## 작업

독립된 모바일 세션에서 민서가 후속 업무의 대기 상태를 보고 있는 동안 지우가 운영표를 제출한다. 민서의 입력이나 화면 이동 없이 같은 카드에 시작 가능 상태와 열 수 있는 원본이 모두 3초 이내에 나타나는 테스트를 먼저 작성한다. 업무판 갱신은 화면 가시성과 컴포넌트 수명에 맞추고 느린 조회가 중복되지 않게 한다. 원본 표시 UI는 별도 작업 범위다.

## 검증

```sh
npm run lint
npm test
npm run build
TF_E2E_PORT=3211 npm run test:e2e -- e2e/fast-handoff.spec.ts
TF_E2E_PORT=3211 npm run test:e2e
```
