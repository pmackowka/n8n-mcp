import { workflow, node, trigger, expr } from '@n8n/workflow-sdk';

const scheduleTrigger = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Co poniedzialek 09:30',
    parameters: {
      rule: {
        interval: [{
          field: 'weeks',
          weeksInterval: 1,
          triggerAtDay: [1],
          triggerAtHour: 9,
          triggerAtMinute: 30
        }]
      }
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
    parameters: {
      method: 'GET',
      url: 'https://hacker-news.firebaseio.com/v0/topstories.json',
      authentication: 'none',
      options: {}
    },
    alwaysOutputData: true,
    position: [480, 300]
  },
  output: [{ storyIds: [1, 2, 3] }]
});

const limitStories = node({
  type: 'n8n-nodes-base.limit',
  version: 1,
  config: {
    name: 'Pierwsze 30 ID',
    parameters: {
      maxItems: 30,
      keep: 'firstItems'
    },
    position: [720, 300]
  },
  output: [{ storyId: 0 }]
});

const fetchStoryDetails = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Pobierz detale HN',
    parameters: {
      method: 'GET',
      url: expr('https://hacker-news.firebaseio.com/v0/item/{{ $json }}.json'),
      authentication: 'none',
      options: {}
    },
    position: [960, 300]
  },
  output: [{ id: 1, title: '', by: '', score: 0, descendants: 0, url: '' }]
});

const filterAndRank = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Filtruj i ranking',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `
var keywords = ['opencode', 'openrouter', 'openai', 'codex', 'gemini', 'stape_io', 'n8n', 'cursor', 'copilot', 'claude', 'llm', 'gpt', 'agent', 'mcp', 'aider', 'devin', 'langchain', 'llama', 'mistral', 'perplexity', 'vibe coding', 'windsurf', 'bolt.new', 'lovable'];

var stories = $input.all().map(function(item) { return item.json; });

var filtered = [];
for (var s = 0; s < stories.length; s++) {
  var title = (stories[s].title || '').toLowerCase();
  for (var k = 0; k < keywords.length; k++) {
    if (title.indexOf(keywords[k].toLowerCase()) !== -1) {
      filtered.push(stories[s]);
      break;
    }
  }
}

filtered.sort(function(a, b) { return (b.score || 0) - (a.score || 0); });
var top5 = filtered.slice(0, 5);

var result = [];
for (var t = 0; t < top5.length; t++) {
  result.push({
    json: {
      title: top5[t].title,
      url: top5[t].url || 'https://news.ycombinator.com/item?id=' + top5[t].id,
      score: top5[t].score || 0,
      author: top5[t].by || 'unknown',
      comments: top5[t].descendants || 0
    }
  });
}
return result;
`
    },
    position: [1200, 300]
  },
  output: [{ title: '', url: '', score: 0, author: '', comments: 0 }]
});

const translateTitle = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Tlumacz tytul',
    parameters: {
      method: 'GET',
      url: expr('https://api.mymemory.translated.net/get?q={{ encodeURIComponent($json.title) }}&langpair=en|pl'),
      authentication: 'none',
      options: {}
    },
    position: [1440, 300]
  },
  output: [{ responseData: { translatedText: '', match: 0 } }]
});

const formatResults = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Formatuj wyniki',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `
var translations = $input.all().map(function(i) { return i.json; });
var originals = $('Filtruj i ranking').all().map(function(i) { return i.json; });

var result = [];
for (var idx = 0; idx < originals.length; idx++) {
  var orig = originals[idx];
  var trans = translations[idx] || {};
  var translatedText = (trans.responseData && trans.responseData.translatedText) || orig.title;

  result.push({
    json: {
      tytul_pl: translatedText,
      tytul_en: orig.title,
      url: orig.url || 'https://news.ycombinator.com/item?id=' + orig.id,
      punkty: orig.score || 0,
      autor: orig.author || 'unknown',
      komentarze: orig.comments || 0,
      data: new Date().toISOString().split('T')[0]
    }
  });
}
return result;
`
    },
    position: [1680, 300]
  },
  output: [{ tytul_pl: '', tytul_en: '', url: '', punkty: 0, autor: '', komentarze: 0, data: '' }]
});

const saveToTable = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Zapisz do tabeli',
    parameters: {
      resource: 'row',
      operation: 'insert',
      dataTableId: { mode: 'id', value: 'Iy9nbjya69dnFGOf' },
      columns: {
        mappingMode: 'autoMapInputData',
        value: null
      },
      options: {}
    },
    position: [1920, 300]
  },
  output: [{ tytul_pl: '', tytul_en: '', url: '', punkty: 0, autor: '', komentarze: 0, data: '', id: 1, createdAt: '2026-05-10' }]
});

export default workflow('hn-top5-monday', 'HN Top 5 - poniedzialek 09:30')
  .add(scheduleTrigger)
  .to(fetchTopStories)
  .to(limitStories)
  .to(fetchStoryDetails)
  .to(filterAndRank)
  .to(translateTitle)
  .to(formatResults)
  .to(saveToTable);
