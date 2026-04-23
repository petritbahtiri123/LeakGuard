(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  const IPV4_VISIBLE_RANGES = [
    { label: "special", start: ipToInt("0.0.0.0"), end: ipToInt("0.255.255.255") },
    { label: "private", start: ipToInt("10.0.0.0"), end: ipToInt("10.255.255.255") },
    { label: "private", start: ipToInt("172.16.0.0"), end: ipToInt("172.31.255.255") },
    { label: "private", start: ipToInt("192.168.0.0"), end: ipToInt("192.168.255.255") },
    { label: "loopback", start: ipToInt("127.0.0.0"), end: ipToInt("127.255.255.255") },
    { label: "link_local", start: ipToInt("169.254.0.0"), end: ipToInt("169.254.255.255") }
  ];

  function ipToInt(ip) {
    const octets = String(ip || "")
      .split(".")
      .map((value) => Number(value));

    return (
      ((octets[0] << 24) >>> 0) +
      ((octets[1] << 16) >>> 0) +
      ((octets[2] << 8) >>> 0) +
      (octets[3] >>> 0)
    ) >>> 0;
  }

  function intToIp(value) {
    const input = Number(value) >>> 0;
    return [
      (input >>> 24) & 255,
      (input >>> 16) & 255,
      (input >>> 8) & 255,
      input & 255
    ].join(".");
  }

  function parseIpv4Address(rawValue) {
    const input = String(rawValue || "");
    const parts = input.split(".");

    if (parts.length !== 4) return null;

    const octets = [];

    for (const part of parts) {
      if (!/^\d{1,3}$/.test(part)) return null;
      if (part.length > 1 && part.startsWith("0")) return null;

      const value = Number(part);
      if (!Number.isInteger(value) || value < 0 || value > 255) return null;
      octets.push(value);
    }

    const canonical = octets.join(".");

    return {
      version: 4,
      octets,
      canonical,
      intValue: ipToInt(canonical)
    };
  }

  function prefixMask(prefix) {
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null;
    if (prefix === 0) return 0;
    return (0xffffffff << (32 - prefix)) >>> 0;
  }

  function parseIpv4Cidr(rawValue) {
    const input = String(rawValue || "");
    const slashIndex = input.indexOf("/");

    if (slashIndex <= 0) return null;

    const address = input.slice(0, slashIndex);
    const prefixText = input.slice(slashIndex + 1);

    if (!/^\d{1,2}$/.test(prefixText)) return null;

    const prefix = Number(prefixText);
    const parsedAddress = parseIpv4Address(address);

    if (!parsedAddress || prefix < 0 || prefix > 32) return null;

    const mask = prefixMask(prefix);
    const startInt = (parsedAddress.intValue & mask) >>> 0;
    const hostMask = (~mask) >>> 0;
    const endInt = (startInt | hostMask) >>> 0;
    const canonicalAddress = intToIp(startInt);

    return {
      version: 4,
      kind: "subnet",
      prefix,
      canonical: `${canonicalAddress}/${prefix}`,
      address: canonicalAddress,
      intValue: parsedAddress.intValue,
      startInt,
      endInt
    };
  }

  function classifyIpv4Int(intValue) {
    for (const range of IPV4_VISIBLE_RANGES) {
      if (intValue >= range.start && intValue <= range.end) {
        return {
          scope: range.label,
          isVisibleByDefault: true,
          isPublic: false
        };
      }
    }

    return {
      scope: "public",
      isVisibleByDefault: false,
      isPublic: true
    };
  }

  function classifyIpv4Range(startInt, endInt) {
    for (const range of IPV4_VISIBLE_RANGES) {
      if (startInt >= range.start && endInt <= range.end) {
        return {
          scope: range.label,
          isVisibleByDefault: true,
          isPublic: false
        };
      }
    }

    return {
      scope: "public",
      isVisibleByDefault: false,
      isPublic: true
    };
  }

  function classifyNetworkToken(rawValue) {
    const input = String(rawValue || "").trim();
    const cidr = parseIpv4Cidr(input);

    if (cidr) {
      if (cidr.startInt === 0 && cidr.endInt === 0xffffffff && cidr.prefix === 0) {
        return {
          ...cidr,
          kind: "special_subnet",
          isHost: false,
          isSubnet: true,
          isPublic: false,
          scope: "default_route",
          isVisibleByDefault: true
        };
      }

      const visibility = classifyIpv4Range(cidr.startInt, cidr.endInt);

      return {
        ...cidr,
        kind: visibility.isPublic ? "public_subnet" : "private_subnet",
        isHost: false,
        isSubnet: true,
        isPublic: visibility.isPublic,
        scope: visibility.scope,
        isVisibleByDefault: visibility.isVisibleByDefault
      };
    }

    const host = parseIpv4Address(input);
    if (!host) return null;

    if (host.intValue === 0xffffffff) {
      return {
        ...host,
        kind: "special_host",
        isHost: true,
        isSubnet: false,
        prefix: 32,
        startInt: host.intValue,
        endInt: host.intValue,
        isPublic: false,
        scope: "broadcast",
        isVisibleByDefault: true
      };
    }

    const visibility = classifyIpv4Int(host.intValue);

    return {
      ...host,
      kind: visibility.isPublic ? "public_host" : "private_host",
      isHost: true,
      isSubnet: false,
      prefix: 32,
      startInt: host.intValue,
      endInt: host.intValue,
      isPublic: visibility.isPublic,
      scope: visibility.scope,
      isVisibleByDefault: visibility.isVisibleByDefault
    };
  }

  function shouldPseudonymizeNetwork(candidate, mode) {
    const normalizedMode = String(mode || "hide_public").toLowerCase();

    if (!candidate) return false;
    if (normalizedMode === "raw") return false;
    if (normalizedMode === "hide_all") return true;

    return Boolean(candidate.isPublic);
  }

  root.PWM.IPV4_VISIBLE_RANGES = IPV4_VISIBLE_RANGES;
  root.PWM.ipToInt = ipToInt;
  root.PWM.intToIp = intToIp;
  root.PWM.parseIpv4Address = parseIpv4Address;
  root.PWM.parseIpv4Cidr = parseIpv4Cidr;
  root.PWM.classifyIpv4Int = classifyIpv4Int;
  root.PWM.classifyIpv4Range = classifyIpv4Range;
  root.PWM.classifyNetworkToken = classifyNetworkToken;
  root.PWM.shouldPseudonymizeNetwork = shouldPseudonymizeNetwork;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      IPV4_VISIBLE_RANGES,
      ipToInt,
      intToIp,
      parseIpv4Address,
      parseIpv4Cidr,
      classifyIpv4Int,
      classifyIpv4Range,
      classifyNetworkToken,
      shouldPseudonymizeNetwork
    };
  }
})();
