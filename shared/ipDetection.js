(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  const { classifyNetworkToken } = root.PWM;
  const IPV4_CANDIDATE_REGEX =
    /(?:^|[^0-9A-Za-z_.])((?:\d{1,3}\.){3}\d{1,3}(?:\/(?:3[0-2]|[12]?\d))?)(?=$|[^0-9A-Za-z_.])/g;
  const ROLE_PATTERNS = [
    {
      role: "GW",
      before: /(?:^|[\s([{"',;])(?:default gateway|gateway|gw)\s*(?:is|=|:)?\s*$/i
    },
    {
      role: "VIP",
      before: /(?:^|[\s([{"',;])vip\s*(?:is|=|:)?\s*$/i
    },
    {
      role: "DNS",
      before: /(?:^|[\s([{"',;])(?:dns|name server|resolver)\s*(?:is|=|:)?\s*$/i
    }
  ];

  function inferNetworkRole(text, start, end, candidate) {
    if (!candidate?.isHost) return null;

    const input = String(text || "");
    const before = input.slice(Math.max(0, start - 24), start);
    for (const entry of ROLE_PATTERNS) {
      if (entry.before.test(before)) {
        return entry.role;
      }
    }

    return null;
  }

  function detectIpCandidates(text) {
    const input = String(text || "");
    const results = [];
    let match;

    while ((match = IPV4_CANDIDATE_REGEX.exec(input)) !== null) {
      const raw = match[1];
      const start = match.index + match[0].indexOf(raw);
      const end = start + raw.length;
      const classification = classifyNetworkToken(raw);

      if (!classification) continue;

      results.push({
        id: `net_${String(results.length + 1).padStart(4, "0")}`,
        raw,
        original: classification.canonical,
        start,
        end,
        role: inferNetworkRole(input, start, end, classification),
        ...classification
      });
    }

    return results;
  }

  root.PWM.IPV4_CANDIDATE_REGEX = IPV4_CANDIDATE_REGEX;
  root.PWM.detectIpCandidates = detectIpCandidates;
  root.PWM.inferNetworkRole = inferNetworkRole;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      IPV4_CANDIDATE_REGEX,
      detectIpCandidates,
      inferNetworkRole
    };
  }
})();
