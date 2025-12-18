# 기술 스택 검토: better-sqlite3 + WAL Mode

**WBS**: wbs-4
**Job**: job-8
**작성일**: 2025-12-18
**작성자**: CrewX Developer Agent

---

## 1. Executive Summary

| 항목 | 평가 | 비고 |
|------|------|------|
| better-sqlite3 호환성 | ✅ 적합 | Node.js 22 LTS 완벽 지원 |
| WAL 모드 동시성 | ✅ 적합 | 단일 프로세스 환경에 적합 |
| 성능 테스트 필요성 | ⚠️ 선택적 | 프로토타입 단계에서는 불필요 |

**결론**: better-sqlite3 + WAL 모드는 CrewX 프로젝트의 로컬 데이터 저장소로 **적합**합니다.

---

## 2. better-sqlite3 패키지 호환성 분석

### 2.1 패키지 정보

| 항목 | 값 |
|------|------|
| 최신 버전 | 12.5.0 (2025-12) |
| npm 주간 다운로드 | ~2,431개 프로젝트에서 사용 |
| 라이선스 | MIT |
| TypeScript 지원 | `@types/better-sqlite3` 제공 |

### 2.2 Node.js 버전 호환성

| Node.js 버전 | 호환성 | 비고 |
|--------------|--------|------|
| v22.x (LTS) | ✅ 완벽 지원 | **권장** |
| v20.x (LTS) | ✅ 지원 | 안정적 |
| v24.x | ❌ 미지원 | V8 API 변경으로 빌드 실패 |

**참고**: Node.js 22에서는 built-in SQLite 모듈(`node:sqlite`)이 실험적으로 제공되나, better-sqlite3가 더 성숙하고 안정적입니다.

### 2.3 설치 시 주의사항

```bash
# native module이므로 prebuild 바이너리 사용
npm install better-sqlite3

# 빌드 도구 필요 (prebuild 없을 시)
# - macOS: Xcode Command Line Tools
# - Linux: build-essential
# - Windows: windows-build-tools
```

**NODE_MODULE_VERSION 불일치 오류 해결**:
```bash
npm rebuild better-sqlite3
# 또는
rm -rf node_modules && npm install
```

---

## 3. SQLite WAL 모드 동시성 검증

### 3.1 WAL (Write-Ahead Logging) 모드란?

WAL은 SQLite의 저널링 모드로, 기본 롤백 저널 방식보다 더 나은 동시성을 제공합니다.

```javascript
const Database = require('better-sqlite3');
const db = new Database('crewx.sqlite');

// WAL 모드 활성화
db.pragma('journal_mode = WAL');
```

### 3.2 동시성 특성

| 특성 | 기본 모드 | WAL 모드 |
|------|-----------|----------|
| 동시 읽기 | ❌ 제한적 | ✅ 무제한 |
| 읽기 + 쓰기 동시 | ❌ 블로킹 | ✅ 가능 |
| 동시 쓰기 | ❌ 1개 | ❌ 1개 |

### 3.3 핵심 제약사항

#### ⚠️ 단일 Writer 제한
```
SQLite WAL 모드는 무제한 Reader를 지원하지만,
Writer는 항상 1개만 허용됩니다.
```

- **영향**: 동시에 여러 프로세스가 쓰기 시도 시 대기 발생
- **CrewX 적용**: CLI 도구로 단일 프로세스 사용 → **문제 없음**

#### ⚠️ 네트워크 파일시스템 미지원
```
WAL 모드는 동일 호스트의 프로세스들만 지원합니다.
NFS, SMB 등 네트워크 파일시스템에서는 동작하지 않습니다.
```

- **CrewX 적용**: 로컬 파일시스템 사용 → **문제 없음**

### 3.4 권장 PRAGMA 설정

```javascript
const db = new Database('crewx.sqlite');

// 필수: WAL 모드 활성화
db.pragma('journal_mode = WAL');

// 권장: 쓰기 성능과 안전성 균형
db.pragma('synchronous = NORMAL');

// 권장: 락 대기 시간 (ms)
db.pragma('busy_timeout = 5000');

// 선택: 메모리 캐시 크기 (페이지 수, 음수는 KB)
db.pragma('cache_size = -64000');  // 64MB
```

---

## 4. better-sqlite3 성능 특성

### 4.1 벤치마크 결과 (공식)

better-sqlite3 vs sqlite3 (node-sqlite3):

| 작업 | 성능 향상 |
|------|-----------|
| 단일 행 SELECT | **11.7배** 빠름 |
| 100행 SELECT | **2.9배** 빠름 |
| 행 이터레이션 | **24.4배** 빠름 |
| 단일 INSERT | **2.8배** 빠름 |
| 배치 트랜잭션 | **15.6배** 빠름 |

**참고**: 60GB 데이터베이스에서 5-way JOIN 쿼리 초당 2,000회 이상 처리 가능

### 4.2 동기식 API의 장점

```javascript
// better-sqlite3 (동기식 - 권장)
const row = db.prepare('SELECT * FROM users WHERE id = ?').get(1);

// sqlite3 (비동기식 - 복잡)
db.get('SELECT * FROM users WHERE id = ?', [1], (err, row) => {
  // callback hell...
});
```

**왜 동기식이 더 좋은가?**
1. SQLite 자체가 직렬화된 작업에 최적화
2. 불필요한 async 오버헤드 제거
3. 코드 복잡도 감소
4. 에러 처리 단순화

### 4.3 Worker Thread 지원

대용량/느린 쿼리는 Worker Thread로 오프로드 가능:

```javascript
// heavy-query.js (worker)
const { parentPort, workerData } = require('worker_threads');
const Database = require('better-sqlite3');

const db = new Database(workerData.dbPath, { readonly: true });
const result = db.prepare(workerData.query).all();
parentPort.postMessage(result);
```

---

## 5. 성능 테스트 필요 여부 판단

### 5.1 분석

| 요소 | 현재 상황 | 테스트 필요성 |
|------|-----------|---------------|
| 사용 패턴 | CLI 도구, 단일 사용자 | 낮음 |
| 데이터 규모 | 설정/히스토리 수백~수천 행 | 낮음 |
| 동시성 요구 | 단일 프로세스 | 낮음 |
| 벤치마크 데이터 | 공식 벤치마크 존재 | 중복 불필요 |

### 5.2 결론

```
⚠️ 현 단계에서 별도 성능 테스트는 불필요합니다.

이유:
1. better-sqlite3는 이미 충분히 검증된 라이브러리
2. CrewX 사용 사례(CLI, 단일 사용자)는 성능 병목 가능성 낮음
3. 프로토타입 단계에서 조기 최적화는 비효율적

향후 필요 시점:
- 데이터가 10만 행 이상 증가할 경우
- 복잡한 JOIN 쿼리가 추가될 경우
- 사용자 피드백으로 성능 이슈 리포트 시
```

---

## 6. CrewX 프로젝트 적용 권장사항

### 6.1 초기 설정 코드

```typescript
// packages/cli/src/database/database.service.ts
import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import * as path from 'path';
import * as os from 'os';

export class DatabaseService {
  private db: DatabaseType;

  constructor() {
    const dbPath = path.join(os.homedir(), '.crewx', 'crewx.sqlite');
    this.db = new Database(dbPath);
    this.initializePragmas();
    this.initializeSchema();
  }

  private initializePragmas(): void {
    // WAL 모드 활성화 (필수)
    this.db.pragma('journal_mode = WAL');

    // 쓰기 성능 최적화
    this.db.pragma('synchronous = NORMAL');

    // 락 대기 시간 5초
    this.db.pragma('busy_timeout = 5000');

    // 외래키 제약 활성화
    this.db.pragma('foreign_keys = ON');
  }

  private initializeSchema(): void {
    // 마이그레이션 로직
  }

  close(): void {
    this.db.close();
  }
}
```

### 6.2 의존성 추가

```json
// package.json
{
  "dependencies": {
    "better-sqlite3": "^12.5.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.11"
  }
}
```

### 6.3 Node.js 버전 제약

```json
// package.json
{
  "engines": {
    "node": ">=20.0.0 <24.0.0"
  }
}
```

---

## 7. 리스크 및 대안

### 7.1 식별된 리스크

| 리스크 | 영향도 | 대응 방안 |
|--------|--------|-----------|
| Node.js 24 미지원 | 낮음 | LTS(22) 사용 권장 |
| Native 모듈 빌드 실패 | 중간 | prebuild 바이너리 제공, 빌드 가이드 문서화 |
| WAL 파일 무한 증가 | 낮음 | 정기 checkpoint, 앱 종료 시 checkpoint |

### 7.2 대안 기술

| 대안 | 장점 | 단점 |
|------|------|------|
| node:sqlite (built-in) | 의존성 없음 | 실험적, API 미성숙 |
| sql.js (WASM) | Native 빌드 불필요 | 성능 저하, 메모리 제약 |
| LevelDB | 빠른 KV 저장소 | 관계형 쿼리 미지원 |

**결론**: better-sqlite3가 CrewX 요구사항에 가장 적합합니다.

---

## 8. References

- [better-sqlite3 npm](https://www.npmjs.com/package/better-sqlite3)
- [better-sqlite3 GitHub](https://github.com/WiseLibs/better-sqlite3)
- [SQLite WAL Mode Documentation](https://sqlite.org/wal.html)
- [SQLite BEGIN CONCURRENT (Experimental)](https://www.sqlite.org/src/doc/begin-concurrent/doc/begin_concurrent.md)
- [How SQLite Scales Read Concurrency - Fly.io](https://fly.io/blog/sqlite-internals-wal/)
- [Node.js 22 Core SQLite Discussion](https://github.com/WiseLibs/better-sqlite3/discussions/1245)

---

## 9. Appendix: 체크리스트

### 구현 전 확인사항

- [x] better-sqlite3 Node.js 22 호환성 확인
- [x] WAL 모드 동시성 제약 이해
- [x] TypeScript 타입 지원 확인
- [ ] 빌드 환경 요구사항 문서화 (추후)
- [ ] 마이그레이션 전략 수립 (추후)

### 코드 리뷰 체크포인트

- [ ] WAL 모드 pragma 설정 여부
- [ ] busy_timeout 설정 여부
- [ ] 적절한 연결 종료 (close) 처리
- [ ] 에러 핸들링 (SQLITE_BUSY 등)
