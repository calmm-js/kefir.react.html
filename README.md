[![npm version](https://badge.fury.io/js/kefir.react.html.svg)](http://badge.fury.io/js/kefir.react.html) [![Build Status](https://travis-ci.org/calmm-js/kefir.react.html.svg?branch=master)](https://travis-ci.org/calmm-js/kefir.react.html) [![](https://david-dm.org/calmm-js/kefir.react.html.svg)](https://david-dm.org/calmm-js/kefir.react.html) [![](https://david-dm.org/calmm-js/kefir.react.html/dev-status.svg)](https://david-dm.org/calmm-js/kefir.react.html#info=devDependencies) [![Gitter](https://img.shields.io/gitter/room/calmm-js/chat.js.svg?style=flat-square)](https://gitter.im/calmm-js/chat)

This library allows you to embed [Kefir](http://rpominov.github.io/kefir/)
observables into [React](https://facebook.github.io/react/) Virtual DOM.

## Usage

The prelifted classes can be accessed from the default import:

```jsx
import K from "kefir.react.html"
```

The names of the prelifted classes are the same as in `React.DOM`.

### Lifted classes

A lifted class eliminates Kefir
[observables](http://rpominov.github.io/kefir/#about-observables) that appear as
attributes or direct children of the produced element.  For example, using the
lifted class `K.div`, you could write

```jsx
<K.div>Hello, {observable}!</K.div>
```

where `observable` refers to a Kefir observable.  The resulting `div` always
shows the latest value produced by the observable.

### Mount attribute

The `mount` attribute on a lifted element

```jsx
<K.input mount={c => c && c.focus()}/>
```

does the same thing as the ordinary JSX
[`ref` attribute](https://facebook.github.io/react/docs/more-about-refs.html#the-ref-callback-attribute):
JSX/React treats it as a special case, so it had to be renamed.

### Bind attribute template

The `bind` attribute template

```jsx
import {bind} from "kefir.react.html"
```

can be used to bind an attribute, e.g. `value` or `checked`, to an object with a
`set` method such as a [Kefir.Atom](https://github.com/calmm-js/kefir.atom):

```jsx
const settable = Atom("")
...
<K.input type="text"
         mount={c => c && c.focus()}
         {...bind({value: settable})}/>
```

`bind` is just an ordinary function that extends the given object, above
`{value: settable}`, with an `onChange` attribute containing a function that
copies the attribute, above `value`, from the event target to the attribute
object, above `settable`.

### Classes attribute template

The `classes` attribute template

```jsx
import {classes} from "kefir.react.html"
```

offers a way to specify `className` with conditional content depending on
observables.  For example:

```jsx
...
<K.div {...classes("unconditional",
                   condition && "conditional",
                   condition ? "true" : "false",
                   observable.map(c => c && "conditional-and-observable"))}>
    Not too classy?</K.div>
```

`classes(...)` extends to an object of the form `{className: string |
observable}`.

### Nesting

A single lifted class, like `K.input`, eliminates Kefir observables only when
they are immediately contained attributes or children of the element.  So, you
can safely nest lifted elements:

```jsx
const checked = Atom(false)
...
<K.div>
  <K.label htmlFor="likes-kefir">Kefir is tasty:</K.label>
  <K.input type="checkbox"
           id="likes-kefir"
           {...bind({checked})}/>
  <K.div hidden={checked}><K.em>Are you sure?</K.em></K.div>
</K.div>
```

Note, however, that *only* those elements that immediately contain observables
must be lifted, because React will choke on plain Kefir.  So, the above could
also have been written as:

```jsx
const checked = Atom(false)
...
<div>
  <label htmlFor="likes-kefir">Kefir is tasty:</label>
  <K.input type="checkbox"
           id="likes-kefir"
           {...bind({checked})}/>
  <K.div hidden={checked}><em>Are you sure?</em></K.div>
</div>
```

For best performance this latter version is preferable.

### Lifting and Patching

If you need a lifted version of a HTML class that is not already lifted, you can
use `fromClass`:

```jsx
import K, {fromClass} from "kefir.react.html"
...
K.special = fromClass("special")
```

There is also `fromClasses` that lifts an object of classes to an object of
lifted classes.  For example, given

```jsx
import {fromClasses} from "kefir.react.html"
...
const L = fromClasses({Some, Custom, Classes})
```

then `L.Some`, `L.Custom` and `L.Classes` are lifted versions of `Some`,
`Custom` and `Classes`.

### From Kefir

`fromClass` and the prelifted classes handle the cases where the class of the
element is statically known or the element is a child of some element.  In case
the class of a top-most element depends on a Kefir observable, one can use
`fromKefir`:

```jsx
import {fromKefir} from "kefir.react.html"
...
const choice = Atom(false)
...
fromKefir(choice.map(c => c ? <True/> : <False/>))
```

### Combining properties

For notational convenience, the default import

```jsx
import K from "kefir.react.html"
```

is also a generalized observable combiner designed for combining properties to
be embedded into VDOM.

**NOTE:** `K` is *not* designed to be used as general purpose observable
combinator.  It is designed for the particular use case of combining properties
to be embedded into VDOM.

The basic semantics of `K` can be described as

```js
K(x1, ..., xN, fn) === combine([x1, ..., xN], fn).skipDuplicates(equals)
```

where [`combine`](http://rpominov.github.io/kefir/#combine) and
[`skipDuplicates`](http://rpominov.github.io/kefir/#skip-duplicates) come from
Kefir and [`equals`](http://ramdajs.com/0.19.0/docs/#equals) from Ramda.  We
skip duplicates, because that avoids some unnecessary updates.  Ramda's `equals`
provides a semantics of equality that works, for immutable data, just the way we
like.

Unlike with [`combine`](http://rpominov.github.io/kefir/#combine), any argument
of `K` is allowed to be
* a constant,
* an observable (including the combiner function), or
* an array or object containing observables.
In other words, `K` also provides functionality similar to
[`combineTemplate`](https://github.com/baconjs/bacon.js#bacon-combinetemplate).

When `K` is invoked with only constants (no observables), then the result is
computed immediately and returned as a plain value.  This optimization
eliminates redundant observables.

### Incremental arrays `fromIds`

For efficient construction of arrays of elements, the `fromIds`

```jsx
import {fromIds} from "kefir.react.html"
```

combinator is provided.  It can be seen to have the following type:

```haskell
fromIds :: (Show id) => Observable [id] -> (id -> a) -> Property [a]
```

`fromIds(idsObs, fromId)` assumes that the given `fromId` function is pure.  It
then stores and reuses the return values of `fromId` between changes of the
`idsObs` observable.  Assuming `idsObs` does not produce changes unnecessarily,
`fromIds` allows large arrays of elements to be updated incrementally.

## Longer examples

* [TodoMVC](https://github.com/calmm-js/kral-todomvc)
* [Examples](https://github.com/calmm-js/kral-examples)
