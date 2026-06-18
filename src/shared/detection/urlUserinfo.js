(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  const URL_USERINFO_SCHEMES = new Set([
    "postgres",
    "postgresql",
    "mysql",
    "mariadb",
    "mongodb",
    "mongodb+srv",
    "redis",
    "amqp",
    "mssql",
    "sqlserver",
    "https",
    "http",
    "ftp",
    "sftp",
    "smtp"
  ]);

  function safeDecodeURIComponent(value) {
    try {
      return decodeURIComponent(String(value || ""));
    } catch {
      return String(value || "");
    }
  }

  function isSupportedUrlUserinfoScheme(scheme) {
    return URL_USERINFO_SCHEMES.has(String(scheme || "").toLowerCase());
  }

  function getUrlTokenEnd(text, start) {
    const input = String(text || "");
    let end = Math.max(0, start);

    while (end < input.length && !/[\s'"`<>]/.test(input[end])) {
      end += 1;
    }

    return end;
  }

  function getAuthorityEnd(token, authorityStart) {
    const input = String(token || "");
    let end = input.length;

    for (const delimiter of ["/", "?", "#"]) {
      const index = input.indexOf(delimiter, authorityStart);
      if (index >= 0 && index < end) {
        end = index;
      }
    }

    return end;
  }

  function getHostFromHostport(hostport) {
    const value = String(hostport || "");
    if (value.startsWith("[")) {
      const closing = value.indexOf("]");
      if (closing < 0) return "";
      const suffix = value.slice(closing + 1);
      if (suffix && !/^:\d{1,5}$/.test(suffix)) return "";
      return value.slice(0, closing + 1);
    }

    const colonCount = (value.match(/:/g) || []).length;
    if (colonCount === 1) {
      return value.slice(0, value.lastIndexOf(":"));
    }
    if (colonCount > 1) {
      return "";
    }

    return value;
  }

  function isValidUrlCredentialHostport(hostport) {
    const value = String(hostport || "");
    if (!value || /\s/.test(value) || /@/.test(value)) return false;

    const host = getHostFromHostport(value).replace(/\.$/, "");
    if (!host) return false;
    if (/^\[[0-9A-Fa-f:.]+\]$/.test(host)) return true;
    if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host)) return true;
    if (/^localhost$/i.test(host)) return true;

    return /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/.test(
      host
    );
  }

  function parseUrlUserinfoToken(token, tokenStart = 0) {
    const raw = String(token || "");
    const schemeMatch = /^([A-Za-z][A-Za-z0-9+.-]*):\/\//.exec(raw);
    if (!schemeMatch) return null;

    const scheme = schemeMatch[1].toLowerCase();
    if (!isSupportedUrlUserinfoScheme(scheme)) return null;

    const authorityStart = schemeMatch[0].length;
    const authorityEnd = getAuthorityEnd(raw, authorityStart);
    const authority = raw.slice(authorityStart, authorityEnd);
    if (!authority || /\s/.test(authority)) return null;

    const separatorAt = authority.lastIndexOf("@");
    if (separatorAt <= 0) return null;

    const userinfo = authority.slice(0, separatorAt);
    const hostport = authority.slice(separatorAt + 1);
    if (!isValidUrlCredentialHostport(hostport)) return null;

    const colon = userinfo.indexOf(":");
    if (colon < 0 || colon > separatorAt) return null;

    const usernameRaw = userinfo.slice(0, colon);
    const passwordRaw = userinfo.slice(colon + 1);
    if (!passwordRaw) return null;

    const userinfoStart = tokenStart + authorityStart;
    const usernameStart = userinfoStart;
    const usernameEnd = usernameStart + usernameRaw.length;
    const passwordStart = usernameEnd + 1;
    const passwordEnd = userinfoStart + separatorAt;

    return {
      raw,
      scheme,
      hostport,
      usernameRaw,
      username: safeDecodeURIComponent(usernameRaw),
      usernameStart,
      usernameEnd,
      passwordRaw,
      password: safeDecodeURIComponent(passwordRaw),
      passwordStart,
      passwordEnd
    };
  }

  function collectUrlUserinfoCandidates(text) {
    const input = String(text || "");
    const regex = /\b([A-Za-z][A-Za-z0-9+.-]*:\/\/)/g;
    const candidates = [];
    let match;

    while ((match = regex.exec(input)) !== null) {
      const scheme = String(match[1] || "").slice(0, -3).toLowerCase();
      if (!isSupportedUrlUserinfoScheme(scheme)) continue;

      const tokenEnd = getUrlTokenEnd(input, match.index);
      const token = input.slice(match.index, tokenEnd);
      const candidate = parseUrlUserinfoToken(token, match.index);

      if (candidate) {
        candidates.push(candidate);
      }

      regex.lastIndex = Math.max(regex.lastIndex, tokenEnd);
    }

    return candidates;
  }

  function isDbUriWithCredentials(value) {
    return Boolean(parseUrlUserinfoToken(String(value || ""), 0));
  }

  function isDatabaseUrlUserinfoScheme(scheme) {
    return /^(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis|amqp|mssql|sqlserver)$/.test(
      String(scheme || "")
    );
  }

  root.PWM.DetectionUrlUserinfo = Object.freeze({
    URL_USERINFO_SCHEMES,
    safeDecodeURIComponent,
    isSupportedUrlUserinfoScheme,
    getUrlTokenEnd,
    getAuthorityEnd,
    getHostFromHostport,
    isValidUrlCredentialHostport,
    parseUrlUserinfoToken,
    collectUrlUserinfoCandidates,
    isDbUriWithCredentials,
    isDatabaseUrlUserinfoScheme
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.DetectionUrlUserinfo;
  }
})();
