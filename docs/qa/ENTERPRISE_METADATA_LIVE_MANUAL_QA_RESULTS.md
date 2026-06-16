# Enterprise Metadata Live Manual QA Results

Use this template for live logged-in provider QA of the enterprise, cloud, and internal metadata detector release candidate.

Follow [Enterprise Metadata Live Site QA Runbook](ENTERPRISE_METADATA_LIVE_SITE_QA_RUNBOOK.md) for setup, generated fixtures, browser loading, provider checks, and failure handling.

Rules:

- Use synthetic values only.
- Do not use customer data, production hostnames, real credentials, private files, or internal-only data.
- Keep browser DevTools open where practical and watch for raw metadata leaks in composer text, previews, downloads, reports, console output, and network activity.
- Save screenshots or recordings only when they do not expose account data or non-synthetic content.

## Run Metadata

- Branch/check-out:
- Commit SHA:
- Tester:
- Date:
- Build folders tested:
- Browser versions:
- Extension version:
- Synthetic sample source/path:

## ChatGPT

- Pass/Fail:
- Browser:
- Date:
- Build folder:
- Notes:
- Raw leak observed? yes/no:
- Placeholder corruption observed? yes/no:
- Screenshots/evidence path if any:

Checklist:

- [ ] typed text
- [ ] paste
- [ ] txt upload/drop
- [ ] PDF
- [ ] DOCX
- [ ] XLSX
- [ ] image OCR
- [ ] placeholder reveal
- [ ] rerun already-redacted output
- [ ] no raw metadata reaches composer/send

## Gemini

- Pass/Fail:
- Browser:
- Date:
- Build folder:
- Notes:
- Raw leak observed? yes/no:
- Placeholder corruption observed? yes/no:
- Screenshots/evidence path if any:

Checklist:

- [ ] typed text
- [ ] paste
- [ ] drag/drop txt
- [ ] PDF
- [ ] DOCX
- [ ] XLSX
- [ ] image OCR
- [ ] fallback insertion
- [ ] pending attach behavior
- [ ] no raw file replay
- [ ] redacted image file-only handoff

## Claude

- Pass/Fail:
- Browser:
- Date:
- Build folder:
- Notes:
- Raw leak observed? yes/no:
- Placeholder corruption observed? yes/no:
- Screenshots/evidence path if any:

Checklist:

- [ ] typed text
- [ ] paste
- [ ] supported file behavior if available

## Grok/X

- Pass/Fail:
- Browser:
- Date:
- Build folder:
- Notes:
- Raw leak observed? yes/no:
- Placeholder corruption observed? yes/no:
- Screenshots/evidence path if any:

Checklist:

- [ ] typed text
- [ ] paste
- [ ] supported file behavior if available

## Final Notes

- Overall Pass/Fail:
- Release blocker observed? yes/no:
- Follow-up issue/PR links:
- Additional evidence paths:
