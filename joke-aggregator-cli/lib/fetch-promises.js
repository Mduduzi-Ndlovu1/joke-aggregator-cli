import http from 'node:http';
import https from 'node:https';
import { getSources } from './sources.js';

function fetchOne(source) {
  return new Promise((resolve, reject) => {
    const lib = source.url.startsWith('https:') ? https : http;
    const req = lib.get(source.url, { headers: source.headers }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`${source.name}: HTTP ${res.statusCode}`));
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve(source.parse(JSON.parse(body)));
        } catch (e) {
          reject(new Error(`${source.name}: ${e.message}`));
        }
      });
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}

// Serial fetch via .then() chaining — the "Promises tame nesting" .
export function fetchAllSerial() {
  const [s1, s2, s3] = getSources();
  const results = [];
  return fetchOne(s1)
    .then((j) => {
      results.push(j);
      return fetchOne(s2);
    })
    .then((j) => {
      results.push(j);
      return fetchOne(s3);
    })
    .then((j) => {
      results.push(j);
      return results;
    });
}

// Parallel fetch via Promise.all — the "fan out" pattern (Side ways head nod XD).
export function fetchAllParallel() {
  return Promise.all(getSources().map(fetchOne));
}

export function fetchFirst() {
  return fetchOne(getSources()[0]);
}
