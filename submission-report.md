# Submission Report

## Submission summary

- **Participant / team name:** samartin79
- **Final source file:** `agent.js`
- **Model(s) / system(s) used:** Claude Code (Claude Opus 4.6)
- **Short strategy summary:** Deterministic one-ply material evaluation (P=100, N=320, B=330, R=500, Q=900, K=20000) with lexicographic UCI tie-break. No randomness.

## Prompt log

Chronological record of all prompts given during development. See also `prompt-log.md` for full text.

1. **Fork and baseline setup** — Fork repo, clone, configure remotes, pull latest, run tests, commit baseline.
2. **Material evaluation** — Add deterministic material eval with specified piece values, lexicographic UCI tie-break. Keep parser/movegen intact.
3. **Clean-up: stdin-only input rule and logging** — Remove `node:fs` import, switch to `process.stdin` for FEN input. Create prompt and tool logs. Run banned-API scan.

## Tools used

| Tool | How it was used |
| --- | --- |
| Claude Code (Opus 4.6) | All code generation, editing, testing, and compliance checks |
| gh CLI | Fork verification, repo clone with auto-configured remotes |
| npm test | Smoke test suite after each change |
| ripgrep (via Grep) | Banned-API scan for Math.random, child_process, worker_threads, eval, Function, fs.writeFile |
| git | Version control, commits at each milestone |

## Rules compliance checklist

| Item | Yes / No |
| --- | --- |
| The submission has exactly one source file: `agent.js` or `agent.ts` | Yes |
| The agent uses only the Node.js standard library | Yes |
| The agent does not use network access | Yes |
| The agent does not read files outside the submission root | Yes |
| The agent does not start background daemons, subprocesses, worker pools, or child processes | Yes |
| The agent does not use runtime downloads or self-modifying code | Yes |
| The same FEN input always produces the same stdout output | Yes |
| `npm test` passes locally for the included smoke tests | Yes |
| The source file is under `1 MB` | Yes |

## Additional notes

- Input reads via `process.stdin` (top-level `for await`) instead of `readFileSync(0)` to avoid any `node:fs` dependency.
- Full prompt history maintained in `prompt-log.md`.
