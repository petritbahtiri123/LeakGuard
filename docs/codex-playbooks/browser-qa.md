# Browser QA Playbook

Use when Chrome, Edge, Firefox, extension smoke, or browser QA harness checks fail.

## First Move
Capture the safe failure coordinates:

- browser
- site or built-in/user-managed target
- command
- failure code
- stage
- input path: typed, paste, drop, file input, scanner, reveal, popup, policy
- canary ID or fixture ID

Do not print raw secrets, raw prompts, raw file names, raw paths, screenshots containing private data, or full page text.

## Triage
1. Distinguish product security risk from UI/harness flake.
2. Check whether the raw canary leaked, redaction failed, rewrite verification failed, or a UI assertion missed a control.
3. Use safe JSON reports and canary IDs.
4. If runtime loading failed, check script order:
   - `src/shared/runtime_scripts.js`
   - `manifests/base.json`
   - `manifests/firefox.json`
   - `src/background/service_worker.js`
5. If file flow failed, use `file-handoff-fail-closed.md`.
6. If debug/report content is unsafe, use `debug-safety.md`.

## Validation
Run the failing command first, then the closest static guards:

```bash
npm run smoke:chrome
npm run smoke:firefox
node tests/browser_qa_assertions.test.js
node tests/security.test.js
node tests/build_targets.test.js
node tests/runtime_script_order.test.js
```

For full browser gates:

```bash
npm run qa:browser
```

Only summarize relevant safe failure lines in final responses.
