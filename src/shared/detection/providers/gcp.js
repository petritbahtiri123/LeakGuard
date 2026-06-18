(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};
  function push(findings, detector, raw, start, end, placeholderType, score, methods, category = "internal_metadata") { if (!raw || detector.isAllowlisted(raw)) return; findings.push(detector.buildFinding({ category, placeholderType, raw, start, end, score, methods })); }
  function scan(text, detector) {
    const findings = []; const input = String(text || "");
    for (let match, re = /\b(?:projects\/|project_id\s*[:=]\s*)([a-z][a-z0-9-]{4,28}[a-z0-9])\b/gi; (match = re.exec(input)) !== null;) { const start = match.index + match[0].lastIndexOf(match[1]); push(findings, detector, match[1], start, start + match[1].length, "GCP_PROJECT", 86, ["cloud-provider", "gcp", "project"]); }
    for (let match, re = /\bproject_number\s*[:=]\s*(\d{6,12})\b/gi; (match = re.exec(input)) !== null;) { const start = match.index + match[0].lastIndexOf(match[1]); push(findings, detector, match[1], start, start + match[1].length, "GCP_PROJECT_NUMBER", 84, ["cloud-provider", "gcp", "project-number", "context-key"]); }
    for (let match, re = /\b[A-Za-z0-9._-]+@(?:[a-z][a-z0-9-]{4,28}\.)?(?:iam\.)?gserviceaccount\.com\b/gi; (match = re.exec(input)) !== null;) push(findings, detector, match[0], match.index, match.index + match[0].length, "GCP_SERVICE_ACCOUNT", 90, ["cloud-provider", "gcp", "service-account"], "identity");
    for (let match, re = /\b(?:(?:\/\/)?compute\.googleapis\.com\/projects\/[a-z][a-z0-9-]{4,28}\/[^\s"'`<>]+|(?:gke|gcs)-[a-z0-9][a-z0-9-]{4,62})\b/gi; (match = re.exec(input)) !== null;) push(findings, detector, match[0], match.index, match.index + match[0].length, /^gcs-/i.test(match[0]) ? "GCS_BUCKET" : "GCP_RESOURCE", 84, ["cloud-provider", "gcp", "resource"]);
    for (let match, re = /\bgs:\/\/([a-z0-9][a-z0-9._-]{1,61}[a-z0-9])\b/gi; (match = re.exec(input)) !== null;) { const start = match.index + match[0].indexOf(match[1]); push(findings, detector, match[1], start, start + match[1].length, "GCS_BUCKET", 88, ["cloud-provider", "gcp", "gcs-bucket"]); }
    for (let match, re = /\bstorage\.googleapis\.com\/([a-z0-9][a-z0-9._-]{1,61}[a-z0-9])\b/gi; (match = re.exec(input)) !== null;) { const start = match.index + match[0].lastIndexOf(match[1]); push(findings, detector, match[1], start, start + match[1].length, "GCS_BUCKET", 86, ["cloud-provider", "gcp", "gcs-endpoint"]); }
    return findings;
  }
  root.PWM.CloudProviderDetectors = root.PWM.CloudProviderDetectors || {}; root.PWM.CloudProviderDetectors.gcp = { scan };
})();
