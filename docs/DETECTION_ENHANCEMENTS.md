# Detection Enhancements

## Trust-Aware Placeholders

LeakGuard now treats placeholder syntax and placeholder trust as separate signals.
Visible tokens such as `[PWM_7]`, `[PASSWORD_2]`, and `[TOKEN_1]` reserve their visible PWM index space where applicable, but they are only preserved when the active session mapping knows them. This closes placeholder laundering while keeping deterministic placeholder numbering stable.

Trusted placeholders are sourced from the active `PlaceholderManager` state or a sanitized trusted placeholder list. Unknown placeholder-like tokens in sensitive contexts are scanned as secret candidates. If a trusted placeholder is followed by a secret-like tail, LeakGuard preserves the placeholder and redacts only the tail.

```mermaid
flowchart TD
  A[Input text] --> B[Normalize visible placeholder syntax]
  B --> C[Reserve visible PWM and semantic indices]
  C --> D{Token looks like a placeholder?}
  D -- No --> E[Run deterministic patterns, assignments, context, entropy]
  D -- Yes --> F{Present in active mapping?}
  F -- Yes --> G{Attached tail exists?}
  G -- No --> H[Preserve trusted placeholder]
  G -- Yes --> I{Tail is secret-like?}
  I -- Yes --> J[Preserve placeholder, redact tail]
  I -- No --> H
  F -- No --> K[Treat whole token as candidate in sensitive context]
  K --> E
  E --> L[Stable overlap resolution]
  H --> L
  J --> L
  L --> M[Deterministic redaction through PlaceholderManager]
```

## Natural-Language Disclosures

Natural-language detection now covers broader chat-style disclosures:

- `this is my secret ...`
- `here is my password ...`
- `my db password is ...`
- `real value: ...`
- `token -> ...`
- `again same key: ...`
- `same token: ...`

The deny list suppresses benign discussion around examples, templates, password policy, regex help, validators, generators, and safe configuration keys such as `password_hint`, `secret_santa`, `token_limit`, `api_version`, `build_id`, `region`, and `environment`.

## Sensitive HTTP Headers

v1.3.0 adds a narrow allowlist for sensitive HTTP header names:

- `Authorization`
- `X-API-Key` / `API-Key`
- `X-Auth-Token`, `X-Access-Token`, `X-Session-Token`
- `Ocp-Apim-Subscription-Key`
- `Cookie` and `Set-Cookie`

The detector preserves header names, separators, and auth schemes while redacting the intended secret value range. For example, `Authorization: Bearer BearerToken123` becomes `Authorization: Bearer [PWM_N]`, and `X-API-Key: ApiKeyHeader123` becomes `X-API-Key: [PWM_N]`.

Safe headers such as `Content-Type`, `Accept`, `User-Agent`, `Cache-Control`, `X-Request-ID`, and `X-Trace-ID` remain unchanged.

## Known-Secret Reuse

Redaction now prefers full known raw secret reuse over shorter suffix-only findings. If a secret first appears in a structured context and later appears in labelled prose, the later occurrence reuses the original placeholder:

```text
X-API-Key: ApiKeyHeader1234567890
Again same key: ApiKeyHeader1234567890
```

becomes:

```text
X-API-Key: [PWM_N]
Again same key: [PWM_N]
```

This keeps placeholder reuse stable and prevents partial outputs such as `ApiKey[PWM_N]`.

## Rollout Timeline

```mermaid
gantt
  title Trust-Aware Detection Rollout
  dateFormat  YYYY-MM-DD
  axisFormat  %b %d
  section Core
  Placeholder trust split          :done, a1, 2026-04-30, 1d
  Trusted-tail splitting           :done, a2, 2026-04-30, 1d
  Natural-language expansion       :done, a3, 2026-04-30, 1d
  Sensitive header ranges          :done, a4, 2026-05-01, 1d
  Known-secret reuse hardening     :done, a5, 2026-05-01, 1d
  section Validation
  Placeholder trust regressions    :done, b1, 2026-04-30, 1d
  Natural-language deny-list tests :done, b2, 2026-04-30, 1d
  Typed interception coverage      :done, b3, 2026-04-30, 1d
  Header and reuse break pack      :done, b4, 2026-05-01, 1d
  section Release
  Review false positives           :active, c1, 2026-05-01, 2d
  Staged extension rollout         :c2, after c1, 3d
  Telemetry-free QA signoff        :c3, after c2, 2d
```
