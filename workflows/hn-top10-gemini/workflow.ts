import { workflow, node, trigger, expr, newCredential, splitInBatches, nextBatch } from '@n8n/workflow-sdk';

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

const wait20s = node({
  type: 'n8n-nodes-base.wait',
  version: 1.1,
  config: {
    name: 'Odczekaj 20s',
    parameters: {
      resume: 'timeInterval',
      amount: 20,
      unit: 'seconds'
    },
    position: [1680, 300]
  },
  output: [{}]
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
var original = $("Filtruj i ranking").item.json;
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

const summarizeWithGemini = node({
  type: '@n8n/n8n-nodes-langchain.googleGemini',
  version: 1.2,
  config: {
    name: 'Generuj streszczenie',
    parameters: {
      resource: 'text',
      operation: 'message',

      messages: {
        values: [{
          content: expr('Podsumuj ponizszy artykul w jezyku polskim w 5-6 zdaniach. Skup sie na kluczowych wnioskach.\n\nTytul: {{ $json.tytul_en }}\n\nURL: {{ $json.url }}'),
          role: 'user'
        }]
      },
      simplify: true,
      options: {
        temperature: 0.4,
        maxOutputTokens: 4096
      }
    },
    credentials: {
      googlePalmApi: newCredential('Google Gemini (AI Studio)')
    },
    position: [2040, 300]
  },
  output: [{ response: '' }]
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
var translations = $('Tlumacz tytul').all().map(function(i) { return i.json; });
var articleData = $('Dolacz dane artykulu').all().map(function(i) { return i.json; });
var summaries = $('Generuj streszczenie').all().map(function(i) { return i.json; });

var result = [];
for (var idx = 0; idx < articleData.length; idx++) {
  var orig = articleData[idx];
  var trans = translations[idx] || {};
  var translatedText = (trans.responseData && trans.responseData.translatedText) || orig.tytul_en;

  var summary = summaries[idx] || {};
  var streszczenie = '';
  if (summary.response && typeof summary.response === 'string') {
    streszczenie = summary.response;
  } else if (summary.content && summary.content.parts && summary.content.parts.length > 0) {
    streszczenie = summary.content.parts[0].text || '';
  }
  if (!streszczenie) {
    console.log('Brak streszczenia dla idx ' + idx + ' | tytul: ' + orig.tytul_en + ' | gemini response:', JSON.stringify(summary));
  }

  result.push({
    json: {
      tytul_pl: translatedText,
      tytul_en: orig.tytul_en,
      url: orig.url,
      punkty: orig.punkty,
      autor: orig.autor,
      komentarze: orig.komentarze,
      data: new Date().toISOString().split('T')[0],
      streszczenie_pl: streszczenie
    }
  });
}
return result;
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
    position: [1920, 200]
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
html += '<h1 style="color:#ff6600;">HN Top 10 \\u2014 ' + date + '</h1>';
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
html += '<p style="color:#999;font-size:12px;">Wygenerowano automatycznie przez n8n workflow codziennie o 08:00.</p>';
html += '</body></html>';

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

return [{ json: { htmlBody: html, subject: 'HN Top 10 \\u2014 ' + date } }];
`
    },
    position: [2160, 200]
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
    position: [2400, 200]
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

export default workflow('hn-top10-daily', 'HN Top 10 - codziennie 08:00')
  .add(scheduleTrigger)
  .to(fetchTopStories)
  .to(fetchStoryDetails)
  .to(filterAndRank)
  .to(batchNode
    .onDone(formatResults.to(saveToTable).to(buildHtmlEmail).to(sendEmail))
    .onEachBatch(translateTitle.to(wait20s).to(mergeData).to(summarizeWithGemini).to(nextBatch(batchNode)))
  );
