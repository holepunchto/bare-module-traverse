// One set of conditions for each host, each with the targeted conditions. A
// host whose conditions are targeted in every set already has its resolutions,
// so it gets no set of its own.
module.exports = function conditions(base, hosts, targets) {
  const subsets = leaves(targets)

  const own = hosts.filter(
    (host) =>
      !subsets.every((subset) => host.split('-').every((condition) => subset.includes(condition)))
  )

  return (own.length > 0 ? own : hosts).flatMap((host) =>
    subsets.map((subset) => [...base, ...host.split('-'), ...subset])
  )
}

// Conditions nest to any depth and are tried depth first, so they match as
// their innermost lists would in order.
function leaves(conditions) {
  if (conditions.every((condition) => typeof condition === 'string')) return [conditions]

  return conditions.flatMap(leaves)
}
