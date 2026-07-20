// Intentional callback hell :fetch-async-await.js for the clean equivalent (Death Star).
import http from 'node:http';
import https from 'node:https';
import { getSources } from './sources.js';

function fetchOne(source, cb) {
  const lib = source.url.startsWith('https:') ? https : http;
  const req = lib.get(source.url, { headers: source.headers }, (res) => {
    if (res.statusCode !== 200) {
      res.resume();
      return cb(new Error(`${source.name}: HTTP ${res.statusCode}`));
    }
    let body = '';
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      body += chunk;
    });
    res.on('end', () => {
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch (e) {
        return cb(new Error(`${source.name}: invalid JSON`));
      }
      try {
        return cb(null, source.parse(parsed));
      } catch (e) {
        return cb(new Error(`${source.name}: missing joke field`));
      }
    });
    res.on('error', (err) => cb(err));
  });
  req.on('error', (err) => cb(err));
}

// Serial fetch from all 3 sources, nested to make the pyramid obvious.
export function fetchAllSerial(cb) {
  const [s1, s2, s3] = getSources();
  fetchOne(s1, (err, j1) => {
    if (err) return cb(err);
    fetchOne(s2, (err, j2) => {
      if (err) return cb(err);
      fetchOne(s3, (err, j3) => {
        if (err) return cb(err);
        return cb(null, [j1, j2, j3]);
      });
    });
  });
}

// Single-source fetch, used when the CLI just wants one joke.
export function fetchFirst(cb) {
  const [first] = getSources();
  fetchOne(first, cb);
}
