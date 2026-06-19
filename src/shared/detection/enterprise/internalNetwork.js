(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};
  const { push } = root.PWM.EnterpriseDetectors.shared;

  function parseIpv4(raw) {
    const parts = String(raw || "").split(".");
    if (parts.length !== 4) return null;
    const octets = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : NaN));
    if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return null;
    return octets;
  }

  function isPrivateIpv4(octets) {
    return octets[0] === 10 || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) || (octets[0] === 192 && octets[1] === 168);
  }

  function isDocumentationIpv4(octets) {
    return (octets[0] === 192 && octets[1] === 0 && octets[2] === 2) || (octets[0] === 198 && octets[1] === 51 && octets[2] === 100) || (octets[0] === 203 && octets[1] === 0 && octets[2] === 113);
  }

  function scan(text, detector) {
    const findings = [];
    const input = String(text || "");
    const cidrRanges = [];

    for (let match, re = /\b((?:\d{1,3}\.){3}\d{1,3})\/(\d{1,2})\b/g; (match = re.exec(input)) !== null;) {
      const octets = parseIpv4(match[1]);
      const prefix = Number(match[2]);
      if (!octets || prefix < 0 || prefix > 32 || isDocumentationIpv4(octets) || !isPrivateIpv4(octets)) continue;
      push(findings, detector, match[0], match.index, match.index + match[0].length, "PRIVATE_CIDR", 99, ["enterprise", "private-cidr", "strict-network"]);
      cidrRanges.push({ start: match.index, end: match.index + match[0].length });
    }

    for (let match, re = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g; (match = re.exec(input)) !== null;) {
      const octets = parseIpv4(match[0]);
      if (!octets || isDocumentationIpv4(octets) || !isPrivateIpv4(octets)) continue;
      const start = match.index;
      const end = start + match[0].length;
      if (input[end] === "/") continue;
      if (cidrRanges.some((range) => start >= range.start && end <= range.end)) continue;
      push(findings, detector, match[0], start, end, "PRIVATE_IP", 82, ["enterprise", "private-ip", "strict-network"]);
    }

    return findings;
  }

  root.PWM.EnterpriseDetectors = root.PWM.EnterpriseDetectors || {};
  root.PWM.EnterpriseDetectors.internalNetwork = { scan, parseIpv4, isPrivateIpv4, isDocumentationIpv4 };
})();
