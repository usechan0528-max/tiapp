# Step 4 · 진척과 막힘 확인

## 먼저 읽을 파일

AGENTS.md, docs/PRD.md, src/app/, src/lib/, phases/0-mvp/step3.md. phases/0-mvp/index.json의 이전 단계 요약에서 실제 구현 파일도 확인한다.

## 구현 범위

recordCheckIn은 원문·마지막 보고 시각·진척·막힘·다음 확인 시점을 보존한다. dueQuestions는 예정된 시점에 이전 보고에 근거한 질문을 앱에 표시한다. 팀 보기는 주기적으로 최신 상태를 읽고 의존 업무와 기다리는 사람을 표시한다.

## 완료 기준

시계를 앞으로 옮기는 테스트에서 예정된 질문이 한 번만 뜬다. 답변하면 막힘과 팀 보기가 갱신된다. 무응답은 마지막 보고를 유지하고, 체크인만으로 산출물을 제출 처리하지 않는다.

## 검증 절차

위 기준의 테스트를 먼저 작성한다. 테스트 파일명에 progress-checkin를 포함하고 기존 테스트도 함께 실행한다.

```sh
npm test -- progress-checkin
npm test
npm run lint
npm run build
```

phases/0-mvp/index.json의 step 4에 결과를 기록한다. 통과하면 completed와 summary, 사용자 조치가 필요하면 blocked와 blocked_reason, 세 번 수정 후에도 실패하면 error와 error_message를 기록한다. 해당 단계의 검증 전에는 완료로 표시하지 않는다.
