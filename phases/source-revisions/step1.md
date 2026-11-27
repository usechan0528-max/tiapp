# Step 1 · 담당자 카드
docs/UI_GUIDE.md, src/app/api/tasks/route.ts, src/components/tasks/TaskBoard.tsx와 step0의 읽기·쓰기 인터페이스를 확인한다.
본인 카드에서 선행 원본을 열 때 화면에 표시한 버전을 기록하고, 확인 후 변경된 원본을 표시한다.
모바일 시나리오를 테스트부터 확장한다. 업무판 갱신 주기를 보존한다.

검증 명령은 `npm run lint`, `npm test`, `npm run build`, `TF_E2E_PORT=3212 npm run test:e2e`이다.
