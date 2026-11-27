# Step 6 · 모바일 통합 인수

## 먼저 읽을 파일

AGENTS.md, docs/PRD.md, package.json, src/app/, src/lib/, docs/UI_GUIDE.md. phases/0-mvp/index.json의 이전 단계 요약에서 실제 구현 파일도 확인한다.

## 구현 범위

Playwright 모바일 컨텍스트 두 개로 쿠키와 세션을 분리한다. 자동 테스트는 모델 응답만 고정하고 서버·DB·배정 로직은 실제 경로를 거친다. 예시 목표와 공통 접속 주소로 두 휴대폰에서 재현할 방법을 제공한다.

## 완료 기준

A의 링크로 B가 가입하고 B의 피드백으로 계획이 바뀐다. A가 확정하면 B가 업무와 후속 질문을 받고 자료를 제출한다. A가 인계받아 취합을 마치고 두 세션에서 같은 최종본과 원본을 연다. 실제 모델로도 예시 한 건의 계획 생성과 취합을 확인한다.

## 검증 절차

위 기준의 테스트를 먼저 작성한다. 테스트 파일명에 mobile-e2e를 포함하고 기존 테스트도 함께 실행한다.

```sh
npm run test:e2e
npm test
npm run lint
npm run build
```

phases/0-mvp/index.json의 step 6에 결과를 기록한다. 통과하면 completed와 summary, 사용자 조치가 필요하면 blocked와 blocked_reason, 세 번 수정 후에도 실패하면 error와 error_message를 기록한다. 해당 단계의 검증 전에는 완료로 표시하지 않는다.
