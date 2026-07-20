# Joke Aggregator CLI

The same task — fetch a joke from a few free public APIs — implemented four ways: plain callbacks, raw Promises, `async`/`await`, and the [async](https://caolan.github.io/async/) library.

Built as a portfolio piece after finishing [*A Complete Guide To Avoiding Callback Hell*](https://www.udemy.com/course/writing-clean-asynchronous-code-in-nodejs/) on Udemy. The point is that the four `lib/fetch-*.js` files solve the same problem so the progression from "pyramid of doom" to clean modern code is visible side by side.

## Usage

```bash
npm install
node cli.js --style=callbacks      # serial, intentional callback hell
node cli.js --style=promises       # raw Promise + .then() chaining
node cli.js --style=promises --parallel
node cli.js --style=async-await    # the version you'd actually ship
node cli.js --style=async-await --parallel
node cli.js --style=async-js       # async.parallel + async.retry
```

## What each file shows

| File | Pattern | Why look at it |
| --- | --- | --- |
| `lib/fetch-callbacks.js` | Plain Node callbacks | The "before" — three nested `fetchOne` calls show the pyramid the course warns about. |
| `lib/fetch-promises.js` | `new Promise` + `.then` | Same task, flat. `Promise.all` for fan-out. |
| `lib/fetch-async-await.js` | `async`/`await` | The clean target. Sequential reads top-to-bottom; errors via `try/catch`. |
| `lib/fetch-async-js.js` | `async.parallel` + `async.retry` | Where the library still earns its keep — concurrency primitives and retry/backoff you'd otherwise hand-roll. |

All four import the same `lib/sources.js` so the *only* thing changing between files is the async style.

## Testing

```bash
npm test
```

Tests spin up a local `http` mock server, point the modules at it via `JOKE_API_BASE`, and assert each style returns valid jokes. There's also a flaky-server test that proves `async.retry` recovers after transient failures.

## Notes on real-world use

- For new code, reach for `async`/`await` first.
- `node:util`'s `promisify` would let you turn the callback-style fetch into a Promise without rewriting it — worth knowing, but not shown here as a fifth file because it'd duplicate the Promises chapter.
- The `async` library is still useful when you need bounded concurrency (`async.queue`, `async.parallelLimit`) or retry with backoff (`async.retry`) and don't want to hand-roll them.
