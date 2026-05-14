import { workflow, node, trigger, expr, newCredential, splitInBatches, nextBatch, languageModel } from '@n8n/workflow-sdk';

const scheduleTrigger = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Codziennie 08:00',
    parameters: {
      rule: {
        interval: [{
          field: 'days',
          daysInterval: 1,
          triggerAtHour: 8,
          triggerAtMinute: 0
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

const fetchStoryDetails = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Pobierz detale HN',
    parameters: {
      method: 'GET',
      url: expr('https://hacker-news.firebaseio.com/v0/item/{{ $json }}.json'),
      authentication: 'none',
      options: {
        timeout: 30000,
        batching: {
          batch: {
            batchSize: 10,
            batchInterval: 200
          }
        }
      }
    },
    position: [720, 300]
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
var keywords = ['opencode', 'cloud code', 'openrouter', 'openai', 'codex', 'antigravity', 'warpdotdev', 'gemini', 'stape_io', 'n8n'];

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
var top10 = filtered.slice(0, 10);

var result = [];
for (var t = 0; t < top10.length; t++) {
  result.push({
    json: {
      title: top10[t].title,
      url: top10[t].url || 'https://news.ycombinator.com/item?id=' + top10[t].id,
      score: top10[t].score || 0,
      author: top10[t].by || 'unknown',
      comments: top10[t].descendants || 0
    }
  });
}
return result;
`
    },
    position: [960, 300]
  },
  output: [{ title: '', url: '', score: 0, author: '', comments: 0 }]
});

const saveOriginal = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Zapisz oryginalne',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `
return [{ json: $input.first().json }];
`
    },
    position: [1320, 300]
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
    position: [1560, 300]
  },
  output: [{ responseData: { translatedText: '', match: 0 } }]
});

const mergeData = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Dolacz dane artykulu',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `
var original = $("Zapisz oryginalne").item.json;
return [{
  json: {
    tytul_en: original.title,
    url: original.url,
    punkty: original.score || 0,
    autor: original.author || 'unknown',
    komentarze: original.comments || 0
  }
}];
`
    },
    position: [1800, 300]
  },
  output: [{ tytul_en: '', url: '', punkty: 0, autor: '', komentarze: 0 }]
});

const groqModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
  version: 1.3,
  config: {
    name: 'Groq via OpenAI',
    parameters: {
      model: { mode: 'id', value: 'llama-3.3-70b-versatile' },
      options: {
        temperature: 0.4,
        baseURL: 'https://api.groq.com/openai/v1'
      }
    },
    credentials: {
      openAiApi: newCredential('Groq account (OpenAI)')
    },
    position: [1920, 500]
  }
});

const summarizeWithGroq = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'Generuj streszczenie (Groq)',
    parameters: {
      promptType: 'define',
      text: expr('Podsumuj ponizszy artykul w jezyku polskim w 5-6 zdaniach. Skup sie na kluczowych wnioskach.\n\nTytul: {{ $json.tytul_en }}\n\nURL: {{ $json.url }}'),
      options: {
        systemMessage: 'Jestes asystentem ktory streszcza artykuly technologiczne w jezyku polskim.'
      }
    },
    subnodes: {
      model: groqModel
    },
    position: [1920, 300]
  },
  output: [{ output: '' }]
});

const prepareBatchResult = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Przygotuj wynik batcha',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `
var orig = $("Zapisz oryginalne").item.json;
var trans = $("Tlumacz tytul").item.json;
var summary = $json;

var translatedText = (trans.responseData && trans.responseData.translatedText) || orig.title;
var streszczenie = summary.output || summary.response || summary.text || '';

return [{
  json: {
    tytul_pl: translatedText,
    tytul_en: orig.title,
    url: orig.url,
    punkty: orig.score || 0,
    autor: orig.author || 'unknown',
    komentarze: orig.comments || 0,
    data: new Date().toISOString().split('T')[0],
    streszczenie_pl: streszczenie
  }
}];
`
    },
    position: [2080, 300]
  },
  output: [{ tytul_pl: '', tytul_en: '', url: '', punkty: 0, autor: '', komentarze: 0, data: '', streszczenie_pl: '' }]
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
return $input.all().map(function(item) {
  return { json: item.json };
});
`
    },
    position: [1680, 200]
  },
  output: [{ tytul_pl: '', tytul_en: '', url: '', punkty: 0, autor: '', komentarze: 0, data: '', streszczenie_pl: '' }]
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
    position: [2040, 200]
  },
  output: [{ tytul_pl: '', tytul_en: '', url: '', punkty: 0, autor: '', komentarze: 0, data: '', streszczenie_pl: '', id: 1, createdAt: '2026-05-12' }]
});

const buildHtmlEmail = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Buduj HTML email',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `
var items = $input.all();
var date = new Date().toISOString().split('T')[0];

var html = '<html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">';
html += '<h1 style="color:#ff6600;">HN Top 10 \\u2014 ' + date + ' (Groq)</h1>';
html += '<p style="color:#666;">Najciekawsze artykuly z Hacker News wybrane z top 500.</p>';
html += '<hr style="border:1px solid #eee;">';

for (var i = 0; i < items.length; i++) {
  var item = items[i].json;
  html += '<h2><a href="' + item.url + '" style="color:#1a73e8;text-decoration:none;">' + escapeHtml(item.tytul_pl) + '</a></h2>';
  html += '<p><strong>Oryginal:</strong> <a href="' + item.url + '" style="color:#1a73e8;">' + escapeHtml(item.tytul_en) + '</a><br>';
  html += '<strong>Punkty:</strong> ' + item.punkty + ' | <strong>Autor:</strong> ' + escapeHtml(item.autor) + ' | <strong>Komentarze:</strong> ' + item.komentarze + '<br>';
  html += '<a href="' + item.url + '" style="font-size:13px;color:#1a73e8;">Otwórz oryginalny artykuł →</a></p>';
  html += '<p><strong>Streszczenie:</strong><br>' + escapeHtml(item.streszczenie_pl) + '</p>';
  if (i < items.length - 1) {
    html += '<hr style="border:1px solid #eee;">';
  }
}

html += '<hr style="border:1px solid #eee;">';
html += '<p style="color:#999;font-size:12px;">Wygenerowano automatycznie przez n8n workflow codziennie o 08:00 (Groq).</p>';
html += '</body></html>';

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

return [{ json: { htmlBody: html, subject: 'HN Top 10 \\u2014 ' + date + ' (Groq)' } }];
`
    },
    position: [2320, 200]
  },
  output: [{ htmlBody: '', subject: '' }]
});

const sendEmail = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Wyslij email',
    parameters: {
      resource: 'message',
      operation: 'send',
      sendTo: 'pmackowka@gmail.com',
      subject: expr('{{ $json.subject }}'),
      emailType: 'html',
      message: expr('{{ $json.htmlBody }}'),
      options: {
        appendAttribution: false
      }
    },
    credentials: {
      gmailOAuth2: newCredential('Gmail account (GCP)')
    },
    position: [2560, 200]
  },
  output: [{ id: 'msg123', labelIds: ['SENT'], threadId: 'thread123' }]
});

const batchNode = splitInBatches({
  version: 3,
  config: {
    name: 'Przetwarzaj po 1',
    parameters: {
      batchSize: 1
    },
    position: [1200, 300]
  }
});

export default workflow('hn-top10-groq', 'HN Top 10 - codziennie 08:00 (Groq)')
  .add(scheduleTrigger)
  .to(fetchTopStories)
  .to(fetchStoryDetails)
  .to(filterAndRank)
  .to(batchNode
    .onDone(formatResults.to(saveToTable).to(buildHtmlEmail).to(sendEmail))
    .onEachBatch(saveOriginal.to(translateTitle).to(mergeData).to(summarizeWithGroq).to(prepareBatchResult).to(nextBatch(batchNode)))
  );
