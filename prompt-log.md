# Prompt Log

Chronological record of all prompts/instructions given during development.

## 1. Fork and baseline setup

> Fork/setup first: ensure samartin79/vibe-code-cup-challenge1 exists, clone it locally, set origin to your fork and upstream to aj47/vibe-code-cup-challenge1, checkout main, pull latest, and run npm test. If tests fail, fix baseline/test environment only, rerun until green, then commit chore: baseline fork setup and green tests.

## 2. Material evaluation

> Edit only root agent.js. Keep parser and legal move generator intact. Add deterministic material evaluation with P=100,N=320,B=330,R=500,Q=900,K=20000. Integrate into move choice with lexicographic UCI tie-break. Run npm test; if failing, stop and fix before continuing. Commit: feat: material evaluation.

## 3. Clean-up: stdin-only input rule and logging

> Work in /mnt/llmstore/comp/vibe-code-cup-challenge1 only.
>
> Clean-up + back-on-track task (no questions, execute directly):
>
> 1. Keep existing FEN parser and legal move generator logic unchanged.
> 2. Fix rules compliance drift in agent.js input handling:
>    - Remove node:fs stdin read.
>    - Use only process.stdin (or readline) to read one FEN from stdin.
>    - Still print exactly one UCI move or 0000.
> 3. Preserve current deterministic material-eval behavior exactly (no randomness, stable tie-break).
> 4. Logging requirement:
>    - Use prompt-log.md as the canonical prompt file.
>    - Append this user instruction and this execution prompt text to prompt-log.md.
>    - Mirror those prompt entries in submission-report.md under chronological prompt log.
>    - Append tools used in this turn to the tool log section in submission-report.md (and tool-log.md if present).
> 5. Run npm test. If failing, stop feature work and fix until green.
> 6. Run a quick banned-API scan in agent.js for: Math.random, child_process, worker_threads, eval, Function, fs.writeFile.
> 7. Commit if green with: chore: enforce stdin-only input rule and update prompt/tool logs
> 8. Return only: test result, banned-API scan result, changed files, commit SHA, next milestone to execute (PST integration).
