# Step 1 · TF 생성과 초대

## 먼저 읽을 파일

AGENTS.md, docs/PRD.md, package.json, src/app/, src/lib/. phases/0-mvp/index.json의 이전 단계 요약에서 실제 구현 파일도 확인한다.

## 구현 범위

createTeam, joinTeam, closeInvite, rotateInvite를 구현한다. 생성·참여 폼에서 PRD의 팀·멤버 정보를 받는다. 초대 토큰과 개인 세션을 분리하고 서버에서 팀 소속과 역할을 검사한다.

## 완료 기준

두 세션이 하나의 TF에 참여하고 같은 브라우저 재방문은 중복 멤버를 만들지 않는다. 폐쇄·교체한 링크는 새 참여를 막고 기존 멤버는 유지한다. 다른 팀의 비공개 데이터에 접근할 수 없다.

## 검증 절차

위 기준의 테스트를 먼저 작성한다. 테스트 파일명에 team-invite를 포함하고 기존 테스트도 함께 실행한다.

```sh
npm test -- team-invite
npm test
npm run lint
npm run build
```

phases/0-mvp/index.json의 step 1에 결과를 기록한다. 통과하면 completed와 summary, 사용자 조치가 필요하면 blocked와 blocked_reason, 세 번 수정 후에도 실패하면 error와 error_message를 기록한다. 해당 단계의 검증 전에는 완료로 표시하지 않는다.
