# Step 3 · 업무 배정과 자료 인계

## 먼저 읽을 파일

AGENTS.md, docs/PRD.md, src/app/, src/lib/, phases/0-mvp/step2.md. phases/0-mvp/index.json의 이전 단계 요약에서 실제 구현 파일도 확인한다.

## 구현 범위

계획 확정과 담당 업무 생성을 하나의 트랜잭션으로 묶는다. 개인별·팀 전체 업무판을 만든다. 담당자가 글·표·링크를 제출하고 완료하면 모든 선행 업무가 끝난 후속 카드를 열고 필요한 제출물을 연결한다.

## 완료 기준

두 선행 업무 중 하나만 완료하면 후속 업무는 대기한다. 둘 다 완료되면 담당자 카드에서 원본을 연다. 확정·제출을 재전송해도 카드와 인계가 중복되지 않는다. 다른 담당자의 업무 제출은 거절한다.

## 검증 절차

위 기준의 테스트를 먼저 작성한다. 테스트 파일명에 task-handoff를 포함하고 기존 테스트도 함께 실행한다.

```sh
npm test -- task-handoff
npm test
npm run lint
npm run build
```

phases/0-mvp/index.json의 step 3에 결과를 기록한다. 통과하면 completed와 summary, 사용자 조치가 필요하면 blocked와 blocked_reason, 세 번 수정 후에도 실패하면 error와 error_message를 기록한다. 해당 단계의 검증 전에는 완료로 표시하지 않는다.
