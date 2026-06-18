(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};
  const { push } = root.PWM.EnterpriseDetectors.shared;
  const { getContextWindow } = root.PWM.DetectionContext;

  const SHARE_CONTEXT_REGEX = /\b(?:share|file\s*share|azure\s*files|smb|migration|migrate|managed\s*folder|folder\s*owner|ntfs|acl|rbac|storage\s*account|gfs|ngfs)\b/i;

  function scan(text, detector) {
    const findings = [];
    const input = String(text || "");

    for (let match, re = /\b(?:FSA\d{7}|FSB\d{7}|FS\d{7})\b/g; (match = re.exec(input)) !== null;) {
      if (!SHARE_CONTEXT_REGEX.test(getContextWindow(input, match.index, match.index + match[0].length, 80))) continue;
      push(findings, detector, match[0], match.index, match.index + match[0].length, "FILE_SHARE", 78, ["enterprise", "file-share", "context"]);
    }

    return findings;
  }

  root.PWM.EnterpriseDetectors = root.PWM.EnterpriseDetectors || {};
  root.PWM.EnterpriseDetectors.fileShares = { scan, SHARE_CONTEXT_REGEX };
})();
