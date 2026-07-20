import http from 'node:http';
import https from 'node:https';
import async from 'async';
import { getSources } from './sources.js';

// Same callback-style fetcher async.js expects (err, result).
function fetchOne(source, cb) {
  const lib = source.url.startsWith('https:') ? https : http;
  const req = lib.get(source.url, { headers: source.headers }, (res) => {
    if (res.statusCode !== 200) {
      res.resume();
      return cb(new Error(`${source.name}: HTTP ${res.statusCode}`));
    }
    let body = '';
    res.setEncoding('utf8');
    res.on('data', (chunk) => (body += chunk));
    res.on('end', () => {
      try {
        cb(null, source.parse(JSON.parse(body)));
      } catch (e) {
        cb(new Error(`${source.name}: ${e.message}`));
      }
    });
    res.on('error', cb);
  });
  req.on('error', cb);
}

// Parallel fan-out with retry on each source — async.js earning its keep.
export function fetchAllParallel(cb) {
  const tasks = {};
  for (const source of getSources()) {
    tasks[source.name] = (done) =>
      async.retry({ times: 3, interval: 200 }, (retryCb) => fetchOne(source, retryCb), done);
  }
  async.parallel(tasks, cb);
}

export function fetchFirst(cb) {
  const [first] = getSources();
  async.retry({ times: 3, interval: 200 }, (retryCb) => fetchOne(first, retryCb), cb);
}
