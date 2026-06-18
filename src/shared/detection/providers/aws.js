(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};
  const { getContextWindow } = root.PWM.DetectionContext;
  const { hasProviderContext } = root.PWM.CloudScoring;
  function push(findings, detector, raw, start, end, placeholderType, score, methods) {
    if (!raw || detector.isAllowlisted(raw)) return;
    findings.push(detector.buildFinding({ category: "internal_metadata", placeholderType, raw, start, end, score, methods }));
  }
  function hasSurroundingArnContext(input, start, end) {
    const before = input.slice(Math.max(0, start - 96), start);
    const after = input.slice(end, Math.min(input.length, end + 96));
    return /\b(?:aws|amazon\s+web\s+services|account|account\s*id|iam|role|policy|resource|arn|credential)\b/i.test(`${before} ${after}`);
  }
  function getLine(input, start, end) {
    const lineStart = input.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const lineEndIndex = input.indexOf("\n", Math.max(0, end));
    const lineEnd = lineEndIndex >= 0 ? lineEndIndex : input.length;
    return input.slice(lineStart, lineEnd);
  }
  function hasDocumentationOnlyAwsMetadataContext(input, start, end) {
    const line = getLine(input, start, end);
    return /\b(?:format|formats|identifier|identifiers|such as|example|sample|docs?|documentation|reference)\b/i.test(line) &&
      !/\b(?:owns|owner|root|prod(?:uction)?|credential|login|admin|internal|protects|backup|grants|assume)\b/i.test(line);
  }
  function trimTrailingArnPunctuation(raw) {
    return String(raw || "").replace(/[.,;]+$/g, "");
  }
  function isInsideAwsArn(input, start, end) {
    const before = input.slice(Math.max(0, start - 80), start);
    const after = input.slice(end, Math.min(input.length, end + 2));
    return /\barn:aws[a-z-]*:[A-Za-z0-9-]*:[A-Za-z0-9-]*:$/.test(before) && after.startsWith(":");
  }
  function scan(text, detector) {
    const findings = [];
    const input = String(text || "");
    for (let match, re = /\barn:aws[a-z-]*:[A-Za-z0-9-]*:[A-Za-z0-9-]*:(?:\d{12})?:[^\s"'`<>]+/g; (match = re.exec(input)) !== null;) {
      const raw = trimTrailingArnPunctuation(match[0]);
      const end = match.index + raw.length;
      if (!hasDocumentationOnlyAwsMetadataContext(input, match.index, end) && hasSurroundingArnContext(input, match.index, end)) {
        push(findings, detector, raw, match.index, end, "AWS_ARN", 94, ["cloud-provider", "aws", "arn"]);
      }
    }
    for (let match, re = /\b(?:i|vpc|subnet|sg|eni|vol|snap|ami|rtb|nat|igw|eipalloc)-[0-9a-f]{8,17}\b/g; (match = re.exec(input)) !== null;) push(findings, detector, match[0], match.index, match.index + match[0].length, "AWS_RESOURCE_ID", hasProviderContext(input, match.index, match.index + match[0].length) ? 88 : 76, ["cloud-provider", "aws", "resource-id"]);
    for (let match, re = /\b\d{12}\b/g; (match = re.exec(input)) !== null;) if (!isInsideAwsArn(input, match.index, match.index + match[0].length) && !hasDocumentationOnlyAwsMetadataContext(input, match.index, match.index + match[0].length) && /\b(?:aws|account|account\s*id|iam|arn)\b/i.test(getContextWindow(input, match.index, match.index + match[0].length, 80))) push(findings, detector, match[0], match.index, match.index + match[0].length, "AWS_ACCOUNT_ID", 82, ["cloud-provider", "aws", "account-id", "context-key"]);
    for (let match, re = /\bs3:\/\/([a-z0-9][a-z0-9.-]{1,61}[a-z0-9])(?:\/[^\s"'`<>]*)?/g; (match = re.exec(input)) !== null;) { const start = match.index + match[0].indexOf(match[1]); push(findings, detector, match[1], start, start + match[1].length, "S3_BUCKET", 88, ["cloud-provider", "aws", "s3-bucket"]); }
    for (let match, re = /\b[a-z0-9][a-z0-9.-]{1,100}\.(?:s3[.-][a-z0-9-]+|s3|rds|ec2)[.-][a-z0-9-]+\.amazonaws\.com\b/gi; (match = re.exec(input)) !== null;) push(findings, detector, match[0], match.index, match.index + match[0].length, match[0].includes(".s3") ? "AWS_ENDPOINT" : "CLOUD_ENDPOINT", 86, ["cloud-provider", "aws", "endpoint"]);
    return findings;
  }
  root.PWM.CloudProviderDetectors = root.PWM.CloudProviderDetectors || {};
  root.PWM.CloudProviderDetectors.aws = { scan };
})();
