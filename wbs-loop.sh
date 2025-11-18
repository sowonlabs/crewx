#!/bin/bash
# ============================================================
# CrewX WBS 자동 진행 루프 (Coordinator Agent 버전)
# ============================================================
#
# 🔄 작업 흐름 (극단적으로 심플!):
#   1. @coordinator 에이전트 호출
#   2. 끝! (에이전트가 알아서 wbs.md 분석 → Phase 선택 → 병렬 실행)
#
# 🤖 Coordinator 에이전트가 자동으로:
#   - wbs.md 읽고 미완료 Phase 확인
#   - 독립적인 Phase들 병렬 실행 계획
#   - 적절한 개발 에이전트 선택 및 호출
#   - wbs.md 완료 처리까지 지시
#   - 30분 타임아웃으로 여러 Phase 동시 완료
#
# 📡 Thread 시스템:
#   - Context Thread: 일일 작업 컨텍스트 공유
#
# 🎯 핵심 개선:
#   - 스크립트는 단순 스케줄러 역할만
#   - 모든 로직은 coordinator 에이전트에 위임
#   - 프롬프트 개선이 쉽고 테스트 가능
# ============================================================

set -e
set -o pipefail

# CrewX 명령어 설정
CREWX_CMD="${CREWX_CMD:-crewx}"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 로그 함수
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error_log() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn_log() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

info_log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

coordinator_log() {
    echo -e "${CYAN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} 🤖 $1"
}

# 루프 카운터
LOOP_COUNT=0
MAX_LOOPS=${MAX_LOOPS:-24} # 기본 24시간
SLEEP_TIME=${SLEEP_TIME:-3600} # 기본 1시간 (3600초)

# 진행 상황 파일
PROGRESS_FILE="wbs-progress.log"
ERROR_FILE="wbs-errors.log"

# Thread IDs (일 단위 기본)
DAY_THREAD="wbs-$(date +%Y%m%d)"
CONTEXT_THREAD="$DAY_THREAD-context"

# 환경변수로 CONTEXT_THREAD 전달 (agent config에서 {{env.CONTEXT_THREAD}} 사용 가능)
export CONTEXT_THREAD

# Coordinator 설정
CONFIG_FILE="crewx.wbs.yaml"
COORDINATOR_TIMEOUT="1800000"   # Coordinator가 작업까지 완료: 30분

# 초기화
init() {
    log "🚀 WBS 자동화 루프 시작"
    log "📌 CrewX 명령어: $CREWX_CMD"
    log "🤖 Coordinator Agent: @coordinator"
    log "📄 Config: $CONFIG_FILE"
    log "📡 Context Thread: $CONTEXT_THREAD"

    echo "========================================" >> "$PROGRESS_FILE"
    echo "시작 시간: $(date)" >> "$PROGRESS_FILE"
    echo "CrewX 명령어: $CREWX_CMD" >> "$PROGRESS_FILE"
    echo "Config: $CONFIG_FILE" >> "$PROGRESS_FILE"
    echo "Context Thread: $CONTEXT_THREAD" >> "$PROGRESS_FILE"
    echo "========================================" >> "$PROGRESS_FILE"

    coordinator_log "Coordinator 에이전트 초기화 완료"
}

# 작업 사이클 - Coordinator 에이전트만 호출하면 끝!
work_cycle() {
    local cycle=$1
    log "🔄 작업 사이클 #$cycle 시작 ($(date '+%Y-%m-%d %H:%M'))"

    coordinator_log "@coordinator 호출 중..."

    # Coordinator가 system prompt에 따라 자동으로:
    # - wbs.md 분석 → Phase 선택 → 병렬 실행 → wbs.md 업데이트
    local exit_code=0
    local cycle_temp_log
    cycle_temp_log=$(mktemp -t crewx-cycle-XXXXXX)

    set +e
    $CREWX_CMD execute "@coordinator 사이클 #$cycle: wbs.md 확인하고 미처리 Phase들을 찾아서 즉시 병렬로 진행해주세요. 사용자에게 물어보지 말고 바로 실행하세요." \
        --config $CONFIG_FILE \
        --thread $CONTEXT_THREAD \
        --timeout "$COORDINATOR_TIMEOUT" 2>&1 | tee -a "$PROGRESS_FILE" | tee "$cycle_temp_log"
    exit_code=$?
    set -e

    if [ $exit_code -eq 0 ]; then
        log "✅ 사이클 #$cycle 완료"
    else
        error_log "❌ 사이클 #$cycle 실패 (exit code: $exit_code)"
        {
            echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: Cycle $cycle failed (exit code: $exit_code)"
            echo "----- Last output -----"
            tail -n 40 "$cycle_temp_log"
            echo "-----------------------"
        } >> "$ERROR_FILE"
    fi

    rm -f "$cycle_temp_log"
}


# 메인 루프
main_loop() {
    while [ $LOOP_COUNT -lt $MAX_LOOPS ]; do
        LOOP_COUNT=$((LOOP_COUNT + 1))

        log "========== 루프 #$LOOP_COUNT / $MAX_LOOPS =========="

        # Coordinator가 작업 진행 (wbs.md 분석 → Phase 선택 → 병렬 실행)
        work_cycle $LOOP_COUNT

        log "✅ 루프 #$LOOP_COUNT 완료"

        # 다음 루프까지 대기
        if [ $LOOP_COUNT -lt $MAX_LOOPS ]; then
            info_log "💤 다음 루프까지 $((SLEEP_TIME/60))분 대기..."
            sleep $SLEEP_TIME
        fi
    done

    log "🎉 모든 루프 완료!"
}

# 종료 처리
cleanup() {
    log "🛑 루프 종료 중..."
    echo "========================================" >> "$PROGRESS_FILE"
    echo "종료 시간: $(date)" >> "$PROGRESS_FILE"
    echo "총 루프 실행: $LOOP_COUNT" >> "$PROGRESS_FILE"
    echo "========================================" >> "$PROGRESS_FILE"

    # 최종 리포트
    coordinator_log "최종 리포트 생성 중..."
    $CREWX_CMD query "@coordinator 오늘의 최종 리포트: wbs.md를 확인하고 완료된 Phase 목록, 전체 진행률, 다음 작업 추천을 7줄 이내로 요약해주세요." \
        --config $CONFIG_FILE \
        --timeout 60000 2>&1 | tee -a "$PROGRESS_FILE"
}

# 시그널 핸들링
trap cleanup EXIT INT TERM

# 사용법 표시
usage() {
    echo "사용법: $0 [옵션]"
    echo ""
    echo "옵션:"
    echo "  -h, --help           도움말 표시"
    echo "  -l, --loops NUM      최대 루프 횟수 (기본: 24)"
    echo "  -s, --sleep SECONDS  루프 간 대기 시간 (기본: 3600초)"
    echo "  -t, --test           테스트 모드 (5분 간격, 3회)"
    echo "  -c, --cmd COMMAND    CrewX 명령어 (기본: crewx)"
    echo ""
    echo "예시:"
    echo "  $0                    # 기본 실행"
    echo "  $0 --test             # 테스트 모드"
    echo "  $0 -c './dist/main.js' # 개발 모드"
}

# 명령줄 인수 파싱
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            usage
            exit 0
            ;;
        -l|--loops)
            MAX_LOOPS="$2"
            shift 2
            ;;
        -s|--sleep)
            SLEEP_TIME="$2"
            shift 2
            ;;
        -c|--cmd)
            CREWX_CMD="$2"
            shift 2
            ;;
        -t|--test)
            MAX_LOOPS=3
            SLEEP_TIME=300 # 5분
            COORDINATOR_TIMEOUT=120000  # 2분 (coordinator가 작업까지 완료)
            TEST_MODE=true
            log "📍 테스트 모드: 3회 루프, 5분 간격, Enter 스킵"
            shift
            ;;
        *)
            error_log "알 수 없는 옵션: $1"
            usage
            exit 1
            ;;
    esac
done

# 실행 확인
echo "========================================"
echo "  CrewX Monorepo 자동화 루프"
echo "  🤖 Coordinator Agent 버전"
echo "========================================"
echo "CrewX 명령어: $CREWX_CMD"
echo "Config: $CONFIG_FILE"
echo "최대 루프: $MAX_LOOPS"
echo "대기 시간: $((SLEEP_TIME/60))분"
echo ""
echo "Coordinator Agent:"
echo "  - @coordinator (Phase 단위 병렬 실행)"
echo ""
warn_log "⚠️ Coordinator가 자동으로 Phase를 병렬 실행합니다. 시작합니다..."

# 메인 실행
init
main_loop
cleanup
