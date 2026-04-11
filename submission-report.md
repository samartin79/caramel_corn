# Submission Report

## Submission summary

- **Participant / team name:** samartin79
- **Final source file:** `agent.js`
- **Model(s) / system(s) used:** Claude Code (Claude Opus 4.6)
- **Short strategy summary:** Iterative-deepening negamax alpha-beta with capture-only quiescence, material + PST evaluation, MVV-LVA move ordering, soft/hard time control (200ms/800ms), and deterministic lexicographic UCI tie-break. No randomness, no external dependencies.

## Prompt log

Chronological record of all prompts given during development. See `prompt-log.md` for full verbatim text.

1. **Fork and baseline setup** — Fork repo, clone, configure remotes, pull latest, run tests, commit baseline.
2. **Material evaluation** — Add deterministic material eval (P=100, N=320, B=330, R=500, Q=900, K=20000) with lexicographic UCI tie-break. Keep parser/movegen intact.
3. **Clean-up: stdin-only input rule and logging** — Remove `node:fs` import, switch to `process.stdin` for FEN input. Create prompt and tool logs. Run banned-API scan.
4. **Piece-square tables** — Add static PST for all 6 piece types. Integrate as `score = material + PST`. Black mirrors via `index ^ 56` rank flip.
5. **Alpha-beta search core** — Negamax with alpha-beta pruning, depth-limited. Terminal: mate score `-(MATE - ply)`, stalemate `0`. Deterministic tie-break preserved.
6. **Patch alpha-beta correctness** — Full-window root search for exact tie-break scores. Added `ply` param for mate-distance scoring. Reduced to depth 3 (full-window cost; iterative deepening reclaims).
7. **Iterative deepening + time management** — Deepens from 1 while time allows. Soft 200ms / hard 800ms via `Date.now()`. ABORT sentinel propagates cleanly. Lexicographic root move order for determinism. Legal fallback if no depth completes.
8. **Patch iterative deepening completion semantics** — ABORT at any root move discards entire depth (no partial results). Hard-deadline guard before starting each new depth. Only fully completed depths update bestMove.
9. **Deterministic move ordering** — MVV-LVA captures first, then checks, then quiet moves. Stable UCI lex tie-break within each bucket. Applied at both root and recursive levels.
10. **Hardening freeze** — 5x test pass, 10x determinism check, legality sweep on 8 diverse FENs, compliance audit, final submission report.
11. **Quiescence search** — Capture-only quiescence at leaf nodes. Stand-pat eval, alpha/beta pruning, en passant captures included. MVV-LVA ordering with stable UCI tie-break. ABORT propagation preserved.

## Tools used

| Tool | How it was used |
| --- | --- |
| Claude Code (Opus 4.6) | All code generation, editing, testing, and compliance checks |
| gh CLI | Fork verification, repo clone with auto-configured remotes |
| npm test | Smoke test suite after each change (run 5x in hardening) |
| ripgrep (via Grep) | Banned-API scans (Math.random, child_process, worker_threads, eval, Function, fs.writeFile, external imports) |
| git | Version control, commits and pushes at each milestone |
| node (direct) | Determinism checks (5x and 10x same-FEN), legality sweep on 8 diverse FENs |
| wc | File size verification (20,894 bytes) |
| ls | Verify single executable source file at repo root |

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
| The source file is under `1 MB` | Yes (20,894 bytes) |

## Cut decisions

- **Quiescence search** — implemented (capture-only).
- **Opening book** — skipped; deterministic hash-based or hardcoded openings considered but not needed for core strength.
- **Transposition table** — skipped; would speed search but adds memory management complexity.
- **Killer/history heuristics** — skipped; MVV-LVA + check ordering provides sufficient pruning improvement.
- **Endgame-specific PST** — skipped; single PST set used for all phases.

## Additional notes

- Input reads via `process.stdin` (top-level `for await` in ESM) — no `node:fs` dependency.
- All move ordering is deterministic: MVV-LVA priority, then check detection, with stable UCI lexicographic tie-break within each bucket.
- Full prompt history maintained in `prompt-log.md`.
