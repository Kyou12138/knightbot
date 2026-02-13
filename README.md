# AI Autonomous Dev Harness

This repository contains a production-oriented harness for long-running AI coding agents.

## Quick Start

1. Initialize workspace artifacts:
   - `powershell -ExecutionPolicy Bypass -File .\scripts\init.ps1`
2. Verify harness health:
   - `powershell -ExecutionPolicy Bypass -File .\scripts\verify.ps1`
3. Run one delivery cycle:
   - `powershell -ExecutionPolicy Bypass -File .\scripts\run-cycle.ps1`

## Core Files

- `app_spec.md`: Product and engineering specification.
- `feature_list.json`: Source of truth for feature pass/fail status.
- `feature_list.schema.json`: Validation schema for `feature_list.json`.
- `harness/orchestrator.yaml`: State machine for long-running execution.
- `harness/agent_prompts/`: Prompt templates for initializer, coding, QA, release agents.
- `harness/policies/agent_policy.json`: Tool, command, and file safety policy.
- `claude-progress.txt`: Session progress and handoff log.

