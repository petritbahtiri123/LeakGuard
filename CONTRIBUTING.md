# Contributing to LeakGuard

Thank you for your interest in contributing to LeakGuard! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

Be respectful and constructive in all interactions. We're building a security-focused tool that protects user privacy—maintaining trust and quality is essential.

## Getting Started

### Prerequisites

- **Node.js** (v22 or later) and npm
- **Python 3** (3.11 or later)
- A modern browser for testing (Chrome or Firefox)
- Git

### Local Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/petritbahtiri123/LeakGuard.git
   cd LeakGuard
   ```

2. **Install dependencies:**
   ```bash
   npm ci
   ```

3. **Build the extension:**
   ```bash
   npm run build
   ```

   Or build a specific target:
   ```bash
   npm run build:chrome
   npm run build:firefox
   npm run build:chrome-enterprise
   npm run build:firefox-enterprise
   ```

4. **Run tests:**
   ```bash
   npm test
   ```

### Loading the Extension Locally

#### Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `dist/chrome/` folder

#### Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on...**
3. Select `dist/firefox/manifest.json`

## Development Workflow

### Project Structure

```
LeakGuard/
├── src/
│   ├── background/          # Service worker and orchestration
│   ├── content/             # Content script and composer integration
│   ├── popup/               # Extension popup UI
│   ├── options/             # Extension settings page
│   ├── compat/              # Browser compatibility helpers
│   └── shared/              # Detector, redaction, placeholders, transforms
├── ai/                      # Local AI classifier training and export
├── docs/                    # Extended documentation
├── tests/                   # Node-based regression tests
├── manifests/               # Manifest templates for different builds
├── scripts/                 # Build and utility scripts
└── config/                  # Policy configuration files
```

### Key Modules

- **`src/shared/detector.js`** - Core secret detection heuristics
- **`src/shared/redaction.js`** - Text transformation and placeholder replacement
- **`src/shared/placeholders.js`** - Placeholder management and reveal state
- **`src/content/content.js`** - Composer integration and DOM interception
- **`src/background/service_worker.js`** - Session state and message routing
- **`ai/scripts/`** - Model training, evaluation, and ONNX export

## Making Changes

### Before You Start

1. **Check existing issues** to avoid duplicate work
2. **Read the relevant documentation:**
   - `SECURITY_REVIEW.md` - Security model and hardening notes
   - `BROWSER_COMPAT.md` - Browser-specific considerations
   - `docs/AI_ASSIST.md` - AI classifier details
   - `docs/ENTERPRISE_DEPLOYMENT.md` - Policy and enterprise features

3. **Create a branch** for your work:
   ```bash
   git checkout -b feature/your-feature-name
   git checkout -b fix/your-bug-name
   ```

### Code Style

- **JavaScript:** Plain JS (no frameworks). Keep it readable and focused.
- **Python:** Follow PEP 8. Use type hints where helpful.
- **Comments:** Explain *why*, not just what. Security-critical sections should be well-commented.
- **Testing:** Add tests for new detector patterns, transforms, or policy logic.

### Detector Pattern Changes

If you're adding or modifying secret detection patterns:

1. Add test cases to `tests/detector.test.js`
2. Run tests: `npm test`
3. Test with `tests/manual_detection_paste_block.txt` on real sites
4. Update the README's "Detection Coverage" section if scope changes

### UI Changes

If you're modifying popup, options, or in-page UI:

1. Test on both Chrome and Firefox
2. Test in incognito/private mode
3. Verify enterprise policy warnings display correctly
4. Test responsive behavior if applicable

### Security Changes

All changes that touch detection, redaction, reveal, or storage paths need careful review:

1. Document the threat model
2. Add security regression tests if applicable
3. Reference `SECURITY_REVIEW.md` and explain why the change is safe
4. Link to the relevant part of the security model in your PR description

## Testing

### Run All Tests

```bash
npm test
```

This runs:
- Detector hardening and false-positive suppression
- Network transformations
- Composer helpers
- Protected-site management
- Redaction performance guardrails for representative prompt, env-file, and log inputs
- Productization checks
- Security regressions

The performance benchmark is part of `npm test` and can also be run directly:

```bash
node tests/performance/redaction-benchmark.mjs
```

Set `LEAKGUARD_BENCH_ITERATIONS=<number>` to increase or reduce benchmark iterations during local investigation. Keep thresholds conservative enough for normal developer machines and CI; the benchmark is intended to catch major redaction slowdowns, not to replace profiling.

### Manual Testing

Use the smoke test file to verify detection end-to-end:

```bash
cat tests/manual_detection_paste_block.txt
```

Paste this into a protected site's composer and verify:
- Secrets are detected and redacted
- Obvious docs placeholders stay visible
- The decision flow works
- Submission succeeds with redacted content

### AI Classifier Changes

If modifying the AI classifier:

```bash
cd ai
python -m pip install -r requirements.txt
python scripts/generate_initial_dataset.py --count 10000
python scripts/train_classifier.py
python scripts/evaluate_model.py
python scripts/export_onnx.py
```

Then rebuild and test:

```bash
cd ..
npm run build
npm test
```

## Submitting Changes

### Pull Request Process

1. **Ensure tests pass:**
   ```bash
   npm test
   ```

2. **Build all targets:**
   ```bash
   npm run build
   ```

3. **Create a clear PR title and description:**
   - Explain what changed and why
   - Link related issues (if applicable)
   - For security changes, note the threat model
   - For detector changes, link to test cases

4. **Keep commits focused:**
   - One logical change per commit
   - Use clear commit messages: `fix(detector): suppress false positives for path:/home/user/...`

5. **Push to your fork and create a PR**

### PR Review

- Address review feedback constructively
- Add tests if requested
- Re-run `npm test` and `npm run build` after changes
- Maintainers will merge once approved

## Reporting Issues

### Bug Reports

Include:
- Browser and version
- Extension version (from popup or `manifest.json`)
- Steps to reproduce
- Expected vs. actual behavior
- Screenshots if applicable

### Security Issues

**Do not open a public GitHub issue for security vulnerabilities.**

Follow the process in [SECURITY.md](SECURITY.md):
- Use GitHub's private vulnerability reporting if available
- Or email through your preferred private channel
- Include affected version, impact, and reproduction steps

### Feature Requests

- Describe the use case
- Explain how it fits LeakGuard's scope
- Link to related issues or documentation
- Reference the roadmap items in `docs/` if applicable

## Documentation

- Update `README.md` if user-facing behavior changes
- Update `SECURITY_REVIEW.md` if security model changes
- Add/update docs in `docs/` for significant features
- Update `BROWSER_COMPAT.md` if browser support changes
- Run the QA checklist in `docs/RELEASE_QA_CHECKLIST.md` before releases

## Building and Releasing

### Pre-Release Checklist

See `docs/RELEASE_QA_CHECKLIST.md` for the full manual QA checklist.

### Build Targets

- **Chrome consumer:** `npm run build:chrome`
- **Chrome enterprise:** `npm run build:chrome-enterprise`
- **Firefox consumer:** `npm run build:firefox`
- **Firefox enterprise:** `npm run build:firefox-enterprise`

All targets share the same source tree with manifest overlays.

## Questions or Need Help?

- Check existing documentation in `docs/`
- Review the `SECURITY_REVIEW.md` for design rationale
- Open an issue for clarification
- Look at recent PRs and commits for examples

## Thank You

Your contributions help protect users from accidental data leaks. We appreciate the time and effort you put into making LeakGuard better!
