const baseSources = [
  {
    name: 'icanhazdadjoke',
    url: 'https://icanhazdadjoke.com/',
    headers: { Accept: 'application/json', 'User-Agent': 'joke-aggregator-cli (https://github.com/)' },
    parse: (json) => json.joke,
  },
  {
    name: 'official-joke-api',
    url: 'https://official-joke-api.appspot.com/random_joke',
    headers: {},
    parse: (json) => `${json.setup} — ${json.punchline}`,
  },
  {
    name: 'jokeapi',
    url: 'https://v2.jokeapi.dev/joke/Any?type=single',
    headers: {},
    parse: (json) => json.joke,
  },
];

export function getSources() {
  const override = process.env.JOKE_API_BASE;
  if (!override) return baseSources;
  return baseSources.map((s) => ({ ...s, url: `${override}/${s.name}` }));
}
