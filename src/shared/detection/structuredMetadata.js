(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function stripWrappingQuotes(value) {
    if (!value || value.length < 2) return value;

    const first = value[0];
    const last = value[value.length - 1];

    if (
      (first === "\"" && last === "\"") ||
      (first === "'" && last === "'") ||
      (first === "`" && last === "`")
    ) {
      return value.slice(1, -1);
    }

    return value;
  }

  function normalizeCandidate(value) {
    return stripWrappingQuotes(String(value || "")).trim();
  }

  function getDependencies() {
    return root.PWM.DetectionStructuredMetadataDependencies || {};
  }

  function isCleanPlaceholder(value) {
    const deps = getDependencies();
    return typeof deps.isCleanPlaceholder === "function" ? deps.isCleanPlaceholder(value) : false;
  }

  function containsPlaceholder(value) {
    const deps = getDependencies();
    return typeof deps.containsPlaceholder === "function" ? deps.containsPlaceholder(value) : false;
  }

  function isLikelyEmailAddress(value) {
    const deps = getDependencies();
    return typeof deps.isLikelyEmailAddress === "function" ? deps.isLikelyEmailAddress(value) : false;
  }

  function isLikelyUsernameLikeValue(value) {
    const deps = getDependencies();
    return typeof deps.isLikelyUsernameLikeValue === "function" ? deps.isLikelyUsernameLikeValue(value) : false;
  }

  const STRUCTURED_METADATA_MARKER_REGEX =
    /\b(?:tenant[_\s-]?id|subscription[_\s-]?id|aws\s+account|project[_\s-]?(?:id|number)|openstack|domain[_\s-]?id|server[_\s-]?id|namespace|k8s|kubernetes|file[_\s-]?share|azure[_\s-]?key[_\s-]?vault|key[_\s-]?vault|aws[_\s-]?private[_\s-]?api|private[_\s-]?api|internal[_\s-]?(?:url|endpoint|host)|endpoint|username|service\s+account|email|ldap)\b/i;
  const GUID_VALUE_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const HEX32_VALUE_REGEX = /^[0-9a-f]{32}$/i;
  const AWS_ACCOUNT_ID_VALUE_REGEX = /^\d{12}$/;
  const GCP_PROJECT_VALUE_REGEX = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;
  const GCP_PROJECT_NUMBER_VALUE_REGEX = /^\d{6,12}$/;
  const K8S_NAME_VALUE_REGEX = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
  const K8S_SECRET_RESOURCE_VALUE_REGEX = /^secret\/[a-z0-9][a-z0-9.-]{1,62}$/i;
  const FILE_SHARE_VALUE_REGEX = /^(?:FSA\d{7}|FSB\d{7}|FS\d{7})$/;
  const STORAGE_ACCOUNT_VALUE_REGEX = /^st[a-z0-9]{6,22}$/i;
  const INTERNAL_ENDPOINT_VALUE_REGEX =
    /^(?:https?:\/\/)?[a-z0-9][a-z0-9.-]{1,160}\.(?:internal|corp|local|lan)(?::\d{1,5})?(?:\/[^\s"'`<>]*)?$/i;
  const CLOUD_ENDPOINT_VALUE_REGEX =
    /^(?:https?:\/\/)?[a-z0-9][a-z0-9.-]{1,160}\.(?:privatelink\.[a-z0-9.-]+|private\.[a-z0-9.-]+|cloudapp\.azure\.com|file\.core\.windows\.net|blob\.core\.windows\.net|database\.windows\.net|vault\.azure\.net|openstack\.[a-z0-9.-]+)(?::\d{1,5})?(?:\/[^\s"'`<>]*)?$/i;
  const AWS_PRIVATE_API_ENDPOINT_VALUE_REGEX =
    /^vpce-[0-9a-f]{8,17}\.execute-api\.[a-z0-9-]+\.vpce\.amazonaws\.com$/i;
  const OTC_RESOURCE_VALUE_REGEX =
    /^(?:(?:otc-)?(?:ecs|evs|vpc|subnet|sg|security-group|obs|cce|rds|elb|eip|keypair|image|flavor|as|nat|vpn)|otc)-[a-z0-9][a-z0-9-]{4,62}$/i;
  const DOMAIN_USERNAME_VALUE_REGEX = /^[A-Z][A-Z0-9]{1,30}\\{1,4}[A-Za-z][A-Za-z0-9._-]{2,63}$/i;
  const LDAP_DN_VALUE_REGEX = /^(?:CN|OU|DC)=[^,"'`\r\n]{1,80}(?:,(?:CN|OU|DC)=[^,"'`\r\n]{1,80})+$/i;

  function normalizeStructuredMetadataLabel(label) {
    return String(label || "")
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/[^\w\s/]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function compactStructuredMetadataLabel(label) {
    return normalizeStructuredMetadataLabel(label).replace(/[^a-z0-9]/g, "");
  }

  function hasStructuredMetadataContext(label, pattern) {
    return pattern.test(normalizeStructuredMetadataLabel(label));
  }

  function isOpenStackStructuredLabel(label) {
    return hasStructuredMetadataContext(label, /\b(?:openstack|otc|open telekom cloud)\b/i);
  }

  function hasEnterpriseTokenValue(value) {
    const constants = root.PWM.DetectionConstants || {};
    const tokens = String(value || "").toLowerCase().split(/[-_.]+/).filter(Boolean);
    return tokens.some(
      (token) =>
        constants.ENTERPRISE_ENV_TOKENS?.has(token) ||
        constants.ENTERPRISE_LOCATION_TOKENS?.has(token) ||
        constants.ENTERPRISE_SERVICE_TOKENS?.has(token)
    );
  }

  function isStructuredUsernameValue(value) {
    return DOMAIN_USERNAME_VALUE_REGEX.test(String(value || "")) || isLikelyUsernameLikeValue(value);
  }

  function classifyStructuredMetadataValue(label, rawValue) {
    const raw = normalizeCandidate(rawValue);
    if (!raw || raw.length > 512 || isCleanPlaceholder(raw) || containsPlaceholder(raw)) return null;

    const normalized = normalizeStructuredMetadataLabel(label);
    const compact = compactStructuredMetadataLabel(label);
    const openStackLabel = isOpenStackStructuredLabel(label);

    if (/\b(?:ldap|distinguished name|dn)\b/i.test(normalized) && LDAP_DN_VALUE_REGEX.test(raw)) {
      return "LDAP_DN";
    }

    if (/\bstorage\s+account\b/i.test(normalized) && STORAGE_ACCOUNT_VALUE_REGEX.test(raw)) {
      return "STORAGE_ACCOUNT";
    }

    if (/\botc\b/i.test(normalized) && /\bresource\b/i.test(normalized) && OTC_RESOURCE_VALUE_REGEX.test(raw)) {
      return "OTC_RESOURCE";
    }

    if ((compact.includes("subscriptionid") || /\bsubscription\s+id\b/i.test(normalized)) && GUID_VALUE_REGEX.test(raw)) {
      return "AZURE_SUBSCRIPTION_ID";
    }

    if (compact.includes("tenantid") || /\btenant\s+id\b/i.test(normalized)) {
      if (openStackLabel && (HEX32_VALUE_REGEX.test(raw) || GUID_VALUE_REGEX.test(raw))) {
        return "OPENSTACK_TENANT_ID";
      }
      if (GUID_VALUE_REGEX.test(raw)) return "AZURE_TENANT_ID";
    }

    if (openStackLabel && (compact.includes("projectid") || /\bproject\s+id\b/i.test(normalized))) {
      if (HEX32_VALUE_REGEX.test(raw) || GUID_VALUE_REGEX.test(raw)) return "OPENSTACK_PROJECT_ID";
    }

    if (openStackLabel && (compact.includes("domainid") || /\bdomain\s+id\b/i.test(normalized))) {
      if (HEX32_VALUE_REGEX.test(raw) || GUID_VALUE_REGEX.test(raw)) return "OPENSTACK_DOMAIN_ID";
    }

    if (
      openStackLabel &&
      (compact.includes("serverid") ||
        compact.includes("instanceid") ||
        compact.includes("resourceid") ||
        /\b(?:server|instance|resource)\s+id\b/i.test(normalized))
    ) {
      if (HEX32_VALUE_REGEX.test(raw) || GUID_VALUE_REGEX.test(raw)) return "OPENSTACK_RESOURCE_ID";
    }

    if (/\b(?:aws|amazon)\b/i.test(normalized) && /\baccount(?:\s+id)?\b/i.test(normalized)) {
      if (AWS_ACCOUNT_ID_VALUE_REGEX.test(raw)) return "AWS_ACCOUNT_ID";
    }

    if (compact.includes("projectnumber") || /\bproject\s+number\b/i.test(normalized)) {
      if (GCP_PROJECT_NUMBER_VALUE_REGEX.test(raw)) return "GCP_PROJECT_NUMBER";
    }

    if (compact.includes("projectid") || /\bproject\s+id\b/i.test(normalized)) {
      if (!openStackLabel && GCP_PROJECT_VALUE_REGEX.test(raw)) return "GCP_PROJECT";
    }

    if (/\b(?:kubernetes|k8s)\b/i.test(normalized) && /\bnamespace\b/i.test(normalized)) {
      if (K8S_NAME_VALUE_REGEX.test(raw)) return "K8S_NAMESPACE";
    }

    if (/^namespace$/i.test(normalized) && K8S_NAME_VALUE_REGEX.test(raw) && hasEnterpriseTokenValue(raw)) {
      return "K8S_NAMESPACE";
    }

    if (/\b(?:kubernetes|k8s)\b/i.test(normalized) && /\bresource\b/i.test(normalized)) {
      if (K8S_SECRET_RESOURCE_VALUE_REGEX.test(raw)) return "K8S_SECRET";
    }

    if (/\bfile\s+share\b/i.test(normalized) || compact.includes("fileshare")) {
      if (FILE_SHARE_VALUE_REGEX.test(raw)) return "FILE_SHARE";
    }

    if (/\b(?:aws|amazon)\b/i.test(normalized) && /\b(?:private\s+api|endpoint|url|api)\b/i.test(normalized)) {
      if (AWS_PRIVATE_API_ENDPOINT_VALUE_REGEX.test(raw)) return "AWS_ENDPOINT";
    }

    if (/\b(?:key\s*vault|keyvault|endpoint|url)\b/i.test(normalized)) {
      if (CLOUD_ENDPOINT_VALUE_REGEX.test(raw)) return "CLOUD_ENDPOINT";
    }

    if (/\binternal\b/i.test(normalized) && /\b(?:url|endpoint|host)\b/i.test(normalized)) {
      if (INTERNAL_ENDPOINT_VALUE_REGEX.test(raw)) return "INTERNAL_ENDPOINT";
    }

    if (/\b(?:email|e mail|mail)\b/i.test(normalized) && isLikelyEmailAddress(raw)) {
      return "EMAIL";
    }

    if (
      /\b(?:username|user name|service account|identity owner|login|samaccountname|account)\b/i.test(normalized) &&
      isStructuredUsernameValue(raw)
    ) {
      return "USERNAME";
    }

    return null;
  }

  function structuredMetadataCategory(placeholderType) {
    return placeholderType === "USERNAME" || placeholderType === "EMAIL" ? "identity" : "internal_metadata";
  }

  function pushStructuredMetadataFinding(findings, detector, label, rawCandidate, start, end, source, options = {}) {
    const raw = normalizeCandidate(rawCandidate);
    const placeholderType = classifyStructuredMetadataValue(label, raw);
    if (!placeholderType || !raw || detector.isAllowlisted(raw)) return;
    if (options.skipIdentity && (placeholderType === "USERNAME" || placeholderType === "EMAIL")) return;

    findings.push(
      detector.buildFinding({
        category: structuredMetadataCategory(placeholderType),
        placeholderType,
        raw,
        start,
        end,
        score: placeholderType === "LDAP_DN" ? 100 : 99,
        methods: ["structured-metadata", source, "full-value", "exact-key"]
      })
    );
  }

  function parseStructuredCsvLine(line, delimiter = ",") {
    const input = String(line || "");
    const cells = [];
    let index = 0;
    const isPaddingChar = (char) => char === " " || (delimiter !== "\t" && char === "\t");

    while (index <= input.length) {
      while (isPaddingChar(input[index])) index += 1;
      if (index >= input.length) break;

      if (input[index] === '"') {
        const valueStart = index + 1;
        index += 1;
        let value = "";
        let valueEnd = valueStart;

        while (index < input.length) {
          if (input[index] === '"' && input[index + 1] === '"') {
            value += '"';
            index += 2;
            continue;
          }
          if (input[index] === '"') {
            valueEnd = index;
            index += 1;
            break;
          }
          value += input[index];
          index += 1;
          valueEnd = index;
        }

        while (isPaddingChar(input[index])) index += 1;
        if (input[index] === delimiter) index += 1;
        cells.push({ value, start: valueStart, end: valueEnd });
        continue;
      }

      const rawStart = index;
      while (index < input.length && input[index] !== delimiter) index += 1;
      const rawEnd = index;
      if (input[index] === delimiter) index += 1;

      let start = rawStart;
      let end = rawEnd;
      while (start < end && /\s/.test(input[start])) start += 1;
      while (end > start && /\s/.test(input[end - 1])) end -= 1;
      cells.push({ value: input.slice(start, end), start, end });
    }

    return cells;
  }

  function parseStructuredPipeTableLine(line) {
    const input = String(line || "");
    const cells = [];
    let index = 0;

    while (index < input.length) {
      const pipeIndex = input.indexOf("|", index);
      if (pipeIndex < 0) break;
      const nextPipeIndex = input.indexOf("|", pipeIndex + 1);
      if (nextPipeIndex < 0) break;

      let start = pipeIndex + 1;
      let end = nextPipeIndex;
      while (start < end && /\s/.test(input[start])) start += 1;
      while (end > start && /\s/.test(input[end - 1])) end -= 1;
      cells.push({
        value: input.slice(start, end),
        start,
        end
      });
      index = nextPipeIndex;
    }

    return cells;
  }

  function isStructuredPipeSeparatorLine(line) {
    return /^\s*\|?(?:\s*:?-{2,}:?\s*\|)+\s*:?-{2,}:?\s*\|?\s*$/.test(String(line || ""));
  }

  function decodeStructuredHtmlEntities(value) {
    const decodeCodePoint = (codePoint, fallback) =>
      Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : fallback;

    return String(value || "").replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (match, entity) => {
      const normalized = entity.toLowerCase();
      if (normalized === "amp") return "&";
      if (normalized === "lt") return "<";
      if (normalized === "gt") return ">";
      if (normalized === "quot") return '"';
      if (normalized === "apos") return "'";
      if (normalized.startsWith("#x")) {
        const codePoint = Number.parseInt(normalized.slice(2), 16);
        return decodeCodePoint(codePoint, match);
      }
      if (normalized.startsWith("#")) {
        const codePoint = Number.parseInt(normalized.slice(1), 10);
        return decodeCodePoint(codePoint, match);
      }
      return match;
    });
  }

  function parseStructuredHtmlCells(rowHtml, rowOffset) {
    const cells = [];
    const cellRegex = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch;
    const textFromCellInnerHtml = (value) => {
      const input = String(value || "");
      let output = "";

      for (let index = 0; index < input.length; index += 1) {
        if (input[index] === "<") {
          const closeIndex = input.indexOf(">", index + 1);
          if (closeIndex >= 0) {
            index = closeIndex;
            continue;
          }
        }
        output += input[index];
      }

      return decodeStructuredHtmlEntities(output).trim();
    };

    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      const inner = cellMatch[1];
      const innerOffset = cellMatch[0].indexOf(inner);
      if (innerOffset < 0) continue;

      let start = 0;
      let end = inner.length;
      while (start < end && /\s/.test(inner[start])) start += 1;
      while (end > start && /\s/.test(inner[end - 1])) end -= 1;

      const rawInner = inner.slice(start, end);
      const value = textFromCellInnerHtml(rawInner);
      cells.push({
        value,
        start: rowOffset + cellMatch.index + innerOffset + start,
        end: rowOffset + cellMatch.index + innerOffset + end
      });
    }

    return cells;
  }

  function scanStructuredMetadataRows(text, detector) {
    const input = String(text || "");
    if (!STRUCTURED_METADATA_MARKER_REGEX.test(input)) return [];

    const findings = [];
    const objectRegex = /\{[\s\S]*?\}/g;
    const jsonField = (block, names) => {
      const source = Array.isArray(names) ? names.join("|") : names;
      const regex = new RegExp(`"(${source})"\\s*:\\s*"((?:\\\\.|[^"\\\\\\r\\n])*)"`, "i");
      const match = regex.exec(block);
      if (!match) return null;
      const valueOffset = match[0].lastIndexOf(match[2]);
      if (valueOffset < 0) return null;
      return {
        value: match[2],
        start: match.index + valueOffset,
        end: match.index + valueOffset + match[2].length
      };
    };
    let objectMatch;

    while ((objectMatch = objectRegex.exec(input)) !== null) {
      const block = objectMatch[0];
      const group = jsonField(block, "Group");
      const label = jsonField(block, ["Type", "Key", "Name"]);
      const value = jsonField(block, "Value");
      if (!label || !value) continue;

      const combinedLabel = [group?.value, label.value].filter(Boolean).join(" ");
      pushStructuredMetadataFinding(
        findings,
        detector,
        combinedLabel,
        value.value,
        objectMatch.index + value.start,
        objectMatch.index + value.end,
        "json-row"
      );
    }

    const htmlTableRowRegex = /<tr\b[^>]*>[\s\S]*?<\/tr>/gi;
    let htmlTableHeader = null;
    let htmlRowMatch;

    while ((htmlRowMatch = htmlTableRowRegex.exec(input)) !== null) {
      const cells = parseStructuredHtmlCells(htmlRowMatch[0], htmlRowMatch.index);
      const headerNames = cells.map((cell) => normalizeStructuredMetadataLabel(cell.value));
      const valueColumn = headerNames.indexOf("value");
      const labelColumn = headerNames.findIndex((name) => name === "name" || name === "type" || name === "key");

      if (valueColumn >= 0 && labelColumn >= 0) {
        htmlTableHeader = {
          group: headerNames.indexOf("group"),
          label: labelColumn,
          value: valueColumn
        };
        continue;
      }

      if (htmlTableHeader && cells.length > htmlTableHeader.value) {
        const labelCell = cells[htmlTableHeader.label];
        const valueCell = cells[htmlTableHeader.value];
        const groupCell = htmlTableHeader.group >= 0 ? cells[htmlTableHeader.group] : null;
        if (labelCell && valueCell) {
          const combinedLabel = [groupCell?.value, labelCell.value].filter(Boolean).join(" ");
          pushStructuredMetadataFinding(
            findings,
            detector,
            combinedLabel,
            valueCell.value,
            valueCell.start,
            valueCell.end,
            "html-table-row"
          );
        }
      }
    }

    const lines = input.split(/\n/);
    let offset = 0;
    let previousLabel = null;
    let csvTableHeader = null;
    let pipeTableHeader = null;

    for (const line of lines) {
      const lineWithoutCr = line.endsWith("\r") ? line.slice(0, -1) : line;
      const trimmedLine = lineWithoutCr.trim();
      const looksLikeJsonObject = trimmedLine.startsWith("{") && trimmedLine.endsWith("}");
      const looksLikePipeTable = trimmedLine.startsWith("|") && trimmedLine.includes("|", 1);
      const delimiter = looksLikeJsonObject || looksLikePipeTable
        ? ""
        : lineWithoutCr.includes("\t")
          ? "\t"
          : lineWithoutCr.includes(",")
            ? ","
            : "";
      const cells = delimiter ? parseStructuredCsvLine(lineWithoutCr, delimiter) : [];
      const headerNames = cells.map((cell) => normalizeStructuredMetadataLabel(cell.value));
      const valueColumn = headerNames.indexOf("value");
      const labelColumn = headerNames.findIndex((name) => name === "name" || name === "type" || name === "key");
      const pipeCells = !delimiter && looksLikePipeTable
        ? parseStructuredPipeTableLine(lineWithoutCr)
        : [];
      const pipeHeaderNames = pipeCells.map((cell) => normalizeStructuredMetadataLabel(cell.value));
      const pipeValueColumn = pipeHeaderNames.indexOf("value");
      const pipeLabelColumn = pipeHeaderNames.findIndex((name) => name === "name" || name === "type" || name === "key");
      const assignmentRow =
        !looksLikeJsonObject && !looksLikePipeTable
          ? /^\s*([A-Za-z_][A-Za-z0-9_. -]{0,80})\s*[:=]\s*(?:"([^"\r\n]+)"|'([^'\r\n]+)'|`([^`\r\n]+)`|([^\r\n]+?))\s*$/.exec(
              lineWithoutCr
            )
          : null;

      if (pipeValueColumn >= 0 && pipeLabelColumn >= 0) {
        pipeTableHeader = {
          group: pipeHeaderNames.indexOf("group"),
          label: pipeLabelColumn,
          value: pipeValueColumn
        };
        previousLabel = null;
        offset += line.length + 1;
        continue;
      }

      if (pipeTableHeader && isStructuredPipeSeparatorLine(lineWithoutCr)) {
        previousLabel = null;
        offset += line.length + 1;
        continue;
      }

      if (valueColumn >= 0 && labelColumn >= 0) {
        csvTableHeader = {
          group: headerNames.indexOf("group"),
          label: labelColumn,
          value: valueColumn
        };
        previousLabel = null;
        offset += line.length + 1;
        continue;
      }

      if (pipeTableHeader && pipeCells.length > pipeTableHeader.value) {
        const labelCell = pipeCells[pipeTableHeader.label];
        const valueCell = pipeCells[pipeTableHeader.value];
        const groupCell = pipeTableHeader.group >= 0 ? pipeCells[pipeTableHeader.group] : null;
        if (labelCell && valueCell) {
          const combinedLabel = [groupCell?.value, labelCell.value].filter(Boolean).join(" ");
          pushStructuredMetadataFinding(
            findings,
            detector,
            combinedLabel,
            valueCell.value,
            offset + valueCell.start,
            offset + valueCell.end,
            "pipe-table-row"
          );
        }
        previousLabel = null;
        offset += line.length + 1;
        continue;
      }

      const labelledRow = /^\s*(?:Type|Key|Name)\s*:\s*(.+?)\s*$/.exec(lineWithoutCr);
      if (labelledRow) {
        previousLabel = {
          value: labelledRow[1].replace(/^["']|["']$/g, "").trim(),
          lineOffset: offset
        };
        offset += line.length + 1;
        continue;
      }

      const valueRow = /^\s*Value\s*:\s*(.+?)\s*$/.exec(lineWithoutCr);
      if (valueRow && previousLabel) {
        const rawCandidate = valueRow[1].replace(/^["']|["']$/g, "").trim();
        const rawStartInLine = lineWithoutCr.indexOf(valueRow[1]) + valueRow[1].indexOf(rawCandidate);
        pushStructuredMetadataFinding(
          findings,
          detector,
          previousLabel.value,
          rawCandidate,
          offset + rawStartInLine,
          offset + rawStartInLine + rawCandidate.length,
          "table-row"
        );
        previousLabel = null;
        offset += line.length + 1;
        continue;
      }

      if (assignmentRow) {
        const rawCandidate = [assignmentRow[2], assignmentRow[3], assignmentRow[4], assignmentRow[5]].find(
          (candidate) => typeof candidate === "string"
        );
        const raw = normalizeCandidate(rawCandidate);
        const rawStartInLine = lineWithoutCr.indexOf(rawCandidate) + String(rawCandidate || "").indexOf(raw);
        const previousCount = findings.length;
        if (raw && rawStartInLine >= 0) {
          pushStructuredMetadataFinding(
            findings,
            detector,
            assignmentRow[1],
            raw,
            offset + rawStartInLine,
            offset + rawStartInLine + raw.length,
            "assignment-row",
            { skipIdentity: true }
          );
        }
        if (findings.length > previousCount) {
          previousLabel = null;
          offset += line.length + 1;
          continue;
        }
      }

      if (csvTableHeader && cells.length > csvTableHeader.value) {
        const labelCell = cells[csvTableHeader.label];
        const valueCell = cells[csvTableHeader.value];
        const groupCell = csvTableHeader.group >= 0 ? cells[csvTableHeader.group] : null;
        if (labelCell && valueCell) {
          const combinedLabel = [groupCell?.value, labelCell.value].filter(Boolean).join(" ");
          pushStructuredMetadataFinding(
            findings,
            detector,
            combinedLabel,
            valueCell.value,
            offset + valueCell.start,
            offset + valueCell.end,
            "csv-table-row"
          );
        }
        previousLabel = null;
        offset += line.length + 1;
        continue;
      }

      if (lineWithoutCr.trim() === "") {
        previousLabel = null;
        csvTableHeader = null;
        pipeTableHeader = null;
        offset += line.length + 1;
        continue;
      }

      if (cells.length >= 2 && !/^type$/i.test(cells[0].value) && !/^name$/i.test(cells[0].value)) {
        pushStructuredMetadataFinding(
          findings,
          detector,
          cells[0].value,
          cells[1].value,
          offset + cells[1].start,
          offset + cells[1].end,
          "csv-row"
        );
      }

      previousLabel = null;
      offset += line.length + 1;
    }

    return findings;
  }


  root.PWM.DetectionStructuredMetadata = Object.freeze({
    STRUCTURED_METADATA_MARKER_REGEX,
    normalizeStructuredMetadataLabel,
    compactStructuredMetadataLabel,
    classifyStructuredMetadataValue,
    structuredMetadataCategory,
    pushStructuredMetadataFinding,
    parseStructuredCsvLine,
    parseStructuredPipeTableLine,
    parseStructuredHtmlCells,
    scanStructuredMetadataRows
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.DetectionStructuredMetadata;
  }
})();
