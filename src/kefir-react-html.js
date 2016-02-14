import Kefir from "kefir"
import R     from "ramda"
import React from "react"

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
  }
})

export const fromKefir = observable =>
  React.createElement(FromKefir, {observable})

//

const FromClassEnd = {observable: null, callback: null}
const FromClassNull = {observable: null, callback: null, rendered: null}

const FromClass = React.createClass({
  ...common,
  getInitialState() {
    return FromClassNull
  },
  doUnsubscribe() {
    const {observable, callback} = this.state
    if (callback)
      observable.offAny(callback)
  },
  doSubscribe({Class, props}) {
    const obsStreams = []

    for (const key in props) {
      const val = props[key]
      if (val instanceof Kefir.Observable) {
        obsStreams.push(val)
      } else if ("children" === key &&
                 val instanceof Array) {
        for (let i=0, n=val.length; i<n; ++i) {
          const valI = val[i]
          if (valI instanceof Kefir.Observable)
            obsStreams.push(valI)
        }
      }
    }

    const observable = Combine.asStream(...obsStreams, function() {
      const newProps = {}
      let newChildren = null

      let k = -1

      for (const key in props) {
        const val = props[key]
        if (val instanceof Kefir.Observable) {
          const valO = arguments[++k]
          if ("children" === key)
            newChildren = valO
          else if ("mount" === key)
            newProps["ref"] = valO
          else
            newProps[key] = valO
        } else if ("children" === key && val instanceof Array) {
          newChildren = []
          for (let i=0, n=val.length; i<n; ++i) {
            const valI = val[i]
            newChildren.push(valI instanceof Kefir.Observable
                             ? arguments[++k]
                             : valI)
          }
        } else {
          if ("children" === key)
            newChildren = val
          else if ("mount" === key)
            newProps["ref"] = val
          else
            newProps[key] = val
        }
      }

      return React.createElement(Class, newProps, newChildren)
    })

    if (observable instanceof Kefir.Observable) {
      const callback = e => {
        switch (e.type) {
          case "value": {
            const {value} = e
            if (!R.equals(this.state.rendered, value))
              this.setState({rendered: value})
            break
          }
          case "error":
            config.onError(e.value)
            break
          case "end":
            this.setState(FromClassEnd)
            break
        }
      }
      observable.onAny(callback)
      this.setState({observable, callback})
    } else {
      this.setState({observable: null, callback: null, rendered: observable})
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

;["a", "abbr", "address", "area", "article", "aside", "audio",
  "b", "base", "bdi", "bdo", "big", "blockquote", "body", "br", "button",
  "canvas", "caption", "circle", "cite", "clipPath", "code", "col", "colgroup",
  "data", "datalist", "dd", "defs", "del", "details", "dfn", "dialog", "div", "dl", "dt",
  "ellipse", "em", "embed",
  "fieldset", "figcaption", "figure", "footer", "form",
  "g",
  "h1", "h2", "h3", "h4", "h5", "h6", "head", "header", "hgroup", "hr", "html",
  "i", "iframe", "image", "img", "input", "ins",
  "kbd", "keygen",
  "label", "legend",
  "li", "line", "linearGradient", "link",
  "main", "map", "mark", "mask", "menu", "menuitem", "meta", "meter",
  "nav", "noscript",
  "object", "ol", "optgroup", "option", "output",
  "p", "param", "path", "pattern", "picture", "polygon", "polyline", "pre", "progress",
  "q",
  "radialGradient", "rect", "rp", "rt", "ruby",
  "s", "samp", "script", "section", "select", "small", "source", "span", "stop", "strong", "style", "sub", "summary", "sup", "svg",
  "table", "tbody", "td", "text", "textarea", "tfoot", "th", "thead", "time", "title", "tr", "track", "tspan",
  "u", "ul",
  "var", "video",
  "wbr"].forEach(c => K[c] = fromClass(c))

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
  ({className: Combine.asProperty(...cs, classesImmediate)})

export const bind = template => ({...template, onChange: ({target}) => {
  for (const k in template)
    template[k].set(target[k])
}})

//

export const fromIds = (ids, fromId) => ids.scan(([oldIds], ids) => {
  const newIds = {}
  const newVs = []
  ids.forEach(id => {
    const newV = id in oldIds ? oldIds[id] : fromId(id)
    newIds[id] = newV
    newVs.push(newV)
  })
  return [newIds, newVs]
}, [{}, []]).map(s => s[1])

//

export default K
