# Step 0 · 원본 버전과 열람 기록
docs/ARCHITECTURE.md, docs/ADR.md, src/lib/tasks와 tests/task-handoff.test.ts를 읽는다.
SQLite에 팀·원본별 버전과 멤버별 확인 버전을 저장한다. 구형 제출물은 첫 버전으로 읽는다.
동일 내용 재전송, 오래된 확인, 타 담당자의 요청과 여러 멤버를 테스트부터 검증한다.

검증 명령은 `npm test -- task-handoff`이다.
