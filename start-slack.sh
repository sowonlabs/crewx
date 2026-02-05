#!/bin/bash
# CrewX Dev Lead Slack Server
# Starts the Slack bot with crewx_dev_lead agent

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Load Slack environment variables
if [ -f .env.slack ]; then
    export $(grep -v '^#' .env.slack | xargs)
    echo "✅ Loaded .env.slack"
else
    echo "❌ .env.slack not found"
    exit 1
fi

# Start Slack bot with Dev Lead agent
echo "🚀 Starting CrewX Slack Server with @crewx_dev_lead..."
echo "   Mode: execute (can modify code)"
echo "   Agent: crewx_dev_lead"
echo ""

crewx slack --agent crewx_dev_lead --mode execute --log
