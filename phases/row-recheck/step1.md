모바일 업무판 및 두 세션 인수 검증. 첫 단계의 도메인/API를 읽고 실제 사용한다. 기존 src/components/tasks/SubmitForm.tsx,TaskBoard.tsx,Source.tsx, e2e/fast-handoff.spec.ts와 docs/ 설계를 읽는다. 새 두 세션 Playwright 테스트부터 작성한다. 후속 담당자가 제출할 때 운영표 한 행을 근거로 선택하고 이미 완료한 점검 결과에만 변경 발생 시 '다시 확인할 일 1건'을 표시한다. 변경 전·후와 내 점검 결과를 함께 보여주고 담당자가 실제 조치 완료를 눌러 해결한다. 팀 전체 화면에서도 요청/해제가 자동 갱신된다. 원본 열람만으로 해제되지 않는다. 모바일 폼의 초안/충돌 처리를 보존한다. 기존 시각 체계를 따른다. docs/PRD.md, ARCHITECTURE.md, ADR.md, UI_GUIDE.md에 결정 반영. 제출용 영상·제출 문안은 수정하지 않는다.

검증: npm run lint && npm test && npm run build && npm run test:e2e
성공하면 이 단계의 index.json status를 completed로 갱신하고 summary에 결과를 남긴다.
