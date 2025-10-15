#!/bin/bash

AGENTS="@gemini @crewx_glm_dev @crewx_codex_dev"
QUERY="Analyze if there are any side effects in the current working commits"
THREAD="thread-anal-sideeffect-$(date +%Y%m%d-%H%M%S)"

crewx q "$AGENTS $QUERY" --thread "$THREAD"
crewx q "@crewx_codex_dev Summarize the conversation and provide your opinion" --thread "$THREAD"
