# RemitIA Agent Instructions

## Current repository state

- This is a bootstrap, contract-only repository. Aside from this file, the local root contains `prdv4.md` and `.atl/`; it is not a Git worktree.
- Upstream `main` contains only `README.md` and `prd.md`. There is no code, manifest, CI, configuration, test runner, or prior agent guide.
- Do not invent build, development, test, or deployment commands. Update this guide when executable setup is established.

## Session and branch gate

- Begin every session by declaring exactly one builder: `Builder: Rachid`, `Builder: Nahuel`, or `Builder: Luis`.
- Work and commit only on the personal branch with the exact same name as the declared builder.
- Never commit to `main` or to another builder's branch. This repository uses personal branches instead of the PRD's planned per-story branch examples.

## Frozen PRD and ownership

- Read `prdv4.md` before proposing or changing code. It is the current local frozen PRD.
- Do not unilaterally change contracts, P0 scope, endpoint, schema, state names, or ownership. Contract changes require a short problem/change/impact note and confirmation from Rachid, Nahuel, and Luis.
- Luis owns only `apps/web`.
- Rachid owns only `apps/api`, root integration, `scripts`, and shared runtime setup.
- Nahuel owns only `services/qvac`.
- Changes under `contracts/` require team agreement. Do not cross ownership boundaries or implement a colleague's responsibility.

## Runtime boundaries

| Area | Required boundary |
| --- | --- |
| Browser | Use only relative `/api/v1/...` requests. In development, Vite proxies `/api` to `localhost:8000`; do not add CORS. |
| FastAPI | It is the public source of truth and owns business state, lexical scores and thresholds, counting, arithmetic, and transitions. |
| QVAC | Bind only to `127.0.0.1:8787`. It owns local OCR and text interpretation, and may select only from supplied SKUs. |
| QVAC limits | Do not use model-derived numeric confidence or arithmetic; never invent a SKU. |
| External services | No cloud AI or remote fallback. |

## P0 rules

- Keep P0 limited: no voice, PDF, RAG, multimodal features, external or cloud calls, or embeddings.
- Development mocks are allowed only behind agreed contracts. Strict demo mode rejects fake AI.
- Planned P0 verification must prioritize reconciliation arithmetic and the SKU whitelist. No test runner exists yet.

## QVAC prerequisites

- Before QVAC implementation, meet these PRD requirements: Python 3.11, Node >=22.17, and Windows Vulkan >=1.4.
- Before QVAC implementation, run `python -m tetherto.qvac_sdk install-worker` and `qvac doctor`.
- Run QVAC as one process only; do not use `--reload`.
- These are PRD requirements, not verified current project scripts or setup commands.

## Handoff record

- Leave the commit or PR reference, exact verification command and result, limitations, evidence, and changed environment variables.
