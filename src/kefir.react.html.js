import * as R       from "ramda"
import React        from "react"
import {Observable} from "kefir"

import * as Combine from "./combine"

//

export const config = {
  onError: e => {throw e}
}

//

const common = {
  componentWillReceiveProps(nextProps) {
    this.doUnsubscribe()
    this.doSubscribe(nextProps)
  },
  componentWillMount() {
    this.doUnsubscribe()
    this.doSubscribe(this.props)
  },
  shouldComponentUpdate(np, ns) {
    return ns.rendered !== this.state.rendered
  },
  componentWillUnmount() {
    this.doUnsubscribe()
    this.setState(this.getInitialState())
  },
  render() {
    return this.state.rendered
  }
}

//

const FromKefirEnd = {callback: null}
const FromKefirNull = {callback: null, rendered: null}

const FromKefir = React.createClass({
  ...common,
  getInitialState() {
    return FromKefirNull
  },
  doUnsubscribe() {
    const {callback} = this.state
    if (callback)
      this.props.observable.offAny(callback)
  },
  doSubscribe({observable}) {
    if (observable instanceof Observable) {
      const callback = e => {
        switch (e.type) {
          case "value":
            this.setState({rendered: e.value})
            break
          case "error":
            config.onError(e.value)
            break
          case "end":
            this.setState(FromKefirEnd)
            break
        }
      }
      observable.onAny(callback)
      this.setState({callback})
    } else {
      this.setState({rendered: observable})
    }
  }
})

export const fromKefir = observable =>
  React.createElement(FromKefir, {observable})

//

function forEach(props, fn) {
  for (const key in props) {
    const val = props[key]
    if (val instanceof Observable) {
      fn(val)
    } else if ("children" === key &&
               val instanceof Array) {
      for (let i=0, n=val.length; i<n; ++i) {
        const valI = val[i]
        if (valI instanceof Observable)
          fn(valI)
      }
    } else if ("style" === key) {
      for (const k in val) {
        const valK = val[k]
        if (valK instanceof Observable)
          fn(valK)
      }
    }
  }
}

function render(Class, props, values) {
  const newProps = {}
  let newChildren

  let k = -1

  for (const key in props) {
    const val = props[key]
    if (val instanceof Observable) {
      const valO = values[++k]
      if ("children" === key)
        newChildren = valO
      else if ("mount" === key)
        newProps.ref = valO
      else
        newProps[key] = valO
    } else if ("children" === key) {
      if (val instanceof Array) {
        for (let i=0, n=val.length; i<n; ++i) {
          const valI = val[i]
          if (valI instanceof Observable) {
            if (!newChildren) {
              newChildren = Array(val.length)
              for (let j=0; j<i; ++j)
                newChildren[j] = val[j]
            }
            newChildren[i] = values[++k]
          } else if (newChildren) {
            newChildren[i] = val[i]
          }
        }
      }
      if (!newChildren)
        newChildren = val
    } else if ("mount" === key) {
      newProps.ref = val
    } else if ("style" === key) {
      let newStyle
      for (const i in val) {
        const valI = val[i]
        if (valI instanceof Observable) {
          if (!newStyle) {
            newStyle = {}
            for (const j in val) {
              if (j === i)
                break
              newStyle[j] = val[j]
            }
          }
          newStyle[i] = values[++k]
        } else if (newStyle) {
          newStyle[i] = valI
        }
      }
      newProps.style = newStyle || val
    } else {
      newProps[key] = val
    }
  }

  return React.createElement(Class, newProps, newChildren || null)
}

//

function FakeComponent(state, props) {
  this.props = props
  this.state = state
}

FakeComponent.prototype.setState = function (newState) {
  if ("renderer" in newState)
    this.state.renderer = newState.renderer
  if ("rendered" in newState)
    this.state.rendered = newState.rendered
}

//

function Renderer1(component, newProps) {
  const state = {renderer: this, rendered: component.rendered}
  this.component = new FakeComponent(state, newProps)
  this.handler = e => this.doHandle(e)
  forEach(newProps.props, observable => observable.onAny(this.handler))
  this.component = component
  component.setState(state)
}

Renderer1.prototype.unsubscribe = function () {
  const handler = this.handler
  if (handler)
    forEach(this.component.props.props, observable => observable.offAny(handler))
}

Renderer1.prototype.doHandle = function (e) {
  switch (e.type) {
    case "value": {
      const component = this.component
      const {Class, props} = component.props
      const rendered = render(Class, props, [e.value])
      if (!R.equals(component.state.rendered, rendered))
        component.setState({rendered})
      return
    }
    case "error":
      config.onError(e.value)
      return
    default:
      this.handler = null
      this.component.setState(FromClassEnd)
      return
  }
}

//

function RendererN(component, newProps, n) {
  const state = {renderer: this, rendered: component.rendered}
  this.component = new FakeComponent(state, newProps)
  this.handlers = []
  this.values = Array(n)

  for (let i=0; i<n; ++i)
    this.values[i] = this

  forEach(newProps.props, observable => {
    const i = this.handlers.length
    const handler = e => this.doHandle(i, e)
    this.handlers.push(handler)
    observable.onAny(handler)
  })

  this.component = component
  component.setState(state)
}

RendererN.prototype.unsubscribe = function () {
  let i = -1
  forEach(this.component.props.props, observable => {
    const handler = this.handlers[++i]
    if (handler)
      observable.offAny(handler)
  })
}

RendererN.prototype.doHandle = function (idx, e) {
  switch (e.type) {
    case "value": {
      this.values[idx] = e.value

      for (let i=this.values.length-1; 0 <= i; --i)
        if (this.values[i] === this)
          return

      const component = this.component
      const {Class, props} = component.props
      const rendered = render(Class, props, this.values)
      if (!R.equals(component.state.rendered, rendered))
        component.setState({rendered})
      return
    }
    case "error":
      config.onError(e.value)
      return
    default: {
      this.handlers[idx] = null

      const n = this.handlers.length

      if (n !== this.values.length)
        return

      for (let i=0; i < n; ++i)
        if (this.handlers[i])
          return

      this.component.setState(FromClassEnd)
      return
    }
  }
}

//

const FromClassEnd = {renderer: null}
const FromClassNull = {renderer: null, rendered: null}

const FromClass = React.createClass({
  ...common,
  getInitialState() {
    return FromClassNull
  },
  doUnsubscribe() {
    const {renderer} = this.state
    if (renderer)
      renderer.unsubscribe()
  },
  doSubscribe(newProps) {
    const {props} = newProps

    let n = 0
    forEach(props, () => n += 1)

    switch (n) {
      case 0:
        this.setState({renderer: null,
                       rendered: render(newProps.Class, props, null)})
        break
      case 1:
        new Renderer1(this, newProps)
        break
      default:
        new RendererN(this, newProps, n)
        break
    }
  }
})

export const fromClass =
  Class => props => React.createElement(FromClass, {Class, props})

export const fromClasses = classes => {
  const result = {}
  for (const k in classes)
    result[k] = fromClass(classes[k])
  return result
}

//

const K = Combine.asProperty

"a abbr address area article aside audio b base bdi bdo big blockquote body br button canvas caption circle cite clipPath code col colgroup data datalist dd defs del details dfn dialog div dl dt ellipse em embed fieldset figcaption figure footer form g h1 h2 h3 h4 h5 h6 head header hgroup hr html i iframe image img input ins kbd keygen label legend li line linearGradient link main map mark mask menu menuitem meta meter nav noscript object ol optgroup option output p param path pattern picture polygon polyline pre progress q radialGradient rect rp rt ruby s samp script section select small source span stop strong style sub summary sup svg table tbody td text textarea tfoot th thead time title tr track tspan u ul var video wbr".split(" ").forEach(c => K[c] = fromClass(c))

// Helpers

function classesImmediate() {
  let result = ""
  for (let i=0, n=arguments.length; i<n; ++i) {
    const a = arguments[i]
    if (a) {
      if (result)
        result += " "
      result += a
    }
  }
  return result
}

export const classes = (...cs) =>
  ({className: K(...cs, classesImmediate)})

//

export const setProps = template => {
  let observable = null
  let callback = null
  return e => {
    if (callback) {
      observable.offAny(callback)
      observable = null
      callback = null
    }
    if (e) {
      callback = ev => {
        switch (ev.type) {
          case "value": {
            const template = ev.value
            for (const k in template)
              e[k] = template[k]
            break
          }
          case "error":
            config.onError(ev.value)
            break
          case "end":
            observable = null
            callback = null
            break
        }
      }
      observable = K(template, R.identity)
      observable.onAny(callback)
    }
  }
}

export const getProps = template => ({target}) => {
  for (const k in template)
    template[k].set(target[k])
}

export const bindProps = ({ref, mount, ...template}) =>
  ({[ref && "ref" || mount && "mount"]: setProps(template),
    [ref || mount]: getProps(template)})

export const bind = template =>
  ({...template, onChange: getProps(template)})

//

export const fromIds = (ids, fromId) => ids.scan(([oldIds], ids) => {
  const newIds = {}
  const newVs = Array(ids.length)
  for (let i=0, n=ids.length; i<n; ++i) {
    const id = ids[i]
    const k = id.toString()
    if (k in newIds)
      newVs[i] = newIds[k]
    else
      newIds[k] = newVs[i] = k in oldIds ? oldIds[k] : fromId(id)
  }
  return [newIds, newVs]
}, [{}, []]).map(s => s[1])

//

export default K
