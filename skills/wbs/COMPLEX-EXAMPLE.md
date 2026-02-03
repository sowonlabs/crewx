# WBS 복잡한 사용 예제 (Complex Usage Example)

이 문서는 실제 개발 시나리오를 기반으로 한 복잡한 WBS 프로젝트 예제를 제공합니다. 여러 Agent, 의존성 관리, GitHub Issue 연동, 에러 처리 등 실무에서 필요한 모든 패턴을 다룹니다.

## 시나리오: E-Commerce 결제 시스템 구축

온라인 쇼핑몰에 통합 결제 시스템을 구축하는 프로젝트입니다. 이 프로젝트는 다음과 같은 요구사항이 있습니다:

- **결제 게이트웨이 통합**: Stripe, PayPal, Toss Payments 지원
- **백엔드 API**: Node.js + Express로 결제 처리 API 구현
- **프론트엔드**: React로 결제 UI 구현
- **보안**: PCI-DSS 컴플라이언스 준수
- **테스트**: 단위 테스트 + 통합 테스트
- **문서화**: API 문서 + 사용자 가이드

---

## 1단계: 프로젝트 생성 및 상세 문서 작성

### 1.1 프로젝트 생성

```bash
node skills/wbs/wbs.js create "E-Commerce 결제 시스템 구축"
```

**출력:**
```json
{
  "id": "wbs-5",
  "title": "E-Commerce 결제 시스템 구축",
  "detailPath": "skills/wbs/details/wbs-5-detail.md"
}
```

### 1.2 상세 문서 작성

프로젝트 생성 시 자동으로 생성된 `skills/wbs/details/wbs-5-detail.md` 파일을 다음과 같이 작성합니다:

```markdown
# E-Commerce 결제 시스템 구축

## 프로젝트 개요

온라인 쇼핑몰의 통합 결제 시스템을 구축합니다. 복수의 결제 게이트웨이를 지원하며, 보안성과 사용자 경험을 최우선으로 설계합니다.

## 기술 스택

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js 4.18+
- **Database**: PostgreSQL 14+ (트랜잭션 처리)
- **ORM**: Prisma 5+
- **Validation**: Zod
- **Testing**: Jest + Supertest

### Frontend
- **Framework**: React 18+ (TypeScript)
- **State Management**: Zustand
- **Form Library**: React Hook Form
- **Styling**: Tailwind CSS
- **HTTP Client**: Axios

### Payment Gateways
- Stripe SDK v12+
- PayPal REST SDK v2+
- Toss Payments API v1

### Security
- HTTPS only
- PCI-DSS Level 1 compliant
- Token-based payment (no card storage)
- Input sanitization + validation
- Rate limiting (10 requests/min per user)

## 요구사항

### 기능 요구사항

1. **결제 처리**
   - 카드 결제 (Stripe)
   - PayPal 결제
   - 간편 결제 (Toss Payments)
   - 결제 취소/환불
   - 부분 환불 지원

2. **주문 관리**
   - 주문 생성 및 조회
   - 결제 상태 추적
   - 결제 실패 시 재시도 메커니즘
   - 결제 이력 저장

3. **사용자 인터페이스**
   - 결제 수단 선택 UI
   - 카드 정보 입력 폼 (PCI-compliant)
   - 결제 진행 상태 표시
   - 결제 완료/실패 화면
   - 모바일 반응형 디자인

4. **보안 및 컴플라이언스**
   - 카드 정보 비저장 (토큰화)
   - CSRF 보호
   - Rate limiting
   - 결제 금액 위변조 방지
   - 로깅 및 감사 추적

### 비기능 요구사항

- **성능**: 결제 처리 응답 시간 < 2초
- **가용성**: 99.9% 이상
- **확장성**: 동시 결제 처리 1000 TPS 이상
- **복구**: 실패한 결제 자동 재시도 (최대 3회)

## 데이터 모델

### Order (주문)
```prisma
model Order {
  id          String   @id @default(uuid())
  userId      String
  totalAmount Decimal  @db.Decimal(10, 2)
  currency    String   @default("KRW")
  status      OrderStatus
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  payments    Payment[]
  items       OrderItem[]
}

enum OrderStatus {
  PENDING
  PAID
  CANCELLED
  REFUNDED
}
```

### Payment (결제)
```prisma
model Payment {
  id              String        @id @default(uuid())
  orderId         String
  provider        PaymentProvider
  amount          Decimal       @db.Decimal(10, 2)
  currency        String        @default("KRW")
  status          PaymentStatus
  transactionId   String?       @unique
  failureReason   String?
  createdAt       DateTime      @default(now())
  completedAt     DateTime?

  order           Order         @relation(fields: [orderId], references: [id])
  refunds         Refund[]
}

enum PaymentProvider {
  STRIPE
  PAYPAL
  TOSS
}

enum PaymentStatus {
  PENDING
  PROCESSING
  SUCCEEDED
  FAILED
  CANCELLED
}
```

### Refund (환불)
```prisma
model Refund {
  id            String   @id @default(uuid())
  paymentId     String
  amount        Decimal  @db.Decimal(10, 2)
  reason        String
  status        RefundStatus
  createdAt     DateTime @default(now())
  processedAt   DateTime?

  payment       Payment  @relation(fields: [paymentId], references: [id])
}

enum RefundStatus {
  PENDING
  PROCESSING
  SUCCEEDED
  FAILED
}
```

## API 엔드포인트 설계

### 결제 처리
- `POST /api/payments/initiate` - 결제 시작 (결제 세션 생성)
- `POST /api/payments/process` - 결제 처리 (provider별 로직)
- `GET /api/payments/:id` - 결제 상태 조회
- `POST /api/payments/:id/cancel` - 결제 취소

### 환불 처리
- `POST /api/refunds` - 환불 요청
- `GET /api/refunds/:id` - 환불 상태 조회

### Webhook
- `POST /api/webhooks/stripe` - Stripe webhook 핸들러
- `POST /api/webhooks/paypal` - PayPal webhook 핸들러
- `POST /api/webhooks/toss` - Toss Payments webhook 핸들러

## 참고 자료

### 공식 문서
- [Stripe API Reference](https://stripe.com/docs/api)
- [PayPal REST API](https://developer.paypal.com/api/rest/)
- [Toss Payments API](https://docs.tosspayments.com/)
- [PCI-DSS Requirements](https://www.pcisecuritystandards.org/)

### 보안 가이드
- [OWASP Payment Security](https://cheatsheetseries.owasp.org/cheatsheets/Payment_Card_Industry_Data_Security_Standard_Cheat_Sheet.html)
- [Stripe Security Best Practices](https://stripe.com/docs/security/guide)

### 아키텍처 참고
- [Microservices Payment Gateway Pattern](https://microservices.io/patterns/apigateway.html)
- [Event-Driven Payment Processing](https://aws.amazon.com/event-driven-architecture/)

## 작업 분해 전략

이 프로젝트는 8개의 Job으로 분해됩니다. 각 Job은 15-45분 내에 완료 가능하도록 설계되었습니다.

1. **데이터베이스 스키마 및 마이그레이션** (30분)
2. **결제 게이트웨이 추상화 레이어** (40분)
3. **Stripe 결제 구현** (35분)
4. **PayPal & Toss 결제 구현** (40분)
5. **환불 처리 로직** (30분)
6. **프론트엔드 결제 UI** (45분)
7. **통합 테스트 및 에러 처리** (35분)
8. **API 문서화 및 배포 준비** (25분)

총 예상 시간: **약 4시간 40분**
```

---

## 2단계: Job 추가 (8개 Job with Dependencies)

### Job 1: 데이터베이스 스키마 및 마이그레이션

```bash
node skills/wbs/wbs.js job add wbs-5 \
  --title "데이터베이스 스키마 및 마이그레이션 작성" \
  --agent "@claude:sonnet" \
  --seq 1 \
  --desc "Prisma를 사용하여 Order, Payment, Refund 모델 정의. PostgreSQL 마이그레이션 파일 생성. 인덱스 및 제약조건 추가. seed 데이터 작성."
```

**출력:**
```json
{
  "jobId": "job-10",
  "wbsId": "wbs-5",
  "title": "데이터베이스 스키마 및 마이그레이션 작성",
  "agent": "@claude:sonnet",
  "seq": 1
}
```

### Job 2: 결제 게이트웨이 추상화 레이어

```bash
node skills/wbs/wbs.js job add wbs-5 \
  --title "결제 게이트웨이 추상화 레이어 구현" \
  --agent "@claude:opus" \
  --seq 2 \
  --desc "PaymentGateway 인터페이스 정의. Strategy 패턴으로 provider별 구현체 분리. PaymentService 클래스로 통합 인터페이스 제공. 에러 처리 및 재시도 로직 포함. TypeScript로 강타입 구현."
```

### Job 3: Stripe 결제 구현

```bash
node skills/wbs/wbs.js job add wbs-5 \
  --title "Stripe 결제 처리 구현" \
  --agent "@copilot" \
  --seq 3 \
  --desc "StripePaymentGateway 클래스 구현. Payment Intent 생성, 확인, 취소 메서드 작성. Stripe webhook 핸들러 구현. 테스트 모드 및 프로덕션 키 분리. 에러 매핑 및 로깅."
```

### Job 4: PayPal & Toss 결제 구현

```bash
node skills/wbs/wbs.js job add wbs-5 \
  --title "PayPal 및 Toss Payments 구현" \
  --agent "@copilot" \
  --seq 4 \
  --desc "PayPalPaymentGateway와 TossPaymentGateway 클래스 구현. PayPal Order API 연동. Toss Payments 승인 API 연동. 각 provider의 webhook 핸들러 작성. 결제 상태 동기화 로직."
```

### Job 5: 환불 처리 로직

```bash
node skills/wbs/wbs.js job add wbs-5 \
  --title "환불 처리 및 부분 환불 구현" \
  --agent "@claude:sonnet" \
  --seq 5 \
  --desc "RefundService 클래스 작성. 전액 환불 및 부분 환불 로직. 각 결제 게이트웨이별 환불 API 호출. 환불 상태 추적 및 DB 업데이트. 환불 가능 금액 검증 로직."
```

### Job 6: 프론트엔드 결제 UI

```bash
node skills/wbs/wbs.js job add wbs-5 \
  --title "React 결제 UI 컴포넌트 작성" \
  --agent "@claude:sonnet" \
  --seq 6 \
  --desc "PaymentForm 컴포넌트 (카드 입력). PaymentMethodSelector (Stripe/PayPal/Toss 선택). PaymentStatusModal (진행 상태 표시). usePayment 커스텀 훅으로 API 연동. React Hook Form + Zod 검증. 모바일 반응형 디자인 (Tailwind CSS)."
```

### Job 7: 통합 테스트 및 에러 처리

```bash
node skills/wbs/wbs.js job add wbs-5 \
  --title "통합 테스트 및 에러 처리 강화" \
  --agent "@copilot" \
  --seq 7 \
  --desc "Jest + Supertest로 API 엔드투엔드 테스트 작성. 각 결제 게이트웨이별 성공/실패 시나리오 테스트. 환불 플로우 테스트. 네트워크 타임아웃 처리. 결제 금액 위변조 방지 로직. Rate limiting 테스트."
```

### Job 8: API 문서화 및 배포 준비

```bash
node skills/wbs/wbs.js job add wbs-5 \
  --title "API 문서화 및 배포 준비" \
  --agent "@claude:haiku" \
  --seq 8 \
  --desc "OpenAPI (Swagger) 스펙 작성. Postman Collection 생성. README에 설치 및 실행 가이드 추가. 환경변수 템플릿 (.env.example) 작성. Docker Compose 설정 (PostgreSQL 포함). CI/CD 파이프라인 체크리스트 작성."
```

---

## 3단계: 프로젝트 상태 확인

모든 Job을 추가한 후 상태를 확인합니다.

```bash
node skills/wbs/wbs.js status wbs-5
```

**출력:**
```
📋 E-Commerce 결제 시스템 구축 (wbs-5)
   Status: planning | Progress: 0% (0/8)
   Detail: skills/wbs/details/wbs-5-detail.md

   Jobs:
   | 상태 | #  | ID      | 작업명                                  | 담당           |
   |------|----|---------|-----------------------------------------|----------------|
   | ⬜️  | 1  | job-10  | 데이터베이스 스키마 및 마이그레이션 작성    | @claude:sonnet |
   | ⬜️  | 2  | job-11  | 결제 게이트웨이 추상화 레이어 구현         | @claude:opus   |
   | ⬜️  | 3  | job-12  | Stripe 결제 처리 구현                    | @copilot       |
   | ⬜️  | 4  | job-13  | PayPal 및 Toss Payments 구현            | @copilot       |
   | ⬜️  | 5  | job-14  | 환불 처리 및 부분 환불 구현               | @claude:sonnet |
   | ⬜️  | 6  | job-15  | React 결제 UI 컴포넌트 작성              | @claude:sonnet |
   | ⬜️  | 7  | job-16  | 통합 테스트 및 에러 처리 강화             | @copilot       |
   | ⬜️  | 8  | job-17  | API 문서화 및 배포 준비                  | @claude:haiku  |
```

---

## 4단계: Job 실행 시나리오

### 시나리오 A: 순차 실행 (전통적 워크플로우)

모든 Job을 순차적으로 실행합니다. 각 Job은 이전 Job의 결과물에 의존합니다.

```bash
# 전체 Job 순차 실행
node skills/wbs/wbs.js job run wbs-5
```

**실행 과정:**
```
══════════════════════════════════════════════════
[WBS] Starting project: E-Commerce 결제 시스템 구축
══════════════════════════════════════════════════

[WBS] Running job 1/8: 데이터베이스 스키마 및 마이그레이션 작성
[WBS] Agent: @claude:sonnet
[WBS] Execution ID: exec-45
[WBS] PID: 87231
──────────────────────────────────────────────────

... (Agent 실행) ...

[WBS] Job completed: job-10 (30분 소요)
──────────────────────────────────────────────────

[WBS] Running job 2/8: 결제 게이트웨이 추상화 레이어 구현
[WBS] Agent: @claude:opus
[WBS] Execution ID: exec-46
[WBS] PID: 87245
──────────────────────────────────────────────────

... (계속) ...

══════════════════════════════════════════════════
[WBS] Project completed: E-Commerce 결제 시스템 구축
[WBS] Total time: 4h 37m
[WBS] Completed: 8, Failed: 0
══════════════════════════════════════════════════
```

### 시나리오 B: 단계별 실행 (점진적 개발)

한 번에 한 Job씩 실행하며 중간 결과를 검증합니다.

```bash
# 1단계: 데이터베이스 스키마 작성
node skills/wbs/wbs.js job next wbs-5
# ... 완료 후 스키마 검증 ...

# 2단계: 추상화 레이어
node skills/wbs/wbs.js job next wbs-5
# ... 인터페이스 설계 리뷰 ...

# 3단계: Stripe 구현
node skills/wbs/wbs.js job next wbs-5
# ... Stripe 테스트 결제 실행 ...

# 4단계: PayPal & Toss 구현
node skills/wbs/wbs.js job next wbs-5

# 5단계: 환불 로직
node skills/wbs/wbs.js job next wbs-5

# 6단계: 프론트엔드 UI
node skills/wbs/wbs.js job next wbs-5

# 7단계: 통합 테스트
node skills/wbs/wbs.js job next wbs-5

# 8단계: 문서화
node skills/wbs/wbs.js job next wbs-5
```

### 시나리오 C: 실패 및 재실행

Job 3 (Stripe 구현)이 실패한 경우 재실행합니다.

```bash
# 현재 상태 확인
node skills/wbs/wbs.js status wbs-5
```

**출력:**
```
📋 E-Commerce 결제 시스템 구축 (wbs-5)
   Status: in_progress | Progress: 25% (2/8)

   Jobs:
   | 상태 | #  | ID      | 작업명                                  | 담당           |
   |------|----|---------|-----------------------------------------|----------------|
   | ✅   | 1  | job-10  | 데이터베이스 스키마 및 마이그레이션 작성    | @claude:sonnet |
   | ✅   | 2  | job-11  | 결제 게이트웨이 추상화 레이어 구현         | @claude:opus   |
   | ❌   | 3  | job-12  | Stripe 결제 처리 구현                    | @copilot       |
   | ⬜️  | 4  | job-13  | PayPal 및 Toss Payments 구현            | @copilot       |
   | ⬜️  | 5  | job-14  | 환불 처리 및 부분 환불 구현               | @claude:sonnet |
   | ⬜️  | 6  | job-15  | React 결제 UI 컴포넌트 작성              | @claude:sonnet |
   | ⬜️  | 7  | job-16  | 통합 테스트 및 에러 처리 강화             | @copilot       |
   | ⬜️  | 8  | job-17  | API 문서화 및 배포 준비                  | @claude:haiku  |
```

실패 원인 조사:

```bash
# 실행 이력 확인
node skills/wbs/wbs.js exec list job-12
```

**출력:**
```
📋 Executions for job-12

| 상태 | ID      | PID   | 시작                | 종료                | 코드 | 메시지           |
|------|---------|-------|---------------------|---------------------|------|------------------|
| ❌   | exec-47 | 87260 | 2025-12-18 15:30:00 | 2025-12-18 15:55:00 | 1    | API key not found|
```

실패한 Job 재실행:

```bash
# 환경변수 설정 후 재실행
export STRIPE_SECRET_KEY=sk_test_...
node skills/wbs/wbs.js job retry job-12
```

**출력:**
```
[WBS] Retrying job: Stripe 결제 처리 구현
[WBS] Agent: @copilot
[WBS] New execution ID: exec-48
[WBS] PID: 87301
──────────────────────────────────────────────────

... (Agent 실행) ...

[WBS] Job completed: job-12
✅ Stripe 결제 처리 구현 성공!
```

---

## 5단계: GitHub Issue 연동 시나리오

프로젝트 진행 중 긴급 버그가 발견되어 Issue가 생성되었습니다.

### Issue 연동 Job 추가

```bash
# GitHub에 Issue #156 생성됨: "Stripe webhook signature 검증 실패"
node skills/wbs/wbs.js job add wbs-5 \
  --title "Stripe webhook signature 검증 버그 수정" \
  --agent "@claude:sonnet" \
  --seq 3.5 \
  --issue 156 \
  --desc "Stripe webhook endpoint에서 signature 검증이 실패하는 문제 수정. stripe.webhooks.constructEvent 사용. 환경변수 STRIPE_WEBHOOK_SECRET 설정 확인."
```

**출력:**
```json
{
  "jobId": "job-18",
  "wbsId": "wbs-5",
  "title": "Stripe webhook signature 검증 버그 수정",
  "agent": "@claude:sonnet",
  "seq": 3.5,
  "issue_number": 156
}
```

### Issue 연동 Job 실행

Issue가 있는 Job은 자동으로 GitHub 워크플로우를 따릅니다:

```bash
node skills/wbs/wbs.js job next wbs-5
```

**실행 시 자동으로 포함되는 정보:**
```
[WBS] Running job: Stripe webhook signature 검증 버그 수정
[WBS] GitHub Issue: #156
[WBS] Issue URL: https://github.com/your-org/your-repo/issues/156

## GitHub Issue #156 정보

Title: Stripe webhook signature 검증 실패
Body: 프로덕션 환경에서 Stripe webhook 이벤트 처리 시 signature 검증이 실패합니다...
Labels: bug, priority-high
Assignee: @john-doe

... (Agent가 Issue 정보를 참고하여 작업 수행) ...
```

작업 완료 후 자동으로 Issue에 코멘트가 추가됩니다.

---

## 6단계: 자연어 인터페이스 활용

### 진행 상황 확인

```bash
node skills/wbs/wbs.js q "wbs-5 프로젝트 진행 상황 어때?"
```

**코디네이터 응답:**
```
E-Commerce 결제 시스템 구축 프로젝트 진행 상황입니다:

✅ 완료: 3개 (37.5%)
  - 데이터베이스 스키마 및 마이그레이션 작성
  - 결제 게이트웨이 추상화 레이어 구현
  - Stripe webhook signature 검증 버그 수정

🟡 진행중: 1개
  - Stripe 결제 처리 구현 (재실행 중)

⬜️ 대기: 4개

예상 남은 시간: 약 3시간 15분

다음 작업: PayPal 및 Toss Payments 구현 (@copilot)
```

### 실패 작업 재실행 요청

```bash
node skills/wbs/wbs.js x "wbs-5의 실패한 작업 재실행해줘"
```

**코디네이터 응답:**
```
실패한 작업을 재실행합니다...

[실행] job-12: Stripe 결제 처리 구현
  - Agent: @copilot
  - 실행 ID: exec-48

재실행 완료! 결과를 확인하세요:
node skills/wbs/wbs.js exec status exec-48
```

### 특정 작업 담당자 변경

```bash
node skills/wbs/wbs.js x "job-16의 담당자를 @claude:opus로 변경해줘"
```

**코디네이터 응답:**
```
job-16 (통합 테스트 및 에러 처리 강화)의 담당자를 변경합니다:
  - 기존: @copilot
  - 변경: @claude:opus

변경 완료!
```

---

## 7단계: 백그라운드 데몬 활용

데몬을 실행하여 자동으로 작업을 관리합니다.

### 데몬 시작

```bash
node skills/wbs/wbs.js daemon start
```

**출력:**
```
🚀 WBS Daemon started
   PID: 87450
   Check interval: 5 minutes

Monitoring:
  - Zombie process detection (timeout: 30 minutes)
  - Auto-execution of pending jobs
  - Status updates

Log: /var/log/wbs-daemon.log
```

### 데몬 동작 확인

5분마다 다음 작업을 수행합니다:

1. **좀비 프로세스 감지**: 30분 이상 실행 중이거나 프로세스가 죽은 경우 정리
2. **대기 중인 Job 자동 실행**: `pending` 상태의 다음 Job 실행

**데몬 로그 예시:**
```
[2025-12-18 16:05:00] Checking for zombie processes...
[2025-12-18 16:05:00] Found 1 zombie: exec-49 (PID 87301, runtime 32m)
[2025-12-18 16:05:00] Killing zombie process 87301
[2025-12-18 16:05:01] Marked exec-49 as failed
[2025-12-18 16:05:01] Checking for pending jobs...
[2025-12-18 16:05:01] Found pending job: job-13 (wbs-5)
[2025-12-18 16:05:01] Starting job-13: PayPal 및 Toss Payments 구현
[2025-12-18 16:05:02] New execution: exec-50 (PID 87520)
```

### 데몬 상태 확인

```bash
node skills/wbs/wbs.js daemon status
```

**출력:**
```
📊 WBS Daemon Status

Status: ✅ Running
PID: 87450
Uptime: 2h 15m
Last check: 2025-12-18 16:05:00

Statistics:
  - Jobs executed: 5
  - Zombies cleaned: 1
  - Errors: 0

Current activity:
  - Running: job-13 (exec-50, PID 87520)
  - Pending jobs: 4
```

### 데몬 중지

```bash
node skills/wbs/wbs.js daemon stop
```

**출력:**
```
🛑 Stopping WBS Daemon (PID 87450)...
✅ Daemon stopped successfully
```

---

## 8단계: 실행 이력 및 분석

### 특정 Job의 실행 이력

```bash
node skills/wbs/wbs.js exec list job-12
```

**출력:**
```
📋 Executions for job-12 (Stripe 결제 처리 구현)

| 상태 | ID      | PID   | 시작                | 종료                | 코드 | 소요시간 |
|------|---------|-------|---------------------|---------------------|------|----------|
| ❌   | exec-47 | 87260 | 2025-12-18 15:30:00 | 2025-12-18 15:55:00 | 1    | 25m      |
| ✅   | exec-48 | 87301 | 2025-12-18 16:10:00 | 2025-12-18 16:45:00 | 0    | 35m      |
```

### 특정 실행의 상세 정보

```bash
node skills/wbs/wbs.js exec status exec-48
```

**출력:**
```
📋 Execution Details: exec-48

Job: job-12 (Stripe 결제 처리 구현)
WBS: wbs-5 (E-Commerce 결제 시스템 구축)
Agent: @copilot

Status: ✅ completed
Exit code: 0

Timeline:
  - Started: 2025-12-18 16:10:00
  - Completed: 2025-12-18 16:45:00
  - Duration: 35m 12s

Process:
  - PID: 87301
  - Command: crewx execute "@copilot ..."

Output files:
  - worktree/feature/wbs-5-12/src/payment/stripe-gateway.ts
  - worktree/feature/wbs-5-12/src/webhooks/stripe-handler.ts
  - worktree/feature/wbs-5-12/tests/stripe-gateway.test.ts

Git:
  - Branch: feature/wbs-5-12
  - Commits: 3
  - Pull Request: #245 (merged)
```

### 실행 중인 모든 Job 조회

```bash
node skills/wbs/wbs.js exec running
```

**출력:**
```
🟡 Running Executions (2)

| ID      | Job ID  | 작업명                          | Agent          | PID   | 시작       | 경과시간 |
|---------|---------|--------------------------------|----------------|-------|------------|----------|
| exec-50 | job-13  | PayPal 및 Toss Payments 구현    | @copilot       | 87520 | 16:05:00   | 12m      |
| exec-51 | job-14  | 환불 처리 및 부분 환불 구현       | @claude:sonnet | 87545 | 16:15:00   | 2m       |
```

### 특정 실행 강제 종료

```bash
node skills/wbs/wbs.js exec kill exec-50
```

**출력:**
```
🛑 Killing execution: exec-50
   Job: job-13 (PayPal 및 Toss Payments 구현)
   PID: 87520

Sending SIGTERM...
Process killed successfully.

Execution marked as failed.
Reason: Manually killed by user
```

---

## 9단계: JSON 출력 및 자동화 스크립트

모든 명령어는 `--json` 플래그를 지원하여 자동화 스크립트에 활용할 수 있습니다.

### 프로젝트 목록 JSON

```bash
node skills/wbs/wbs.js list --json | jq
```

**출력:**
```json
[
  {
    "id": "wbs-5",
    "title": "E-Commerce 결제 시스템 구축",
    "status": "in_progress",
    "detail_path": "skills/wbs/details/wbs-5-detail.md",
    "created_at": "2025-12-18T14:00:00.000Z",
    "job_count": 8,
    "completed_jobs": 3,
    "progress": 37.5
  }
]
```

### 특정 프로젝트 상태 JSON

```bash
node skills/wbs/wbs.js status wbs-5 --json | jq
```

**출력:**
```json
{
  "project": {
    "id": "wbs-5",
    "title": "E-Commerce 결제 시스템 구축",
    "status": "in_progress",
    "detail_path": "skills/wbs/details/wbs-5-detail.md",
    "progress": 37.5
  },
  "jobs": [
    {
      "id": "job-10",
      "title": "데이터베이스 스키마 및 마이그레이션 작성",
      "status": "completed",
      "agent": "@claude:sonnet",
      "seq": 1
    },
    {
      "id": "job-11",
      "title": "결제 게이트웨이 추상화 레이어 구현",
      "status": "completed",
      "agent": "@claude:opus",
      "seq": 2
    }
  ]
}
```

### Job 목록 JSON

```bash
node skills/wbs/wbs.js job list wbs-5 --json | jq
```

### 자동화 스크립트 예시

실패한 모든 Job을 자동으로 재실행하는 스크립트:

```bash
#!/bin/bash
# retry-failed-jobs.sh

WBS_ID=$1

if [ -z "$WBS_ID" ]; then
  echo "Usage: $0 <wbs-id>"
  exit 1
fi

# 실패한 Job 목록 가져오기
FAILED_JOBS=$(node skills/wbs/wbs.js job list $WBS_ID --json | \
  jq -r '.[] | select(.status == "failed") | .id')

if [ -z "$FAILED_JOBS" ]; then
  echo "No failed jobs found for $WBS_ID"
  exit 0
fi

echo "Retrying failed jobs for $WBS_ID..."
echo "$FAILED_JOBS" | while read JOB_ID; do
  echo "Retrying $JOB_ID..."
  node skills/wbs/wbs.js job retry $JOB_ID

  # 각 Job 사이에 10초 대기
  sleep 10
done

echo "All failed jobs have been retried."
```

실행:

```bash
chmod +x retry-failed-jobs.sh
./retry-failed-jobs.sh wbs-5
```

---

## 10단계: 프로젝트 완료 및 결과 확인

### 최종 상태 확인

```bash
node skills/wbs/wbs.js status wbs-5
```

**출력:**
```
📋 E-Commerce 결제 시스템 구축 (wbs-5)
   Status: completed | Progress: 100% (8/8)
   Detail: skills/wbs/details/wbs-5-detail.md

   Jobs:
   | 상태 | #  | ID      | 작업명                                  | 담당           | 소요시간 |
   |------|----|---------|-----------------------------------------|----------------|----------|
   | ✅   | 1  | job-10  | 데이터베이스 스키마 및 마이그레이션 작성    | @claude:sonnet | 30m      |
   | ✅   | 2  | job-11  | 결제 게이트웨이 추상화 레이어 구현         | @claude:opus   | 40m      |
   | ✅   | 3  | job-12  | Stripe 결제 처리 구현                    | @copilot       | 35m      |
   | ✅   | 3.5| job-18  | Stripe webhook signature 검증 버그 수정  | @claude:sonnet | 15m      |
   | ✅   | 4  | job-13  | PayPal 및 Toss Payments 구현            | @copilot       | 42m      |
   | ✅   | 5  | job-14  | 환불 처리 및 부분 환불 구현               | @claude:sonnet | 28m      |
   | ✅   | 6  | job-15  | React 결제 UI 컴포넌트 작성              | @claude:sonnet | 45m      |
   | ✅   | 7  | job-16  | 통합 테스트 및 에러 처리 강화             | @claude:opus   | 38m      |
   | ✅   | 8  | job-17  | API 문서화 및 배포 준비                  | @claude:haiku  | 22m      |

   총 소요 시간: 4시간 55분
```

### 프로젝트 산출물 확인

```bash
# 생성된 파일 확인
ls -la worktree/feature/wbs-5-*/

# Git 브랜치 확인
git branch | grep wbs-5

# Pull Request 목록
gh pr list | grep wbs-5
```

### 프로젝트 정리

프로젝트 완료 후 상태를 `completed`로 업데이트:

```bash
node skills/wbs/wbs.js update wbs-5 --status completed
```

---

## 고급 활용 패턴

### 패턴 1: 병렬 작업 분해

독립적인 작업은 같은 `seq` 번호를 부여하여 병렬 실행 가능:

```bash
# 프론트엔드와 백엔드를 병렬로 개발
node skills/wbs/wbs.js job add wbs-6 --title "백엔드 API 개발" --agent "@copilot" --seq 2
node skills/wbs/wbs.js job add wbs-6 --title "프론트엔드 UI 개발" --agent "@claude:sonnet" --seq 2
```

### 패턴 2: 조건부 작업 추가

특정 Job 완료 후 동적으로 추가 작업 생성:

```bash
# Job 3 완료 후 버그 발견 시
node skills/wbs/wbs.js job add wbs-5 --title "버그 수정" --agent "@claude:sonnet" --seq 3.1
```

### 패턴 3: 시간 추적 및 분석

```bash
# 전체 프로젝트 시간 분석
node skills/wbs/wbs.js status wbs-5 --json | \
  jq '.jobs[] | {title: .title, agent: .agent, duration: .duration}' | \
  jq -s 'group_by(.agent) | map({agent: .[0].agent, total: map(.duration) | add})'
```

**출력:**
```json
[
  {
    "agent": "@claude:sonnet",
    "total": "1h 58m"
  },
  {
    "agent": "@claude:opus",
    "total": "1h 18m"
  },
  {
    "agent": "@copilot",
    "total": "1h 17m"
  },
  {
    "agent": "@claude:haiku",
    "total": "22m"
  }
]
```

### 패턴 4: 알림 연동

Slack webhook으로 Job 완료 알림:

```bash
#!/bin/bash
# notify-completion.sh

WBS_ID=$1
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."

node skills/wbs/wbs.js status $WBS_ID --json | \
  jq -r '{text: "WBS \(.project.id) completed: \(.project.progress)%"}' | \
  curl -X POST -H 'Content-type: application/json' --data @- $SLACK_WEBHOOK_URL
```

---

## 트러블슈팅

### 문제 1: Job이 무한 대기

**증상:**
```bash
node skills/wbs/wbs.js exec running
# exec-55가 2시간째 실행 중
```

**원인:**
- Agent가 사용자 입력을 기다리는 경우
- 네트워크 타임아웃
- 무한 루프

**해결:**
```bash
# 프로세스 강제 종료
node skills/wbs/wbs.js exec kill exec-55

# Job 재실행 (--desc 수정)
node skills/wbs/wbs.js job update job-20 --desc "수정된 지시사항"
node skills/wbs/wbs.js job retry job-20
```

### 문제 2: Agent가 잘못된 파일 수정

**증상:**
Job 완료 후 예상과 다른 파일이 수정됨

**해결:**
```bash
# 1. Git 변경사항 확인
cd worktree/feature/wbs-5-20
git diff

# 2. 잘못된 변경사항 되돌리기
git reset --hard HEAD

# 3. Job description 명확히 수정
node skills/wbs/wbs.js job update job-20 \
  --desc "ONLY modify src/payment/stripe-gateway.ts. DO NOT touch other files."

# 4. 재실행
node skills/wbs/wbs.js job retry job-20
```

### 문제 3: 데몬이 응답하지 않음

**증상:**
```bash
node skills/wbs/wbs.js daemon status
# Error: Daemon not responding
```

**해결:**
```bash
# 1. 프로세스 확인
ps aux | grep wbs-daemon

# 2. 강제 종료
kill -9 <PID>

# 3. 재시작
node skills/wbs/wbs.js daemon start
```

---

## 베스트 프랙티스

### 1. 작업 분해 원칙

- **15-45분 규칙**: 각 Job은 15~45분 내에 완료 가능하도록 설계
- **단일 책임**: 한 Job은 하나의 명확한 목표만 가짐
- **의존성 명시**: `seq`를 통해 실행 순서 명확히 정의

### 2. Agent 선택 가이드

| Agent | 적합한 작업 | 예시 |
|-------|------------|------|
| `@claude:opus` | 복잡한 아키텍처 설계, 어려운 문제 | 추상화 레이어 설계, 복잡한 알고리즘 |
| `@claude:sonnet` | 일반적인 개발 작업 | API 구현, 데이터 모델링, UI 컴포넌트 |
| `@claude:haiku` | 간단한 작업, 문서화 | README 작성, 단순 버그 수정 |
| `@copilot` | 코드 구현, 테스트 작성 | 테스트 코드, CRUD API |
| `@gemini` | 데이터 분석, 최적화 | 성능 분석, 쿼리 최적화 |

### 3. 상세 문서 작성

`details/` 문서에 다음 정보를 포함:

- **기술 스택**: 사용할 라이브러리, 프레임워크, 버전
- **데이터 모델**: 스키마, 관계, 제약조건
- **API 설계**: 엔드포인트, 요청/응답 형식
- **참고 자료**: 공식 문서, 튜토리얼 링크

### 4. 진행 상황 모니터링

```bash
# 매일 아침 체크
node skills/wbs/wbs.js list

# 프로젝트별 상세 확인
node skills/wbs/wbs.js status wbs-5

# 실패한 작업 확인
node skills/wbs/wbs.js job list wbs-5 --json | jq '.[] | select(.status=="failed")'
```

### 5. Git 브랜치 관리

- WBS Job마다 별도 브랜치 생성 (`feature/wbs-{id}-{job-id}`)
- 각 Job 완료 시 PR 생성 및 리뷰
- main 브랜치로 병합 후 다음 Job 진행

---

## 요약

이 예제는 다음 내용을 다룹니다:

✅ **8개 Job 생성** (요구사항: 5개 이상)
✅ **다양한 Agent 활용** (@claude:opus, @claude:sonnet, @claude:haiku, @copilot)
✅ **의존성 관리** (seq를 통한 실행 순서)
✅ **GitHub Issue 연동** (job-18)
✅ **실패 처리 및 재실행** (retry)
✅ **백그라운드 데몬** (자동 실행 관리)
✅ **자연어 인터페이스** (q/x 명령어)
✅ **JSON 출력 및 자동화** (스크립트 연동)
✅ **실행 이력 추적** (exec list/status)
✅ **프로세스 관리** (kill, zombie detection)

## 다음 단계

- [SKILL.md](./SKILL.md) - WBS 스킬 전체 문서
- [COMMANDS.md](./COMMANDS.md) - 명령어 레퍼런스
- [EXAMPLE.md](./EXAMPLE.md) - 기본 예제
- [job-management.md](./job-management.md) - Job 관리 가이드
