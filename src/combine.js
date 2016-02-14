import Kefir   from "kefir"
import R       from "ramda"
import inherit from "./inherit"

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
      const next = []
      for (let i=0, n=template.length; i<n; ++i)
        next.push(combine(template[i], values, state))
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

const NO_VALUE = {}

//

function _maybeEmitValue(next) {
  const prev = this._currentEvent
  if (!prev || !R.equals(prev.value, next))
    this._emitValue(next)
}

const maybeEmitValue = Base =>
  Base === Kefir.Property
  ? _maybeEmitValue
  : Base.prototype._emitValue

//

function makeCombineMany(Base) {
  function CombineMany(template, n) {
    Base.call(this)
    this._template = template
    this._handlers = n
    this._values = null
  }

  inherit(CombineMany, Base, {
    _onActivation() {
      const template = this._template
      const n = this._handlers
      const handlers = Array(n)
      const values = Array(n)
      for (let i=0; i<n; ++i) {
        values[i] = NO_VALUE
        handlers[i] = NO_VALUE
      }
      this._handlers = handlers
      this._values = values
      subscribe(template, handlers, this)
    },
    _handleAny(i, e) {
      switch (e.type) {
        case "value": {
          const values = this._values
          values[i] = e.value
          if (!values.find(x => x === NO_VALUE))
            this._maybeEmitValue(invoke(combine(this._template, values, {index: -1})))
          break
        }
        case "error": {
          this._emitError(e.value)
          break
        }
        case "end": {
          const handlers = this._handlers
          handlers[i] = null
          if (!handlers.find(x => x)) {
            this._handlers = handlers.length
            this._values = null
            this._emitEnd()
          }
          break
        }
      }
    },
    _onDeactivation() {
      const handlers = this._handlers
      this._handlers = handlers.length
      this._values = null
      unsubscribe(this._template, handlers)
    },
    _maybeEmitValue: maybeEmitValue(Base)
  })
  return CombineMany
}

const CombineMany = makeCombineMany(Kefir.Property)
const CombineManys = makeCombineMany(Kefir.Stream)

//

function makeCombineOne(Base) {
  function CombineOne(template) {
    Base.call(this)
    this._template = template
    this._handler = null
  }

  inherit(CombineOne, Base, {
    _onActivation() {
      const handler = e => this._handleAny(e)
      this._handler = handler
      forEach(this._template, observable => observable.onAny(handler))
    },
    _handleAny(e) {
      switch (e.type) {
        case "value":
          this._maybeEmitValue(invoke(combine(this._template, [e.value], {index: -1})))
          break
        case "error":
          this._emitError(e.value)
          break
        case "end":
          this._handler = null
          this._emitEnd()
          break
      }
    },
    _onDeactivation() {
      const {_handler} = this
      this._handler = null
      forEach(this._template, observable => observable.offAny(_handler))
    },
    _maybeEmitValue: maybeEmitValue(Base)
  })
  return CombineOne
}

const CombineOne = makeCombineOne(Kefir.Property)
const CombineOnes = makeCombineOne(Kefir.Stream)

//

function makeCombineOneWith(Base) {
  function CombineOneWith(observable, fn) {
    Base.call(this)
    this._observable = observable
    this._fn = fn
  }
  inherit(CombineOneWith, Base, {
    _onActivation() {
      const handler = e => this._handleAny(e)
      this._handler = handler
      this._observable.onAny(handler)
    },
    _handleAny(e) {
      switch (e.type) {
        case "value":
          this._maybeEmitValue(this._fn(e.value))
          break
        case "error":
          this._emitError(e.value)
          break
        case "end":
          this._handler = null
          this._emitEnd()
          break
      }
    },
    _onDeactivation() {
      const {_handler, _observable} = this
      this._handler = null
      _observable.offAny(_handler)
    },
    _maybeEmitValue: maybeEmitValue(Base)
  })
  return CombineOneWith
}

const CombineOneWith = makeCombineOneWith(Kefir.Property)
const CombineOnesWith = makeCombineOneWith(Kefir.Stream)

//

const makeCombine = (Many, One, OneWith) => (...template) => {
  const n = count(template)
  switch (n) {
    case 0: return invoke(template)
    case 1: return (template.length === 2 &&
                    template[0] instanceof Kefir.Observable &&
                    template[1] instanceof Function
                    ? new OneWith(template[0], template[1])
                    : new One(template))
    default: return new Many(template, n)
  }
}

export const asStream = makeCombine(CombineManys, CombineOnes, CombineOnesWith)
export const asProperty = makeCombine(CombineMany, CombineOne, CombineOneWith)
