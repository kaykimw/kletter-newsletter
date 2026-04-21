# Kletter 앱 버전 디자인 스펙

- **작성일**: 2026-04-21
- **작성자**: kay (+ 브레인스토밍 기록)
- **상태**: 초안, 사용자 검토 대기

---

## 1. 배경 & 목적

현재 `kletter.vercel.app`은 다중 페이지 웹매거진으로 배포 중이다. 여기에 "앱 버전"을 추가하고 싶다는 요청에서 시작.

**단, 앱스토어에 배포하지 않는 형태를 원함.**

따라서 네이티브 iOS/Android 앱, React Native, Capacitor 등은 제외하고 **PWA(Progressive Web App)** 방식으로 진행한다. PWA는 브라우저에서 "홈 화면에 추가"하면 아이콘이 생기고 앱처럼 풀스크린으로 실행되는 웹 기반 앱.

### 앱 버전에 담고 싶은 핵심 경험 (사용자 요구)

1. 홈 화면 아이콘으로 빠르게 접근
2. 오프라인에서도 이전에 읽은 글은 읽기
3. 새 weekly 발행 시 푸시 알림 수신
4. 모바일에 최적화된 "앱답게" 재설계된 UI/UX

## 2. 범위 & 원칙

### 범위

- 기존 웹 UI를 **완전히 대체하는** 앱 스타일 UI (모바일·데스크톱 동일 레이아웃)
- 하단 탭바(4개: 홈 / OTT / shortform / 설정), 카드 피드, 좌우 스와이프로 이전·다음 호 이동
- 홈 탭은 **최신 OTT 1건 + 최신 shortform 1건**만 노출 (지난 호 섹션 없음 — 아카이브는 각 탭에서 접근)
- 오프라인 전략: 사용자가 한 번 열어본 페이지만 자동 캐시(가장 단순)
- 푸시 알림 트리거: 새 weekly 발행 시 1회 (주 1회)
- 이메일 구독은 기존 Resend 연동 그대로 유지 (구독자 6명 보존)
- 정본 = Vercel (`kletter.vercel.app`). `kletter.watcha.io`(사내 ADP)는 당분간 보류

### 원칙

- YAGNI 엄수: 6명 규모 + 주 1회 발행에 맞는 최소 구성으로
- 기존 Vercel/Resend/Next.js 생태계 최대 활용, 추가 인프라는 Vercel KV 한 개만
- 관리 지점 = GitHub 레포 (`kaykimw/kletter-newsletter`) 하나. `git push`가 모든 것의 트리거

## 3. 기술 스택 선택

**채택: Next.js (App Router) + next-pwa + web-push + Vercel KV**

| 역할 | 선택 | 이유 |
|---|---|---|
| 프레임워크 | Next.js (App Router, 최신 안정 버전) | Vercel 최적 지원, SSG + 클라이언트 전환 효과, 생태계 풍부 |
| PWA 통합 | next-pwa (또는 @ducanh2912/next-pwa) | Next.js와 바로 연결되는 Workbox 래퍼 |
| 푸시 | web-push + VAPID | 표준. iOS 16.4+ Safari, Android Chrome 모두 지원 |
| 토큰 저장 | Vercel KV | 별도 서버/DB 없이 Vercel 내부에서 해결. 무료 티어 충분 |
| 이메일 | Resend (기존) | 이미 동작 중. 구독자 유지 |
| 콘텐츠 | MDX (frontmatter + 마크다운) | 정적 생성 + 메타데이터 구조화 |

### 검토 후 기각한 대안

- **Astro + View Transitions**: 정적 사이트에 강하지만 카드 피드·스와이프 제스처는 수작업 많음. "앱답게 전면 재설계" 요구에 부족
- **React Native for Web + Expo**: 원래 앱스토어 배포용 도구라 "앱스토어 안 씀" 조건에서는 오버엔지니어링. SEO에도 불리
- **Capacitor/Tauri 하이브리드**: 네이티브 쉘 필요 → 앱스토어 배포 전제와 맞지 않음

## 4. 아키텍처

```
사용자 (브라우저 / PWA 설치)
        │
        ▼
┌──────────────────────────────────────────────┐
│  Vercel (kletter.vercel.app)                 │
│                                              │
│  ① Next.js 앱 (App Router)                    │
│      ├─ SSG 정적 생성된 라우트                │
│      ├─ 클라이언트 컴포넌트(탭바, 스와이프 등)│
│      └─ public/manifest.json (아이콘/색상)   │
│                                              │
│  ② Service Worker (next-pwa 자동 생성)        │
│      ├─ AppShell 프리캐시                    │
│      └─ 방문 페이지 Runtime 캐시              │
│                                              │
│  ③ API Routes (Serverless)                   │
│      ├─ /api/subscribe (Resend 기존)         │
│      ├─ /api/push/subscribe                  │
│      └─ /api/push/notify                     │
└──────────────────────────────────────────────┘
        │               │
        ▼               ▼
┌──────────────┐  ┌──────────────────┐
│ Vercel KV    │  │ Resend           │
│ (push tokens)│  │ (email audience) │
└──────────────┘  └──────────────────┘

발행 흐름:
  GitHub MDX 푸시 → Vercel 빌드 → 배포 완료 Webhook(또는 GitHub Action post-merge)
       → /api/push/notify 호출 → KV 토큰 순회 → web-push 발송
```

## 5. 페이지 & 라우팅

| 경로 | 탭 라벨 | 역할 |
|---|---|---|
| `/` | 홈 | 최신 OTT 1건 + 최신 shortform 1건 카드. 지난 호 없음 |
| `/weekly` | OTT | OTT 리포트 전체 리스트 (아카이브 포함) |
| `/weekly/[week]` | — | 개별 OTT 호. 좌우 스와이프로 전/다음 호 이동 |
| `/shortform` | shortform | shortform 리포트 전체 리스트 |
| `/shortform/[week]` | — | 개별 shortform 호 |
| `/settings` | 설정 | 이메일 구독, 푸시 토글, 캐시 초기화, 정보 |

- 내부 경로명은 `weekly/shortform` 유지 (기존 콘텐츠 URL과의 호환 및 내부 식별자). UI에 노출되는 탭 라벨만 `OTT / shortform`로 표기
- 기존 `/subscribe` 단독 페이지는 폐지하고 `/settings` 안으로 통합

## 6. UI 컴포넌트 구조

### 공통 레이아웃(AppShell)

```
┌──────────────────────────────┐
│ TopBar (로고 · 오프라인표시) │
├──────────────────────────────┤
│                              │
│  [페이지 내용 영역]          │
│                              │
├──────────────────────────────┤
│ BottomTabBar                 │
│ 🏠 홈  📺 OTT  🎬 shortform ⚙ │
└──────────────────────────────┘
```

### 컴포넌트 목록 (단위·책임 중심)

- `AppShell` — 전체 레이아웃 껍데기. 서비스워커가 먼저 캐시
- `TopBar` — 탭 이름, 오프라인 인디케이터, 알림 뱃지
- `BottomTabBar` — 4개 탭(홈/위클리/숏폼/설정) 라우팅
- `FeedCard` — 카드 한 장(썸네일, 제목, 요약, 발행일)
- `ArticleView` — MDX 본문 렌더링
- `SwipeNavigator` — 개별 호 페이지에서 좌우 드래그로 전/다음
- `SubscribePanel` — 설정 탭의 이메일 구독 블록
- `PushToggle` — 설정 탭의 푸시 알림 on/off

각 컴포넌트는 자체 내부 상태를 가지거나 상위로 이벤트만 전달하는 식으로 경계 명확히.

### 전환 애니메이션

- 탭 전환: 페이드 0.2s
- 개별 페이지 진입: 우→좌 슬라이드 (iOS 표준)
- 스와이프 전/다음 호: 드래그 실시간 추종

## 7. 콘텐츠 모델

### MDX 파일 구조

```
content/weekly/2026-W17.mdx
───────────────────────────
---
title: "봄 드라마 라인업 특집"
week: "2026-W17"
publishedAt: "2026-04-22"
thumbnail: "/images/w17-cover.jpg"
excerpt: "넷플릭스 신작과 TVer 주간 1위를 한눈에"
tags: ["weekly", "netflix", "tver"]
---

# 봄 드라마 라인업 특집

본문...
```

숏폼은 `content/shortform/YYYY-WXX.mdx` 경로에 동일 구조.

### 필수 frontmatter 필드

`title`, `week`, `publishedAt`, `thumbnail`, `excerpt`. 누락 시 빌드 단계에서 차단.

### 제목 작성 규칙 (편집 가이드)

- `title`은 **해당 호의 핵심 이슈/주제** 중심으로 (예: "BEEF 시즌2 본격 제작", "사냥개들 시즌2 & 봄 드라마 개막전")
- 매 호 고정 브랜드 문구(예: "JAPAN Weekly OTT 트렌드 리포트")는 사용하지 않음 — 이미 탭 라벨(OTT/shortform)과 카드 배지(OTT/SHORTFORM)에서 분류 표시되므로 중복됨
- 좋은 예: 그 호에서 가장 화제 되는 작품/소식을 간결하게 노출
- 나쁜 예: 매 호 같은 정적 문구, OTT·Weekly 등 분류어 반복

### 기존 HTML → MDX 이관

현재 `deploy/weekly/2026-W16/index.html` 등 8개 HTML을 MDX로 일회성 변환. 이관 스크립트는 구현 계획에서 상세화. 완료 후 `deploy/` 구버전 파일은 삭제(깃 히스토리엔 보존).

## 8. 데이터 흐름

### 이메일 구독 (기존, 변경 없음)

```
설정에서 이메일 입력 → /api/subscribe → Resend Audience 추가
```

### 푸시 구독 (신규)

```
설정의 "알림 받기" 토글 ON
  ↓
브라우저 푸시 권한 요청
  ↓
브라우저가 endpoint(고유 토큰) 생성
  ↓
/api/push/subscribe → Vercel KV에 저장
  (키 예: `push:token:<hash>` 값: JSON endpoint+keys)
```

### 새 weekly 발행 알림

```
git push → Vercel 배포 완료
  → (Vercel Deployment Webhook 또는 GitHub Action post-merge)
  → /api/push/notify (POST, 인증: PUSH_NOTIFY_SECRET 헤더)
  → KV에서 모든 토큰 조회
  → 각 토큰에 web-push로 발송
  → 실패 토큰(410 Gone 등)은 KV에서 삭제
```

발송 트리거 구현 방식은 구현 계획 단계에서 결정 (Webhook vs Action). 어느 쪽이든 외부에서 `/api/push/notify`를 `PUSH_NOTIFY_SECRET`으로 인증해 호출하는 모양은 동일.

페이로드 예:
```json
{
  "title": "Kletter · 2026 W17",
  "body": "봄 드라마 라인업 특집이 발행되었어요",
  "url": "/weekly/2026-W17",
  "icon": "/icons/icon-192.png"
}
```

### 오프라인 동작

- 사용자가 페이지를 처음 열면 서비스워커가 Runtime 캐시에 저장
- 네트워크 끊기면 캐시된 페이지는 그대로 제공
- 캐시 없는 페이지 요청 시 오프라인 안내 화면

## 9. 에러 처리 & 안정성

| 실패 상황 | 대응 | 사용자 경험 |
|---|---|---|
| 인터넷 없음 | SW 캐시 제공 | 캐시된 페이지 열림, 없으면 오프라인 안내 |
| 이미지 로드 실패 | placeholder 대체 | "📷 이미지 없음", 본문 정상 |
| 푸시 토큰 만료/무효 | 발송 실패 응답 시 KV에서 삭제 | 사용자는 모름. 재구독 시 새 토큰 |
| Vercel 빌드 실패 | 이전 배포 유지 | 사용자 영향 없음 |
| 푸시 발송 API 장애 | Vercel 자동 재시도 | 최대 10분 내 수신, 이후 드롭 |
| 이메일 구독 API 실패 | 에러 메시지 + 재시도 | 사용자에게 안내 |
| MDX 파싱 오류 | 빌드 단계에서 차단 | 배포 자체 차단, 이전 버전 유지 |
| PWA 미지원 브라우저 | 일반 웹으로 동작 | 푸시/오프라인만 비활성, 읽기는 정상 |

### 원칙

1. 읽기는 무조건 된다
2. 쓰기 실패는 사용자에게 알리고 재시도 가능
3. 조용히 실패하지 않는다 — 설정에서 상태 확인 가능
4. 인프라 오류는 사용자에게 노출하지 않는다

### 복구 수단

- 설정에 **캐시 초기화** 버튼
- 설정에서 **푸시 토글 OFF→ON** 으로 재구독

## 10. 테스트 & 검증

규모에 맞춘 가벼운 전략.

### 자동 테스트 (Vitest)

- MDX 파싱 & frontmatter 필수 필드 검증
- `/api/subscribe` (Resend 모킹)
- `/api/push/subscribe`, `/api/push/notify` (web-push, KV 모킹)
- 카드 피드 정렬(날짜 최신순)

### 빌드 단계 자동 검증

- TypeScript 타입 체크
- ESLint
- MDX frontmatter 스키마 검증
- Next.js 기본 빌드 검증 (링크/이미지)

### 수동 체크리스트 (매 배포 후)

- [ ] `/` 카드 피드 렌더
- [ ] `/weekly/[week]`, `/shortform/[week]` 개별 페이지
- [ ] `/settings` 열림, 토글 동작
- [ ] 하단 4개 탭 전환 정상
- [ ] 최신 3개 페이지 이미지 정상
- [ ] 이메일 구독 테스트 수신

### 실기 검증 (격주 1회)

- iPhone Safari: 홈 화면 추가 → 앱으로 실행 → 정상
- iPhone Safari: 설정에서 알림 ON → 테스트 푸시 수신
- Android Chrome: 설치 배너 → 설치 → 정상
- Android Chrome: 알림 ON → 테스트 푸시 수신
- 비행기 모드: 방문했던 페이지 오프라인에서 열림

### 안 하는 것

- E2E 자동 테스트 (Playwright 등) — 규모 대비 과도
- 시각적 회귀 테스트, 부하 테스트 — 해당 없음
- 외부 모니터링 도구(Sentry 등) — 6명 규모에 불필요

### 푸시 실기 테스트 경로

`/api/push/notify`에 `dryRun=true&only=self` 옵션을 두어 본인 토큰에만 발송. 실 사용자 스팸 방지.

## 11. 배포 & 운영

- 정본: `kletter.vercel.app` (Vercel 자동 배포)
- 소스: `kaykimw/kletter-newsletter` (main 브랜치가 프로덕션)
- 새 weekly 발행 절차:
  1. 로컬 `npm run dev` 로 MDX 미리보기
  2. 프리뷰 배포(`vercel`)로 URL 확인
  3. 이상 없으면 main 머지 → 자동 프로덕션 배포
  4. 배포 완료 Webhook(또는 GitHub Action)이 `/api/push/notify` 호출 → 구독자 전원 푸시
- 정지된 스케줄 에이전트(`trig_01SAQj85Q5UgKyp4BiUaHb58`)는 별도 재설계. 앱 스펙에는 포함하지 않음 (이 문서 범위 밖)
- `kletter.watcha.io` (사내 ADP) 운명은 사용자가 사내망 복귀 후 재결정 (이 문서 범위 밖)

## 12. 환경 변수 & 시크릿

- `RESEND_API_KEY` (기존)
- `RESEND_AUDIENCE_ID` (기존, `72321aea-90c4-4875-ae44-61e9fbb50c8d`)
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (신규, web-push용)
- `VAPID_SUBJECT` (신규, 연락용 mailto:)
- `KV_REST_API_URL`, `KV_REST_API_TOKEN` (신규, Vercel KV 자동 주입)
- `PUSH_NOTIFY_SECRET` (신규, `/api/push/notify` 호출 인증)

모두 Vercel 대시보드 환경변수에 설정.

## 13. 이 문서 범위 밖 (명시적 비포함)

- 스케줄 에이전트 재설계 (웹매거진 자동 발행 루프)
- `kletter.watcha.io` ADP 정리/폐기 결정
- 사용자 계정·로그인 (현재 익명 PWA 구독 모델 유지)
- 검색·북마크·추천 등 고급 기능
- 디자인 시스템 상세 (색상/타이포/브랜딩은 기존 웹 스타일 재활용하되 구체 결정은 구현 계획 단계)

## 14. 다음 단계

이 디자인이 승인되면 `writing-plans` 스킬로 넘어가 **구현 계획(implementation plan)** 작성. 순서대로:

1. 현재 `~/kletter-newsletter`를 Next.js 프로젝트로 재구조화
2. 기존 HTML 8개 → MDX 일회성 이관
3. AppShell + 하단 탭 + 카드 피드 구현
4. SwipeNavigator + 개별 호 페이지
5. next-pwa 통합, manifest, 아이콘
6. Push 인프라(VAPID, KV, notify API)
7. Resend 재통합(기존 API 복구)
8. 수동 체크리스트 통과 → 프로덕션 배포
