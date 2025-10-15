#!/bin/bash

AGENTS="@crewx_qa_lead"
QUERY="Run smoke tests for current working version"

crewx q "$AGENTS $QUERY"
