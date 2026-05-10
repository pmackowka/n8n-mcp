import { workflow, node, trigger } from '@n8n/workflow-sdk';

const scheduleTrigger = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Co poniedzialek 09:30',
    rule: {
      interval: [{
        field: 'weeks',
        weeksInterval: 1,
        triggerAtDay: [1],
        triggerAtHour: 9,
        triggerAtMinute: 30
      }]
    },
    position: [240, 300]
  },
  output: [{}]
});

const fetchTopStories = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Pobierz top stories HN',
    method: 'GET',
    url: 'https://hacker-news.firebaseio.com/v0/topstories.json',
    authentication: 'none',
    options: {},
    position: [520, 300]
  },
  output: [{}]
});

const filterAndFetchDetails = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Filtruj i pobierz szczegoly',
    language: 'javascript',
    executeOnce: true,
    code: `
const keywords = ['opencode', 'cloud code', 'openrouter', 'openai codex', 'antigravity', 'warpdotdev', 'gemini cli', 'stape_io', 'n8n'];

const inputData = $input.first().json;
const storyIds = Array.isArray(inputData) ? inputData : (inputData.data || []);

const topIds = storyIds.slice(0, 50);

const stories = [];
for (const id of topIds) {
  try {
    const response = await $http.get('https://hacker-news.firebaseio.com/v0/item/' + id + '.json');
    if (response && response.title) {
      stories.push(response);
    }
  } catch (e) {}
}

const filtered = stories.filter(s => {
  const title = (s.title || '').toLowerCase();
  return keywords.some(k => title.includes(k.toLowerCase()));
});

const top5 = filtered.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 5);

return top5.map(s => ({
  json: {
    title: s.title,
    url: s.url || 'https://news.ycombinator.com/item?id=' + s.id,
    score: s.score || 0,
    author: s.by || 'unknown',
    comments: s.descendants || 0
  }
}));
`
  },
  output: [{ title: '', url: '', score: 0, author: '', comments: 0 }]
});

const translateToPolish = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Tlumacz na polski',
    language: 'javascript',
    executeOnce: true,
    code: `
return $input.all().map(item => ({
  json: {
    tytul: item.json.title,
    tytul_pl: item.json.title,
    url: item.json.url,
    punkty: item.json.score,
    autor: item.json.author,
    komentarze: item.json.comments,
    data: new Date().toISOString().split('T')[0]
  }
}));
`
  },
  output: [{ tytul: '', tytul_pl: '', url: '', punkty: 0, autor: '', komentarze: 0, data: '' }]
});

export default workflow('hn-top5-monday', 'HN Top 5 - poniedzialek 09:30')
  .add(scheduleTrigger)
  .to(fetchTopStories)
  .to(filterAndFetchDetails)
  .to(translateToPolish);
