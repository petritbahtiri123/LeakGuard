(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

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
    if (variety >= 3) return true;

    if (/^[A-Fa-f0-9]{24,}$/.test(str)) return true;
    if (/^[A-Za-z0-9+/_=-]{20,}$/.test(str) && calculateEntropy(str) >= 4.1) return true;

    return false;
  }

  root.PWM.calculateEntropy = calculateEntropy;
  root.PWM.hasMixedClasses = hasMixedClasses;
  root.PWM.countClassVariety = countClassVariety;
  root.PWM.looksStructuredLikeSecret = looksStructuredLikeSecret;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      calculateEntropy,
      hasMixedClasses,
      countClassVariety,
      looksStructuredLikeSecret
    };
  }
})();
