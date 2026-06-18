# LeakGuard Full Redaction Manual QA Matrix

Use `adapters/*_paste_payload.txt` for provider composer paste tests.
Use `uploads/` for file picker, drag/drop, and scanner upload tests across supported file paths.
All sample values are fake synthetic detector fixtures.

The canonical source payload is `../full_redaction_smoke_payload.txt`.

Expected protected-site outcomes:
- If the sanitized rewrite is accepted, the composer/upload should contain placeholders such as `[PWM_1]`, `[NET_1]`, or `[PUB_HOST_1]` and no raw synthetic secrets.
- If the site editor changes or rejects the rewrite, LeakGuard may show "Rewrite verification failed" and block submission. That is a fail-closed result; retry with a smaller payload or a file upload/drop fixture for that adapter.

## Adapters

- chatgpt: adapters/chatgpt_paste_payload.txt (https://chatgpt.com/)
- openai: adapters/openai_paste_payload.txt (https://chat.openai.com/)
- gemini: adapters/gemini_paste_payload.txt (https://gemini.google.com/app)
- claude: adapters/claude_paste_payload.txt (https://claude.ai/)
- grok: adapters/grok_paste_payload.txt (https://grok.com/)
- x: adapters/x_paste_payload.txt (https://x.com/compose/post)

## Upload Fixtures

- uploads/full-redaction-smoke-bash.bash (text/plain)
- uploads/full-redaction-smoke-bat.bat (text/plain)
- uploads/full-redaction-smoke-c.c (text/plain)
- uploads/full-redaction-smoke-cfg.cfg (text/plain)
- uploads/full-redaction-smoke-cmd.cmd (text/plain)
- uploads/full-redaction-smoke-conf.conf (text/plain)
- uploads/full-redaction-smoke-cpp.cpp (text/plain)
- uploads/full-redaction-smoke-cs.cs (text/plain)
- uploads/full-redaction-smoke-css.css (text/css)
- uploads/full-redaction-smoke-csv.csv (text/csv)
- uploads/full-redaction-smoke-env.env (text/plain)
- uploads/full-redaction-smoke-go.go (text/plain)
- uploads/full-redaction-smoke-h.h (text/plain)
- uploads/full-redaction-smoke-hpp.hpp (text/plain)
- uploads/full-redaction-smoke-html.html (text/html)
- uploads/full-redaction-smoke-ini.ini (text/plain)
- uploads/full-redaction-smoke-java.java (text/plain)
- uploads/full-redaction-smoke-js.js (text/javascript)
- uploads/full-redaction-smoke-json.json (application/json)
- uploads/full-redaction-smoke-jsx.jsx (text/plain)
- uploads/full-redaction-smoke-key.key (application/octet-stream)
- uploads/full-redaction-smoke-log.log (text/plain)
- uploads/full-redaction-smoke-markdown.markdown (text/markdown)
- uploads/full-redaction-smoke-md.md (text/markdown)
- uploads/full-redaction-smoke-pem.pem (application/x-pem-file)
- uploads/full-redaction-smoke-php.php (text/plain)
- uploads/full-redaction-smoke-ps1.ps1 (text/plain)
- uploads/full-redaction-smoke-py.py (text/plain)
- uploads/full-redaction-smoke-rb.rb (text/plain)
- uploads/full-redaction-smoke-rs.rs (text/plain)
- uploads/full-redaction-smoke-scss.scss (text/plain)
- uploads/full-redaction-smoke-sh.sh (text/plain)
- uploads/full-redaction-smoke-sql.sql (application/sql)
- uploads/full-redaction-smoke-toml.toml (application/toml)
- uploads/full-redaction-smoke-ts.ts (text/plain)
- uploads/full-redaction-smoke-tsx.tsx (text/plain)
- uploads/full-redaction-smoke-txt.txt (text/plain)
- uploads/full-redaction-smoke-xml.xml (application/xml)
- uploads/full-redaction-smoke-yaml.yaml (application/x-yaml)
- uploads/full-redaction-smoke-yml.yml (application/x-yaml)
- uploads/full-redaction-smoke-zsh.zsh (text/plain)
- uploads/Dockerfile (text/plain)
- uploads/Makefile (text/plain)
- uploads/full-redaction-smoke.pdf (application/pdf)
- uploads/full-redaction-smoke.docx (application/vnd.openxmlformats-officedocument.wordprocessingml.document)
- uploads/full-redaction-smoke.xlsx (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)
- uploads/full-redaction-smoke.png (image/png)
- uploads/full-redaction-smoke.jpg (image/jpeg)
- uploads/full-redaction-smoke.jpeg (image/jpeg)
- uploads/full-redaction-smoke.webp (image/webp)
