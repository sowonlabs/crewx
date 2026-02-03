---
id: 5EKPeI
date: '2026-01-09'
category: general
tags: []
topic: true
summary: Codex CLI skill x spans 기록 안되는 이슈
---

# Codex CLI skill x spans 기록 안되는 이슈

## 문제
- crewx_codex_dev가 `crewx skill x`로 실행하면 spans에 기록이 안 남음
- tasks 테이블에는 정상 기록됨

## 원인
- Codex CLI가 homebrew Node.js v24 사용 (`/opt/homebrew/bin/node`)
- crewx는 nvm Node.js v20에 설치됨 (`/Users/doha/.nvm/versions/node/v20.19.2/bin/crewx`)
- better-sqlite3 네이티브 모듈이 v20용으로 빌드되어 v24에서 로드 실패
- 에러: `Could not locate the bindings file` 또는 모듈 버전 불일치

## 적용한 해결책
- homebrew node (v24)로 crewx를 `/opt/homebrew/bin/crewx`에 설치 완료
```bash
/opt/homebrew/bin/npm install -g @sowonai/crewx-cli@0.8.0-rc.25
```

## 남은 확인
- Codex rate limit 풀리면 (2026-01-10 17:56 KST) 테스트 필요
- Codex가 `/opt/homebrew/bin/crewx`를 사용하는지 확인
- spans 정상 기록되는지 확인

## 디버깅 로그
- `skill.handler.ts`와 `tracing.service.ts`에 `[DEBUG]` 로그 추가됨
- 테스트 후 제거 필요

## 참고
- Claude/Gemini CLI는 시스템 Node.js (nvm v20) 사용하여 정상 작동
