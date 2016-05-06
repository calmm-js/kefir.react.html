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
      if (val instanceof Observable) {
        obsStreams.push(val)
      } else if ("children" === key &&
                 val instanceof Array) {
        for (let i=0, n=val.length; i<n; ++i) {
          const valI = val[i]
          if (valI instanceof Observable)
            obsStreams.push(valI)
        }
      } else if ("style" === key) {
        for (const k in val) {
          const valK = val[k]
          if (valK instanceof Observable)
            obsStreams.push(valK)
        }
      }
    }

    const observable = Combine.asStream(...obsStreams, function() {
      const newProps = {}
      let newChildren

      let k = -1

      for (const key in props) {
        const val = props[key]
        if (val instanceof Observable) {
          const valO = arguments[++k]
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
                newChildren[i] = arguments[++k]
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
              newStyle[i] = arguments[++k]
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
    })

    if (observable instanceof Observable) {
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
      observable = Combine.asStream(template, R.identity)
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
