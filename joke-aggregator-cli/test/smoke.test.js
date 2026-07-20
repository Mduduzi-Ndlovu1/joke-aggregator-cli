import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

let server;
let baseUrl;

before(async () => {
  server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/icanhazdadjoke') {
      res.end(JSON.stringify({ joke: 'callback joke' }));
    } else if (req.url === '/official-joke-api') {
      res.end(JSON.stringify({ setup: 'why did the dev', punchline: 'cross the road' }));
    } else if (req.url === '/jokeapi') {
      res.end(JSON.stringify({ joke: 'parallel joke' }));
    } else {
      res.statusCode = 404;
      res.end('{}');
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
  process.env.JOKE_API_BASE = baseUrl;
});

after(() => {
  server.close();
});

test('callbacks: fetchAllSerial returns 3 jokes', (t, done) => {
  import('../lib/fetch-callbacks.js').then(({ fetchAllSerial }) => {
    fetchAllSerial((err, jokes) => {
      assert.equal(err, null);
      assert.equal(jokes.length, 3);
      assert.ok(jokes.every((j) => typeof j === 'string' && j.length > 0));
      done();
    });
  });
});

test('promises: fetchAllParallel returns 3 jokes', async () => {
  const { fetchAllParallel } = await import('../lib/fetch-promises.js');
  const jokes = await fetchAllParallel();
  assert.equal(jokes.length, 3);
  assert.ok(jokes.every((j) => typeof j === 'string' && j.length > 0));
});

test('promises: fetchAllSerial returns 3 jokes in order', async () => {
  const { fetchAllSerial } = await import('../lib/fetch-promises.js');
  const jokes = await fetchAllSerial();
  assert.equal(jokes.length, 3);
  assert.equal(jokes[0], 'callback joke');
  assert.equal(jokes[2], 'parallel joke');
});

test('async-await: fetchAllParallel returns 3 jokes', async () => {
  const { fetchAllParallel } = await import('../lib/fetch-async-await.js');
  const jokes = await fetchAllParallel();
  assert.equal(jokes.length, 3);
  assert.ok(jokes.every((j) => typeof j === 'string' && j.length > 0));
});

test('async-js: fetchAllParallel returns named result map', (t, done) => {
  import('../lib/fetch-async-js.js').then(({ fetchAllParallel }) => {
    fetchAllParallel((err, results) => {
      assert.equal(err, null);
      assert.equal(typeof results, 'object');
      assert.ok(results.icanhazdadjoke);
      assert.ok(results['official-joke-api']);
      assert.ok(results.jokeapi);
      done();
    });
  });
});

test('async-js: retries on transient failure', (t, done) => {
  // Spin up a flaky mock that fails twice then succeeds.
  let attempts = 0;
  const flaky = http.createServer((req, res) => {
    attempts++;
    if (attempts < 3) {
      res.statusCode = 500;
      return res.end('{}');
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ joke: 'eventually' }));
  });
  flaky.listen(0, '127.0.0.1', async () => {
    const port = flaky.address().port;
    const prev = process.env.JOKE_API_BASE;
    // Point only the first source at the flaky server by reusing the path naming convention.
    process.env.JOKE_API_BASE = `http://127.0.0.1:${port}`;
    const { fetchFirst } = await import('../lib/fetch-async-js.js');
    fetchFirst((err, joke) => {
      process.env.JOKE_API_BASE = prev;
      flaky.close();
      assert.equal(err, null);
      assert.equal(joke, 'eventually');
      assert.ok(attempts >= 3);
      done();
    });
  });
});
