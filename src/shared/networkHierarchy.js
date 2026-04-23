(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function subnetContains(parent, child) {
    if (!parent || !child) return false;
    return parent.startInt <= child.startInt && parent.endInt >= child.endInt;
  }

  function chooseClosestParent(candidate, parents) {
    let chosen = null;

    for (const parent of parents) {
      if (parent.original === candidate.original) continue;
      if (!subnetContains(parent, candidate)) continue;
      if ((parent.prefix || 0) >= (candidate.prefix || 0)) continue;

      if (!chosen || (parent.prefix || 0) > (chosen.prefix || 0)) {
        chosen = parent;
      }
    }

    return chosen;
  }

  function buildNetworkHierarchy(candidates, options = {}) {
    const current = [...(candidates || [])];
    const existingSubnets = (options.existingObjects || []).filter(
      (object) => object && !object.isHost && object.version === 4
    );
    const subnets = current
      .filter((candidate) => candidate && candidate.isSubnet)
      .sort((left, right) => {
        if ((left.prefix || 0) !== (right.prefix || 0)) {
          return (left.prefix || 0) - (right.prefix || 0);
        }
        if ((left.startInt || 0) !== (right.startInt || 0)) {
          return (left.startInt || 0) - (right.startInt || 0);
        }
        return String(left.original).localeCompare(String(right.original));
      });
    const hosts = current
      .filter((candidate) => candidate && candidate.isHost)
      .sort((left, right) => {
        if ((left.start || 0) !== (right.start || 0)) {
          return (left.start || 0) - (right.start || 0);
        }
        return String(left.original).localeCompare(String(right.original));
      });
    const subnetResults = subnets.map((subnet) => {
      const parent = chooseClosestParent(subnet, [...subnets, ...existingSubnets]);
      return {
        ...subnet,
        parentOriginal: parent ? parent.original : null
      };
    });

    const hostResults = hosts.map((host) => {
      const parent = chooseClosestParent(host, [
        ...subnetResults,
        ...existingSubnets
      ]);

      return {
        ...host,
        parentOriginal: parent ? parent.original : null
      };
    });

    return [
      ...subnetResults,
      ...hostResults
    ];
  }

  root.PWM.buildNetworkHierarchy = buildNetworkHierarchy;
  root.PWM.subnetContains = subnetContains;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      buildNetworkHierarchy,
      subnetContains
    };
  }
})();
