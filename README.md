[![npm version](https://badge.fury.io/js/kefir-react-html.svg)](http://badge.fury.io/js/kefir-react-html) ![](https://david-dm.org/dirty-js/kefir-react-html.svg)

This library allows you to embed [Kefir](http://rpominov.github.io/kefir/)
observables into React Virtual DOM.

## Usage

The prelifted classes can be accessed from the default import:

```jsx
import K from "kefir-react-html"
```

The names of the prelifted classes are the same as in `React.DOM`.

### Lifted classes

A lifted class eliminates Kefir observables that appear as attributes or direct
children of the produced element.  For example, using the lifted class `K.div`,
you could write

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

does the same thing as the ordinary JSX `ref` attribute: JSX/React treats it as
a special case, so it had to be renamed.

### Bind attribute template

The `bind` attribute template

```jsx
import {bind} from "kefir-react-html"
```

can be used to bind an attribute, e.g. `value` or `checked`, to an object with a
`set` method such as a [Kefir-Atom](https://github.com/dirty-js/kefir-atom):

```jsx
const settable = Atom("")
...
<K.input type="text"
         mount={c => c && c.focus()}
         {...bind({value: settable})}/>
```

`bind` extends the given object, above `{value: settable}`, with an `onChange`
attribute containing a function that copies the attribute, above `value`, from
the event target to the attribute object, above `settable`.

### Classes attribute template

The `classes` attribute template

```jsx
import {classes} from "kefir-react-html"
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
import K, {fromClass} from "kefir-react-html"
...
K.special = fromClass("special")
```

There is also `fromClasses` that lifts an object of classes to an object of
lifted classes.  For example, given

```jsx
import {fromClasses} from "kefir-react-html"
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
import {fromKefir} from "kefir-react-html"
...
const choice = Atom(false)
...
fromKefir(choice.map(c => c ? <True/> : <False/>))
```

### Combining properties

For notational convenience, the default import

```jsx
import K from "kefir-react-html"
```

is also a generalized observable combiner.  It is roughly a combination of a
[combine template](https://github.com/baconjs/bacon.js#bacon-combinetemplate)
function with arbitrary number of templates and an optional combining function:

```js
K(t, ...ts[, fn])
```

If none of the arguments contains Kefir observables, the result of a `K(...)`
invocation is a plain value.  Otherwise the result is a Kefir property that also
skips duplicates.

## Longer examples

* [TodoMVC](https://github.com/dirty-js/kefir-react-atom-todomvc)
