# WBS-33: Template 서브커맨드 개선

> **목표**: `crewx template` 서브커맨드 개선 (파일 보호 + 동적 리스트)
> **상태**: ⬜️ 대기
> **우선순위**: P2
> **예상 소요**: 2-3시간 (AI 작업 기준)
> **전제 조건**: WBS-32 완료

---

## 📋 목차

1. [개요](#개요)
2. [핵심 전략](#핵심-전략)
3. [Phase 구성](#phase-구성)
4. [Phase 1: 파일 덮어쓰기 방지](#phase-1-파일-덮어쓰기-방지-1-15시간)
5. [Phase 2: 동적 템플릿 리스트](#phase-2-동적-템플릿-리스트-1-15시간)
6. [성공 기준 요약](#성공-기준-요약)
7. [참고 문서](#참고-문서)

---

## 개요

### 배경
- **문제 1**: WBS-32에서 구현된 `crewx template init`이 기존 파일을 무조건 덮어씀 (`force: true` 고정)
- **문제 2**: 템플릿 리스트가 하드코딩되어 있음 (GitHub에서 동적으로 읽지 않음)
- **해결**: crewx-quickstart 프로젝트의 검증된 패턴 적용

### 목표
1. **단기**: 파일 덮어쓰기 방지 + 동적 템플릿 리스트 (2-3시간)
2. **중기**: 사용자 데이터 보호 + 회사 템플릿 저장소 동적 지원
3. **장기**: 완전 자동화된 템플릿 시스템 (AI 커스터마이징은 별도 WBS)

---

## 핵심 전략

### 1. crewx-quickstart 검증 패턴 적용

**참고 프로젝트**: `crewx-quickstart` (검증된 구현)

**핵심 메커니즘**:
```typescript
// writeFileIfMissing() 함수
function writeFileIfMissing(filePath: string, content: string, force: boolean = false) {
  if (existsSync(filePath) && !force) {
    console.log(`⚠️ Skipping existing file: ${filePath}`);
    return false;
  }

  writeFileSync(filePath, content);
  console.log(`✅ Created ${filePath}`);
  return true;
}
```

**장점**:
- ✅ 기존 파일 보호 (사용자 데이터 손실 방지)
- ✅ 명확한 피드백 (생성/스킵 파일 안내)
- ✅ `--force` 옵션으로 유연성 확보

### 2. 동적 템플릿 리스트 (GitHub JSON Fetch)

**현재 문제**:
- 템플릿 리스트가 CLI 코드에 하드코딩
- 새 템플릿 추가 시 CLI 재배포 필요
- 환경변수로 저장소 변경해도 리스트 동적으로 안 바뀜

**해결 방안**:
```typescript
// GitHub에서 templates.json을 fetch
async function handleTemplateList() {
  const repo = process.env.CREWX_TEMPLATE_REPO ||
    'https://github.com/sowonlabs/crewx-templates';

  const templatesJson = await fetchTemplatesJson(repo);

  for (const template of templatesJson.templates) {
    console.log(`  • ${template.id} - ${template.description}`);
  }
}
```

**templates.json 스키마**:
```json
{
  "version": "1.0.0",
  "templates": [
    {
      "id": "wbs-automation",
      "displayName": "WBS Automation",
      "description": "WBS project automation template",
      "category": "automation"
    },
    {
      "id": "docusaurus-i18n",
      "displayName": "Docusaurus i18n",
      "description": "Docusaurus documentation with i18n support",
      "category": "documentation"
    }
  ]
}
```

---

## Phase 구성

**일정**: 2-3시간 (AI 작업 기준)

| Phase | 작업 | 소요 | 산출물 | 상태 |
|-------|------|------|--------|------|
| **Phase 1** | **파일 덮어쓰기 방지** | **1-1.5시간** | **crewx-quickstart 패턴 적용** | **⬜️ 대기** |
| **Phase 2** | **동적 템플릿 리스트** | **1-1.5시간** | **templates.json fetch** | **⬜️ 대기** |

---

## Phase 1: 파일 덮어쓰기 방지 (1-1.5시간)

**목표**: crewx-quickstart 방식 적용 - 기존 파일 보호 + 생성 파일 안내

**현재 구현의 문제점**:
```typescript
// packages/cli/src/services/template.service.ts
await downloadTemplate(fullSource, {
  force: true,        // ⚠️ 무조건 덮어씀!
});
```

**구현 작업** (15분 단위):

1. **giget force 옵션 변경** (15분)
   - `force: true` → `force: false`로 변경
   - `template.service.ts` 수정

2. **개별 파일 체크 로직** (30분)
   - giget 다운로드 후 각 파일 검증
   - 기존 파일 존재 시 스킵
   - `writeFileIfMissing()` 유틸 함수 추가

3. **생성/스킵 파일 안내** (15분)
   - 생성된 파일 목록 출력
   - 스킵된 파일 목록 출력
   - `createdCount`, `skippedCount` 추적

4. **--force 플래그 지원** (15분)
   - CLI 옵션에 `--force` 추가
   - force 모드 시 덮어쓰기 허용

5. **테스트** (15분)
   - 빈 디렉토리에서 테스트
   - 기존 파일이 있는 디렉토리에서 테스트
   - `--force` 플래그 테스트

**성공 기준**:
- ✅ 기존 파일이 있으면 스킵 (기본 동작)
- ✅ 스킵된 파일 메시지 출력
- ✅ 생성된 파일 개수 안내
- ✅ `--force` 플래그로 덮어쓰기 가능

**예상 출력**:
```bash
$ crewx template init wbs-automation

📦 Downloading template: wbs-automation
📋 Repository: https://github.com/sowonlabs/crewx-templates

✅ Created crewx.yaml
✅ Created wbs.md
⚠️ Skipping existing file: README.md
✅ Created wbs-loop.sh

📊 Summary:
  Created: 3 files
  Skipped: 1 files

ℹ️ Some files were skipped. Use --force to overwrite.
```

---

## Phase 2: 동적 템플릿 리스트 (1-1.5시간)

**목표**: GitHub에서 templates.json을 동적으로 읽어서 리스트 표시

**현재 구현의 문제점**:
```typescript
// packages/cli/src/cli/template.handler.ts - 하드코딩
console.log('  • wbs-automation     - WBS project automation template');
console.log('  • docusaurus-i18n    - Docusaurus documentation with i18n support');
```

**구현 작업** (15분 단위):

1. **templates.json 스키마 정의** (15분)
   - JSON 스키마 문서화
   - 템플릿 저장소에 `templates.json` 추가

2. **GitHub raw URL fetch 함수** (20분)
   - `fetchTemplatesJson()` 함수 추가
   - GitHub raw content URL 생성
   - fetch API로 JSON 다운로드
   - 에러 처리 (네트워크, 파싱)

3. **handleTemplateList() 리팩토링** (20분)
   - 하드코딩 제거
   - templates.json 기반 출력
   - 카테고리별 그룹핑 (선택)

4. **캐싱 로직 추가** (15분)
   - 15분 캐시
   - `~/.crewx/cache/templates.json`

5. **Fallback 전략** (10분)
   - GitHub fetch 실패 시 기본 리스트 표시
   - 오프라인 모드 지원

6. **테스트** (10분)
   - 기본 저장소에서 리스트 가져오기
   - 환경변수로 저장소 변경 테스트
   - 네트워크 에러 시 fallback 테스트

**성공 기준**:
- ✅ GitHub에서 templates.json 동적 fetch
- ✅ 환경변수로 저장소 변경 가능
- ✅ 캐싱으로 빠른 응답
- ✅ 오프라인 시 fallback 동작

**예상 출력**:
```bash
$ crewx template list

📦 Available templates:
📋 Repository: https://github.com/sowonlabs/crewx-templates

Automation:
  • wbs-automation       - WBS project automation template

Documentation:
  • docusaurus-i18n      - Docusaurus documentation with i18n support

ℹ️ Use: crewx template init <template-name>
```

---

## 성공 기준 요약

### WBS-33 완료 조건

**최종 동작**:
```bash
# 1. 템플릿 리스트 확인 (동적)
$ crewx template list
📦 Available templates:
  • wbs-automation       - WBS project automation template
  • docusaurus-i18n      - Docusaurus documentation with i18n support

# 2. 템플릿 초기화 (파일 보호)
$ mkdir my-project && cd my-project
$ crewx template init wbs-automation

✅ Created crewx.yaml
✅ Created wbs.md
✅ Created README.md

📊 Summary: Created 3 files

# 3. 재실행 시 (기존 파일 보호)
$ crewx template init wbs-automation

⚠️ Skipping existing file: crewx.yaml
⚠️ Skipping existing file: wbs.md
⚠️ Skipping existing file: README.md

📊 Summary: Created 0 files, Skipped 3 files
ℹ️ Some files were skipped. Use --force to overwrite.

# 4. 강제 덮어쓰기
$ crewx template init wbs-automation --force

✅ Overwritten crewx.yaml
✅ Overwritten wbs.md
✅ Overwritten README.md

📊 Summary: Overwritten 3 files
```

---

## 참고 문서

### 관련 WBS
- [WBS-32: Project Templates](wbs-32-project-templates.md) - 전제 조건

### 참고 프로젝트
- crewx-quickstart - 파일 덮어쓰기 방지 패턴

### 외부 문서
- [giget 문서](https://github.com/unjs/giget)
- [GitHub Raw Content API](https://docs.github.com/en/rest/repos/contents)
