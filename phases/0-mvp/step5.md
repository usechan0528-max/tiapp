# Step 5 · 결과물 취합과 검수

## 먼저 읽을 파일

AGENTS.md, docs/PRD.md, src/app/, src/lib/, phases/0-mvp/step2.md, phases/0-mvp/step3.md. phases/0-mvp/index.json의 이전 단계 요약에서 실제 구현 파일도 확인한다.

## 구현 범위

assembleOutput은 확정한 구성에 맞춰 실제 제출물을 본문·표·링크로 취합한다. 각 구성 요소에 원본을 연결하고 빈 자료나 충돌은 담당자에게 보완 요청한다. 수정 제출 후 재생성하고 팀장이 검수한 버전을 확정한다.

## 완료 기준

표 중심 행사 운영안과 실행 링크 중심 시제품에서 각자 다른 구성을 얻는다. 누락·충돌이 남으면 보완할 위치와 담당자가 표시된다. 반복 요청은 중복되지 않는다. 보완 후 팀장만 확정할 수 있고 모든 멤버가 같은 최종본과 근거를 다시 연다.

## 검증 절차

위 기준의 테스트를 먼저 작성한다. 테스트 파일명에 final-output를 포함하고 기존 테스트도 함께 실행한다.

```sh
npm test -- final-output
npm test
npm run lint
npm run build
```

phases/0-mvp/index.json의 step 5에 결과를 기록한다. 통과하면 completed와 summary, 사용자 조치가 필요하면 blocked와 blocked_reason, 세 번 수정 후에도 실패하면 error와 error_message를 기록한다. 해당 단계의 검증 전에는 완료로 표시하지 않는다.
