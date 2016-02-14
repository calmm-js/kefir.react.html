function createObj(proto) {
  const F = function() {}
  F.prototype = proto
  return new F()
}

function extend(target) {
  const n = arguments.length
  for (let i=1; i<n; ++i)
    for (const p in arguments[i])
      target[p] = arguments[i][p]
  return target
}

export default function(Child, Parent) {
  const n = arguments.length
  Child.prototype = createObj(Parent.prototype)
  Child.prototype.constructor = Child
  for (let i=2; i<n; ++i)
    extend(Child.prototype, arguments[i])
  return Child
}
