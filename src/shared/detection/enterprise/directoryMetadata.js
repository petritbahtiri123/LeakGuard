(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};
  const { push } = root.PWM.EnterpriseDetectors.shared;

  

  function scan(text, detector) {
    const findings = [];
    const input = String(text || "");

    for (let match, re = /\b(?:cifs|host|HTTP|MSSQLSvc|ldap|GC|DNS|RestrictedKrbHost|TERMSRV|WSMAN)\/[A-Za-z0-9][A-Za-z0-9._-]{1,120}(?::\d{1,5})?\b/g; (match = re.exec(input)) !== null;) {
      push(findings, detector, match[0], match.index, match.index + match[0].length, "SPN", 100, ["enterprise", "spn", "strict-prefix"]);
    }

    const dnComponent = "(?:CN|OU|DC)=[^,\"'`\\r\\n]{1,80}";
    for (let match, re = new RegExp(`\\b${dnComponent}(?:,${dnComponent})+`, "gi"); (match = re.exec(input)) !== null;) {
      push(findings, detector, match[0], match.index, match.index + match[0].length, "LDAP_DN", 100, ["enterprise", "ldap-dn", "strict-components"]);
    }

    return findings;
  }

  root.PWM.EnterpriseDetectors = root.PWM.EnterpriseDetectors || {};
  root.PWM.EnterpriseDetectors.directoryMetadata = { scan };
})();
