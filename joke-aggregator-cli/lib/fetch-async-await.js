// Death star v2
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

export async function fetchAllSerial() {
  const results = [];
  for (const source of getSources()) {
    results.push(await fetchOne(source));
  }
  return results;
}

export async function fetchAllParallel() {
  return Promise.all(getSources().map(fetchOne));
}

export async function fetchFirst() {
  return fetchOne(getSources()[0]);
}
