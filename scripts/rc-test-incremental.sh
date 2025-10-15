#!/bin/bash
# scripts/rc-test-incremental.sh
#
# RC 릴리스 점진적 테스트 스크립트 (CodeCrew 병렬 처리 활용)
# 사용법: ./scripts/rc-test-incremental.sh 0.3.16-rc.1 [--batch N]
#
# 이 스크립트는:
# 1. CodeCrew의 내장 병렬 처리 기능 활용
# 2. N개씩 배치로 나눠서 테스트 (기본: 2개씩)
# 3. 각 배치 완료 후 AI로 결과 검증
# 4. 최종 통합 보고서 자동 생성
#
# 예시:
#   ./scripts/rc-test-incremental.sh 0.3.16-rc.1
#   ./scripts/rc-test-incremental.sh 0.3.16-rc.1 --batch 3

set -e

# CodeCrew 명령어 경로 설정
CREWX_CMD="node /Users/doha/git/crewx/dist/main.js"

# 배치 크기 설정 (한 번에 몇 개씩 병렬 실행할지)
BATCH_SIZE=${BATCH_SIZE:-2}

RC_VERSION=$1
SHIFT_ARG=$2

if [ -z "$RC_VERSION" ]; then
  echo "Usage: $0 <RC_VERSION> [--batch N]"
  echo "Example: $0 0.3.16-rc.1"
  echo "         $0 0.3.16-rc.1 --batch 3  # 3개씩 병렬"
  echo "         BATCH_SIZE=2 $0 0.3.16-rc.1"
  exit 1
fi

# --batch 옵션 파싱
if [ "$SHIFT_ARG" = "--batch" ]; then
  BATCH_SIZE=$3
  if [ -z "$BATCH_SIZE" ]; then
    echo "Error: --batch requires a number"
    exit 1
  fi
fi

# 테스트할 버그 목록
BUGS=(
  "bug-00000027:TypeScript build verification"
  "bug-00000026:md-to-slack newline fix"
  "bug-00000024:crewx.yaml file loading"
)

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║   RC $RC_VERSION Incremental Testing                    ║"
echo "║   (CodeCrew Native Parallel Processing)                 ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "📋 Total: ${#BUGS[@]} bugs"
echo "🔄 Batch: $BATCH_SIZE bugs per batch"
echo "⚡ Using crewx execute with multiple agents"
echo ""

SUCCESS_COUNT=0
FAIL_COUNT=0
FAILED_BUGS=()

# Stage 1: Batch testing
i=0
batch_num=1

while [ $i -lt ${#BUGS[@]} ]; do
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📦 Batch $batch_num"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  execute_args=()
  batch_bugs=()

  for ((j=0; j<BATCH_SIZE && i+j<${#BUGS[@]}; j++)); do
    bug_entry="${BUGS[$((i+j))]}"
    BUG_ID="${bug_entry%%:*}"
    BUG_DESC="${bug_entry#*:}"

    echo "  • $BUG_ID: $BUG_DESC"

    execute_args+=("@crewx_tester Test $BUG_ID individually: $BUG_DESC")
    batch_bugs+=("$BUG_ID")
  done

  echo ""
  echo "⏳ Executing ${#execute_args[@]} tests in parallel..."

  if $CODECREW_CMD execute "${execute_args[@]}"; then
    echo "✅ Batch completed"
  else
    echo "⚠️  Batch had failures"
  fi

  # Verify results
  echo ""
  echo "🤖 Verifying results..."

  for BUG_ID in "${batch_bugs[@]}"; do
    RESULT=$($CREWX_CMD query "@crewx_dev:haiku reports/bugs/$BUG_ID 최신 리포트 PASS/FAIL만 답해" 2>&1 | grep -oE "PASS|FAIL" | head -1 || echo "UNKNOWN")

    if [ "$RESULT" = "PASS" ]; then
      SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
      echo "  ✅ $BUG_ID"
    else
      FAIL_COUNT=$((FAIL_COUNT + 1))
      FAILED_BUGS+=("$BUG_ID")
      echo "  ❌ $BUG_ID"
    fi
  done

  i=$((i + BATCH_SIZE))
  batch_num=$((batch_num + 1))

  if [ $i -lt ${#BUGS[@]} ]; then
    echo "💤 5 sec..."
    sleep 5
  fi
done

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║   Summary                                                 ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo "✅ Passed: $SUCCESS_COUNT"
echo "❌ Failed: $FAIL_COUNT"

[ $FAIL_COUNT -gt 0 ] && exit 1
echo "✅ All passed!"
exit 0
