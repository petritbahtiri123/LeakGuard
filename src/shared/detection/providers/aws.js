(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};
  const { getContextWindow } = root.PWM.DetectionContext;
  const { hasProviderContext } = root.PWM.CloudScoring;
  function push(findings, detector, raw, start, end, placeholderType, score, methods) {
    if (!raw || detector.isAllowlisted(raw)) return;
    findings.push(detector.buildFinding({ category: "internal_metadata", placeholderType, raw, start, end, score, methods }));
  }
  function scan(text, detector) {
    const findings = [];
    const input = String(text || "");
    for (let match, re = /\barn:aws[a-z-]*:[A-Za-z0-9-]*:[A-Za-z0-9-]*:(?:\d{12})?:[^\s"'`<>]+/g; (match = re.exec(input)) !== null;) push(findings, detector, match[0], match.index, match.index + match[0].length, "AWS_ARN", 94, ["cloud-provider", "aws", "arn"]);
    for (let match, re = /\b(?:i|vpc|subnet|sg|eni|vol|snap|ami|rtb|nat|igw|eipalloc)-[0-9a-f]{8,17}\b/g; (match = re.exec(input)) !== null;) push(findings, detector, match[0], match.index, match.index + match[0].length, "AWS_RESOURCE_ID", hasProviderContext(input, match.index, match.index + match[0].length) ? 88 : 76, ["cloud-provider", "aws", "resource-id"]);
    for (let match, re = /\b\d{12}\b/g; (match = re.exec(input)) !== null;) if (/\b(?:aws|account|account\s*id|iam|arn)\b/i.test(getContextWindow(input, match.index, match.index + match[0].length, 80))) push(findings, detector, match[0], match.index, match.index + match[0].length, "AWS_ACCOUNT_ID", 82, ["cloud-provider", "aws", "account-id", "context-key"]);
    for (let match, re = /\bs3:\/\/([a-z0-9][a-z0-9.-]{1,61}[a-z0-9])(?:\/[^\s"'`<>]*)?/g; (match = re.exec(input)) !== null;) { const start = match.index + match[0].indexOf(match[1]); push(findings, detector, match[1], start, start + match[1].length, "S3_BUCKET", 88, ["cloud-provider", "aws", "s3-bucket"]); }
    for (let match, re = /\b[a-z0-9][a-z0-9.-]{1,100}\.(?:s3[.-][a-z0-9-]+|s3|rds|ec2)[.-][a-z0-9-]+\.amazonaws\.com\b/gi; (match = re.exec(input)) !== null;) push(findings, detector, match[0], match.index, match.index + match[0].length, match[0].includes(".s3") ? "AWS_ENDPOINT" : "CLOUD_ENDPOINT", 86, ["cloud-provider", "aws", "endpoint"]);
    return findings;
  }
  root.PWM.CloudProviderDetectors = root.PWM.CloudProviderDetectors || {};
  root.PWM.CloudProviderDetectors.aws = { scan };
})();
