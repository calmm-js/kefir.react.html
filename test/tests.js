import * as Kefir from "kefir"
import * as R     from "ramda"

import {classes} from "../src/kefir.react.html"

function show(x) {
  switch (typeof x) {
    case "string":
    case "object":
      return JSON.stringify(x)
    default:
      return `${x}`
  }
}

function tryGet(s) {
  let result
  s.take(1).onValue(v => result = v)
  return result
}

const testEq = (expr, lambda, expected) => it(
  `${expr} equals ${show(expected)}`, () => {
    const actual = lambda()
    if (!R.equals(actual, expected))
      throw new Error(`Expected: ${show(expected)}, actual: ${show(actual)}`)
  })

describe("classes", () => {
  testEq('classes()', () => classes(), {className: ""})

  testEq('classes("a")', () => classes("a"), {className: "a"})

  testEq('classes("a", undefined, 0, false, "", "b")',
         () => classes("a", undefined, 0, false, "", "b"),
         {className: "a b"})

  testEq('R.map(tryGet, classes("a", Kefir.constant("b")))',
         () => R.map(tryGet, classes("a", Kefir.constant("b"))),
         {className: "a b"})
})
