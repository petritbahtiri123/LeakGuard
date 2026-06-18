(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  const ENTROPY_CONFIG = Object.freeze({
    contextValueMinEntropy: 2.8,
    contextValueMinLength: 8,
    generalMinEntropy: 4.2,
    generalMinLength: 20,
    base64MinEntropy: 4.35,
    base64MinLength: 20,
    hexMinEntropy: 3.45,
    hexMinLength: 32,
    entropyOnlyShortTokenBlock: 20
  });

  function calculateEntropy(str) {
    if (!str || !str.length) return 0;

    const frequencies = Object.create(null);
    for (const ch of str) {
      frequencies[ch] = (frequencies[ch] || 0) + 1;
    }

    const length = str.length;
    let entropy = 0;

    for (const count of Object.values(frequencies)) {
      const probability = count / length;
      entropy -= probability * Math.log2(probability);
    }

    return entropy;
  }

  function hasMixedClasses(str) {
    return {
      lower: /[a-z]/.test(str),
      upper: /[A-Z]/.test(str),
      digit: /\d/.test(str),
      symbol: /[^A-Za-z0-9]/.test(str)
    };
  }

  function countCharacterClasses(str) {
    return countClassVariety(str);
  }

  function classifyTokenAlphabet(str) {
    const input = String(str || "");
    if (!input) return "general";
    if (/^[a-fA-F0-9]+$/.test(input)) return "hex";
    if (/^[A-Za-z0-9+/=_-]+$/.test(input)) return "base64ish";
    return "general";
  }

  function countClassVariety(str) {
    const classes = hasMixedClasses(str);
    return (
      Number(classes.lower) +
      Number(classes.upper) +
      Number(classes.digit) +
      Number(classes.symbol)
    );
  }

  function looksStructuredLikeSecret(str) {
    if (!str || str.length < 12) return false;

    const variety = countClassVariety(str);
    const entropy = calculateEntropy(str);
    const alphabet = classifyTokenAlphabet(str);

    if (
      str.length >= ENTROPY_CONFIG.contextValueMinLength &&
      entropy >= ENTROPY_CONFIG.contextValueMinEntropy &&
      variety >= 3
    ) {
      return true;
    }
    if (
      alphabet === "base64ish" &&
      str.length >= ENTROPY_CONFIG.base64MinLength &&
      entropy >= ENTROPY_CONFIG.base64MinEntropy &&
      variety >= 2
    ) {
      return true;
    }

    return false;
  }

  root.PWM.ENTROPY_CONFIG = ENTROPY_CONFIG;
  root.PWM.calculateEntropy = calculateEntropy;
  root.PWM.hasMixedClasses = hasMixedClasses;
  root.PWM.countCharacterClasses = countCharacterClasses;
  root.PWM.classifyTokenAlphabet = classifyTokenAlphabet;
  root.PWM.countClassVariety = countClassVariety;
  root.PWM.looksStructuredLikeSecret = looksStructuredLikeSecret;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      ENTROPY_CONFIG,
      calculateEntropy,
      hasMixedClasses,
      countCharacterClasses,
      classifyTokenAlphabet,
      countClassVariety,
      looksStructuredLikeSecret
    };
  }
})();
