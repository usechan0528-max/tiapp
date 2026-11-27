# Step 2 · 계획 제안과 확정

## 먼저 읽을 파일

AGENTS.md, docs/PRD.md, src/app/, src/lib/, phases/0-mvp/step1.md. phases/0-mvp/index.json의 이전 단계 요약에서 실제 구현 파일도 확인한다.

## 구현 범위

서버 모델 어댑터에서 목표·기한·실제 팀 구성으로 draftPlan과 revisePlan을 생성한다. 결과물 구성·완료 기준, 업무별 담당·기한·선행 업무·제출 기준을 구조화한다. 버전별 피드백과 변경점을 보여준다. confirmPlan은 팀장만 최신 버전에 수행한다.

## 완료 기준

다른 목표 두 개가 서로 다른 결과물 구성을 허용한다. B의 일정 피드백이 다음 버전에 반영되고 실패한 생성은 기존 의견과 초안을 보존한다. 팀 외 담당자·순환 의존성·오래된 버전 확정을 거절한다. 확정 전 배정은 0건이다.

## 검증 절차

위 기준의 테스트를 먼저 작성한다. 테스트 파일명에 plan-feedback를 포함하고 기존 테스트도 함께 실행한다.

```sh
npm test -- plan-feedback
npm test
npm run lint
npm run build
```

phases/0-mvp/index.json의 step 2에 결과를 기록한다. 통과하면 completed와 summary, 사용자 조치가 필요하면 blocked와 blocked_reason, 세 번 수정 후에도 실패하면 error와 error_message를 기록한다. 해당 단계의 검증 전에는 완료로 표시하지 않는다.
