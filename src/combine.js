import * as Kefir from "kefir"
import * as R     from "ramda"

function forEach(template, fn) {
  if (template instanceof Kefir.Observable) {
    fn(template)
  } else {
    const constructor = template && template.constructor

    if (constructor === Array)
      for (let i=0, n=template.length; i<n; ++i)
        forEach(template[i], fn)
    else if (constructor === Object)
      for (const k in template)
        forEach(template[k], fn)
  }
}

function count(template) {
  let count = 0
  forEach(template, () => count += 1)
  return count
}

function subscribe(template, handlers, self) {
  let index = -1
  forEach(template, observable => {
    const i = ++index
    const handler = e => self._handleAny(i, e)
    handlers[i] = handler
    observable.onAny(handler)
  })
}

function unsubscribe(template, handlers) {
  let index = -1
  forEach(template, observable => {
    const handler = handlers[++index]
    if (handler)
      observable.offAny(handler)
  })
}

function combine(template, values, state) {
  if (template instanceof Kefir.Observable) {
    return values[++state.index]
  } else {
    const constructor = template && template.constructor

    if (constructor === Array) {
      const n = template.length
      const next = Array(n)
      for (let i=0; i<n; ++i)
        next[i] = combine(template[i], values, state)
      return next
    } else if (constructor === Object) {
      const next = {}
      for (const k in template)
        next[k] = combine(template[k], values, state)
      return next
    } else {
      return template
    }
  }
}

function invoke(xs) {
  if (!(xs instanceof Array))
    return xs

  const nm1 = xs.length-1
  const f = xs[nm1]
  return f instanceof Function
    ? f(...xs.slice(0, nm1))
    : xs
}

//

function Combine() {
  Kefir.Property.call(this)
}

Combine.prototype = Object.create(Kefir.Property.prototype)

Combine.prototype._maybeEmitValue = function (next) {
  const prev = this._currentEvent
  if (!prev || !R.equals(prev.value, next))
    this._emitValue(next)
}

//

function CombineMany(template, n) {
  Combine.call(this)
  this._template = template
  this._handlers = n
  this._values = null
}

CombineMany.prototype = Object.create(Combine.prototype)

CombineMany.prototype._onActivation = function () {
  const template = this._template
  const n = this._handlers
  const handlers = Array(n)
  const values = Array(n)
  for (let i=0; i<n; ++i) {
    values[i] = this
    handlers[i] = this
  }
  this._handlers = handlers
  this._values = values
  subscribe(template, handlers, this)
}

CombineMany.prototype._handleAny = function (i, e) {
  switch (e.type) {
    case "value": {
      const values = this._values
      values[i] = e.value
      for (let j=0, n=values.length; j<n; ++j)
        if (values[j] === this)
          return
      this._maybeEmitValue(invoke(combine(this._template, values, {index: -1})))
      break
    }
    case "error": {
      this._emitError(e.value)
      break
    }
    default: {
      const handlers = this._handlers
      handlers[i] = null
      for (let j=0, n=handlers.length; j<n; ++j)
        if (handlers[j])
          return
      this._handlers = handlers.length
      this._values = null
      this._emitEnd()
      break
    }
  }
}

CombineMany.prototype._onDeactivation = function () {
  const handlers = this._handlers
  this._handlers = handlers.length
  this._values = null
  unsubscribe(this._template, handlers)
}

//

function CombineOne(template) {
  Combine.call(this)
  this._template = template
  this._handler = null
}

CombineOne.prototype = Object.create(Combine.prototype)

CombineOne.prototype._onActivation = function () {
  const handler = e => this._handleAny(e)
  this._handler = handler
  forEach(this._template, observable => observable.onAny(handler))
}

CombineOne.prototype._handleAny = function (e) {
  switch (e.type) {
    case "value":
      this._maybeEmitValue(invoke(combine(this._template, [e.value], {index: -1})))
      break
    case "error":
      this._emitError(e.value)
      break
    default:
      this._handler = null
      this._emitEnd()
      break
  }
}

CombineOne.prototype._onDeactivation = function () {
  const {_handler} = this
  this._handler = null
  forEach(this._template, observable => observable.offAny(_handler))
}

//

function CombineOneWith(observable, fn) {
  Combine.call(this)
  this._observable = observable
  this._fn = fn
  this._handler = null
}

CombineOneWith.prototype = Object.create(Combine.prototype)

CombineOneWith.prototype._onActivation = function () {
  const handler = e => this._handleAny(e)
  this._handler = handler
  this._observable.onAny(handler)
}

CombineOneWith.prototype._handleAny = function (e) {
  switch (e.type) {
    case "value":
      this._maybeEmitValue(this._fn(e.value))
      break
    case "error":
      this._emitError(e.value)
      break
    default:
      this._handler = null
      this._emitEnd()
      break
  }
}

CombineOneWith.prototype._onDeactivation = function () {
  const {_handler, _observable} = this
  this._handler = null
  _observable.offAny(_handler)
}

//

export const asProperty = (...template) => {
  const n = count(template)
  switch (n) {
    case 0: return invoke(template)
    case 1: return (template.length === 2 &&
                    template[0] instanceof Kefir.Observable &&
                    template[1] instanceof Function
                    ? new CombineOneWith(template[0], template[1])
                    : new CombineOne(template))
    default: return new CombineMany(template, n)
  }
}
