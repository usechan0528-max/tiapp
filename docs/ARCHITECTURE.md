# 티앱 실행과 검증

티앱은 Next.js App Router와 TypeScript로 만든 모바일 TF 워크스페이스다. 인증, 팀 데이터, 모델 호출은 Node.js 서버에서 처리한다.

| 위치 | 책임 |
|---|---|
| src/components/AppShell.tsx | 공통 헤더와 모바일 탐색 |
| src/app, src/components | TF 생성·초대, 계획, 업무판·체크인, 최종 결과물 화면 |
| src/lib/team | 브라우저 세션을 멤버에 연결하고 매 요청에서 팀 소속 확인 |
| src/lib/plan, src/lib/tasks | 피드백과 계획 버전 저장, 확정 트랜잭션에서 담당 업무 생성, 선행 자료 인계 |
| src/lib/checkin | 최신 보고, 의존 업무, 후속 질문의 예정 시점과 답변 저장 |
| src/lib/output | 원본으로 결과물 구성, 보완 요청과 최종 검수 버전 보존 |
| src/lib/database.ts | 파일 SQLite 연결. 기본 파일은 data/tf.sqlite, 테스트는 TF_DATABASE_PATH로 분리 |

## 두 휴대폰에서 시연하기

Node.js 22.13 이상과 npm을 사용한다. 서버의 .env.local에 OPENAI_API_KEY를 설정한다. 실제 모델은 OPENAI_MODEL로 선택할 수 있다.

1. 프로젝트에서 `npm ci`, `npm run build`, `npm start -- --hostname 0.0.0.0 --port 3000` 순서로 실행한다.
2. 두 휴대폰을 서버와 같은 네트워크에 연결하고 팀장 휴대폰에서 `http://서버의-LAN-IP:3000`을 연다. 초대 링크는 접속한 주소로 생성되므로 휴대폰에서 열 수 있는 주소로 시작한다. 무선 기기 간 연결이 차단된 행사장에서는 하나의 개인 핫스폿을 이용한다.
3. 팀장은 예시 채우기로 TF를 만들고 초대 링크를 보낸다. 팀원이 합류한 뒤 계획에서 초안을 생성하고 팀원 피드백을 반영해 확정한다.
4. 업무판에서 팀원이 막힌 점을 체크인하고 다음 확인을 10초 후로 지정한다. 질문에 답하고 자료를 제출한 뒤 팀장 휴대폰에서 후속 업무의 원본을 연다.
5. 필요한 자료를 모두 제출하면 결과물 화면에서 취합·확정한다. 두 기기에서 같은 확정본과 출처를 확인한다.

## Cloudflare Worker 연결

계획 생성과 결과물 취합 요청은 티앱 서버에서 전용 Worker로 전달한다. Worker는 두 POST 경로만 허용하고 앱 전용 비밀값을 확인한 뒤 Worker Secret인 `OPENAI_API_KEY`로 OpenAI를 호출한다. Worker 설정은 `cloudflare/wrangler.toml`, 진입점은 `cloudflare/openai-worker.mjs`다.

티앱 서버의 `.env.local`에 `OPENAI_WORKER_URL`을 Worker의 HTTPS origin으로 설정하고 `OPENAI_WORKER_SECRET`을 Worker Secret `APP_SECRET`과 일치시킨다. 환경 변경 후 서버를 재시작한다. Worker 주소를 생략한 로컬 실행은 기존 직접 연결을 사용한다.

## 재현 가능한 검증

`npm test`로 도메인·API 테스트를, `npm run lint`와 `npm run build`로 정적 검증을 실행한다. 빌드 직후 `npm run test:e2e`는 임시 DB와 서버 전용 고정 모델을 사용해 독립된 모바일 브라우저에서 실행한다. Chromium이 설치되지 않은 환경에서는 `npx playwright install chromium`을 먼저 수행한다.

실제 모델 검증은 `node --env-file=.env.local node_modules/vite-node/vite-node.mjs scripts/verify-live-model.ts`로 실행한다. 가상의 팀·업무 자료로 계획 구성과 출처 연결을 확인하며 실제 API 사용량이 발생한다.

## 개인 팀 관리

개인 페이지 /me는 현재 브라우저 세션의 팀 목록을 서버에서 조회한다. /team/new는 추가 팀을 생성하고 /api/team/select는 소속 확인 후 선택한 팀의 세션 쿠키를 설정한다.

## 업무판 갱신과 원본 열람

화면에 표시된 업무판은 1초마다 진행 중인 요청이 없는지 확인하고 최신 상태를 조회한다. 업무 API는 멤버별 변경 상태를 반환한다. 원본을 열면 클라이언트가 실제 표시한 버전을 PATCH로 보내고 서버가 팀과 후속 담당자를 확인해 SQLite에 기록한다.

업무판은 편집을 시작한 원본 버전과 본문·링크를 멤버 및 업무별로 현재 탭의 세션 저장소에 보관한다. 재연결하면 서버 최신본을 다시 조회한다.

제출 폼은 직접 선행 업무의 본문을 sourceBlocks로 읽고 선택한 원본 ID·버전·머리글·행 전체를 초안과 함께 보관한다. POST /api/tasks에서 근거를 검증해 결과에 연결한다. 두 업무판은 기존 폴링으로 rowEvidence를 읽는다. 조치 완료 버튼은 화면에 표시한 결과 버전과 대상 원본 버전을 recheckRow PATCH로 전달한다.

## 팀 채팅과 자동 정리

업무판에서 여는 /chat은 /api/chat을 통해 현재 세션 소속 팀의 대화와 공유 노트를 읽는다. 작성자는 서버에서 확인한 멤버로 기록한다. 상시 실행하는 Next.js Node.js 서버가 5분마다 SQLite에 남은 미정리 대화를 확인하므로 채팅방을 닫아도 처리를 계속한다. src/lib/chat/model.ts는 해당 팀의 대상 메시지만 기존 서버 모델 연결로 전달하고, 요약 항목마다 근거 메시지 ID가 입력에 포함되는지 검증한다. 생성이 실패하면 대화는 다음 정리 대상으로 남는다.
