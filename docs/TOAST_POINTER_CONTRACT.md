# Toast pointer ownership

The four `IrisToastViewport` adapters use the same DOM-free core gesture controller.
Adapters inspect the target, capture a pointer, and render the current offset; they
must not invent their own dismissal or cancellation policy.

- Interactive descendants (buttons, links, inputs, selects, textareas, summaries,
  button/link roles, and editable content) keep their native pointer sequence.
- Ordinary content starts a swipe only for a primary, button-0 pointer with finite
  coordinates and identity. A second pointer cannot replace or release its owner.
- Only that item identity and pointer may update the offset. Dismissal retains the
  existing strict `abs(dx) > 80` threshold; 80px itself does not dismiss.
- `pointercancel` and lost capture clear the owned gesture without dismissal.
- Removal or replacement under the same id does not transfer a gesture to the new
  item. Unmount resets the controller. This contract concerns gestures, not rollback
  of application writes or acceptance of a server operation.

## Layout and compatibility

The viewport and surface own their border-box sizing, rather than depending on a
host application's global CSS reset. The existing 280px surface floor shrinks when
necessary. Viewport padding is now included in its existing 100%/420px width budget;
this deliberately fixes narrow-screen overflow. Positions, safe-area padding,
portal APIs, duration semantics, and the swipe threshold are unchanged.

Caller viewport styles remain last-wins. Svelte accepts its native CSS style string
and serializes the shared camel-case layout through the common hyphenation bridge.
The core continues to have no DOM or framework dependency.

## Regression gate

```sh
pnpm build
pnpm exec playwright install chromium
pnpm check:toast-pointer
```

Missing browser dependencies fail, not skip. The gate uses built package entries,
real framework providers, and browser-native mouse/CDP touch input. It covers all
four adapters, 320/1280px viewports, 14/28px font tokens, and LTR/RTL: native dismiss
and action clicks, both swipe directions, small swipes, lost capture, same-id
replacement, touch cancellation, and multi-pointer ownership. It also checks that
toasts fit without a host reset, rejects unexpected external requests, and fails on
page errors. The 240-second budget includes fixture startup and the browser run.

These are candidate-package browser checks, not npm registry installation,
physical touchscreen, full-control, authenticated application, desktop-shell,
or production acceptance. Release still requires every other declared gate and
maintainer authorization; this command does not publish.
