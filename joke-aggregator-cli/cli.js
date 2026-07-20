import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    style: { type: 'string', default: 'async-await' },
    parallel: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (values.help) {
  console.log(`Usage: node cli.js [--style=<style>] [--parallel]

Styles:
  callbacks     Plain Node callbacks (intentional callback hell)
  promises      Raw Promise + .then() chaining
  async-await   async/await (default, the version you'd ship)
  async-js      async.js library (parallel + retry)

Flags:
  --parallel    Fetch from all sources at once instead of one
  -h, --help    Show this help`);
  process.exit(0);
}

function printResult(label, result) {
  console.log(`\n[${label}]`);
  if (Array.isArray(result)) {
    result.forEach((joke, i) => console.log(`  ${i + 1}. ${joke}`));
  } else if (result && typeof result === 'object') {
    for (const [name, joke] of Object.entries(result)) {
      console.log(`  ${name}: ${joke}`);
    }
  } else {
    console.log(`  ${result}`);
  }
}

const fail = (err) => {
  console.error(`\nError: ${err.message}`);
  process.exit(1);
};

switch (values.style) {
  case 'callbacks': {
    const mod = await import('./lib/fetch-callbacks.js');
    if (values.parallel) {
      console.warn('(callbacks demo runs serially to keep the pyramid visible)');
    }
    mod.fetchAllSerial((err, jokes) => {
      if (err) return fail(err);
      printResult('callbacks (serial)', jokes);
    });
    break;
  }
  case 'promises': {
    const mod = await import('./lib/fetch-promises.js');
    const p = values.parallel ? mod.fetchAllParallel() : mod.fetchAllSerial();
    p.then((jokes) => printResult(`promises (${values.parallel ? 'parallel' : 'serial'})`, jokes)).catch(fail);
    break;
  }
  case 'async-await': {
    const mod = await import('./lib/fetch-async-await.js');
    try {
      const jokes = values.parallel ? await mod.fetchAllParallel() : await mod.fetchAllSerial();
      printResult(`async-await (${values.parallel ? 'parallel' : 'serial'})`, jokes);
    } catch (err) {
      fail(err);
    }
    break;
  }
  case 'async-js': {
    const mod = await import('./lib/fetch-async-js.js');
    mod.fetchAllParallel((err, jokes) => {
      if (err) return fail(err);
      printResult('async-js (parallel + retry)', jokes);
    });
    break;
  }
  default:
    console.error(`Unknown style: ${values.style}. Try --help.`);
    process.exit(2);
}
