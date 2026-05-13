import { workflow, node, trigger, expr, newCredential } from '@n8n/workflow-sdk';

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

const fetchLobsteRs = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Pobierz Lobste.rs',
    parameters: {
      method: 'GET',
      url: 'https://lobste.rs/stories.json',
      authentication: 'none',
      options: {}
    },
    alwaysOutputData: true,
    position: [960, 300]
  },
  output: [{ title: '', url: '', score: 0, comment_count: 0, submitter_user: { username: '' }, tags: [''] }]
});

const filterAndMerge = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Filtruj i scalaj',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `
var keywords = ['opencode', 'cloud code', 'openrouter', 'openai', 'codex', 'antigravity', 'warpdotdev', 'gemini', 'stape_io', 'n8n'];

function matchesKeywords(item) {
  var title = (item.title || '').toLowerCase();
  for (var k = 0; k < keywords.length; k++) {
    if (title.indexOf(keywords[k]) !== -1) return true;
  }
  return false;
}

var hnItems = $('Pobierz detale HN').all().map(function(i) { return i.json; });
var hnFiltered = [];
for (var i = 0; i < hnItems.length; i++) {
  if (matchesKeywords(hnItems[i])) hnFiltered.push(hnItems[i]);
}
hnFiltered.sort(function(a, b) { return (b.score || 0) - (a.score || 0); });
var hnTop5 = hnFiltered.slice(0, 5);

var lobstersItems = $input.all().map(function(i) { return i.json; });
var lobstersFiltered = [];
for (var i = 0; i < lobstersItems.length; i++) {
  if (matchesKeywords(lobstersItems[i])) lobstersFiltered.push(lobstersItems[i]);
}
lobstersFiltered.sort(function(a, b) { return (b.comment_count || 0) - (a.comment_count || 0); });
var lobstersTop5 = lobstersFiltered.slice(0, 5);

var result = [];
for (var i = 0; i < hnTop5.length; i++) {
  var h = hnTop5[i];
  result.push({
    json: {
      title: h.title,
      url: h.url || 'https://news.ycombinator.com/item?id=' + h.id,
      comments: h.descendants || 0,
      score: h.score || 0,
      author: h.by || 'unknown',
      source: 'HN'
    }
  });
}
for (var i = 0; i < lobstersTop5.length; i++) {
  var l = lobstersTop5[i];
  result.push({
    json: {
      title: l.title,
      url: l.url,
      comments: l.comment_count || 0,
      score: l.score || 0,
      author: l.submitter_user ? (l.submitter_user.username || 'unknown') : 'unknown',
      source: 'Lobste.rs'
    }
  });
}
return result;
`
    },
    position: [1200, 300]
  },
  output: [{ title: '', url: '', comments: 0, score: 0, author: '', source: '' }]
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
          content: expr('Podsumuj ponizszy artykul w jezyku polskim w 2-3 zdaniach. Skup sie na kluczowych wnioskach.\n\nTytul: {{ $("Filtruj i scalaj").item.json.title }}\n\nURL: {{ $("Filtruj i scalaj").item.json.url }}'),
          role: 'user'
        }]
      },
      simplify: true,
      builtInTools: {
        urlContext: true
      },
      options: {
        temperature: 0.4,
        maxOutputTokens: 1024
      }
    },
    credentials: {
      googlePalmApi: newCredential('Google Gemini (AI Studio)')
    },
    position: [1680, 300]
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
var originals = $('Filtruj i scalaj').all().map(function(i) { return i.json; });
var summaries = $('Generuj streszczenie').all().map(function(i) { return i.json; });

var result = [];
for (var idx = 0; idx < originals.length; idx++) {
  var orig = originals[idx];
  var trans = translations[idx] || {};
  var translatedText = (trans.responseData && trans.responseData.translatedText) || orig.title;

  var summary = summaries[idx] || {};
  var streszczenie = '';
  if (summary.content && summary.content.parts && summary.content.parts.length > 0) {
    streszczenie = summary.content.parts[0].text || '';
  }

  result.push({
    json: {
      tytul_pl: translatedText,
      tytul_en: orig.title,
      url: orig.url,
      punkty: orig.score || 0,
      komentarze: orig.comments || 0,
      autor: orig.author || 'unknown',
      zrodlo: orig.source || '',
      data: new Date().toISOString().split('T')[0],
      streszczenie_pl: streszczenie
    }
  });
}
return result;
`
    },
    position: [1920, 300]
  },
  output: [{ tytul_pl: '', tytul_en: '', url: '', punkty: 0, komentarze: 0, autor: '', zrodlo: '', data: '', streszczenie_pl: '' }]
});

const saveToTable = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Zapisz do tabeli',
    parameters: {
      resource: 'row',
      operation: 'insert',
      dataTableId: { mode: 'id', value: 'nowa_tabela_top10' },
      columns: {
        mappingMode: 'autoMapInputData',
        value: null
      },
      options: {}
    },
    position: [2160, 300]
  },
  output: [{ tytul_pl: '', tytul_en: '', url: '', punkty: 0, komentarze: 0, autor: '', zrodlo: '', data: '', streszczenie_pl: '', id: 1, createdAt: '' }]
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

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function sourceBadge(source) {
  if (source === 'HN') return '<span style="background:#ff6600;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:bold;">HN</span>';
  if (source === 'Lobste.rs') return '<span style="background:#1a5276;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:bold;">Lobste.rs</span>';
  return '<span style="background:#666;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;">' + escapeHtml(source) + '</span>';
}

var html = '<html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">';
html += '<h1 style="color:#ff6600;">HN + Lobste.rs Top 10 \\u2014 ' + date + '</h1>';
html += '<p style="color:#666;">Najciekawsze artykuly z Hacker News i Lobste.rs wybrane z top 500 / top 200.</p>';
html += '<hr style="border:1px solid #eee;">';

var hnCount = 0;
var lobstersCount = 0;
for (var i = 0; i < items.length; i++) {
  var item = items[i].json;
  if (item.zrodlo === 'HN') hnCount++;
  if (item.zrodlo === 'Lobste.rs') lobstersCount++;
}

html += '<p><strong>Podsumowanie:</strong> ' + hnCount + ' z HN, ' + lobstersCount + ' z Lobste.rs</p>';
html += '<hr style="border:1px solid #eee;">';

for (var i = 0; i < items.length; i++) {
  var item = items[i].json;
  html += '<h2>' + sourceBadge(item.zrodlo) + ' <a href="' + item.url + '" style="color:#1a73e8;text-decoration:none;">' + escapeHtml(item.tytul_pl) + '</a></h2>';
  html += '<p><strong>Oryginal:</strong> ' + escapeHtml(item.tytul_en) + '<br>';
  html += '<strong>Komentarze:</strong> ' + item.komentarze;
  if (item.zrodlo === 'HN') {
    html += ' | <strong>Punkty:</strong> ' + item.punkty;
  }
  html += ' | <strong>Autor:</strong> ' + escapeHtml(item.autor) + '</p>';
  html += '<p><strong>Link:</strong> <a href="' + item.url + '" style="color:#1a73e8;">' + escapeHtml(item.url) + '</a></p>';
  html += '<p><strong>Streszczenie:</strong><br>' + escapeHtml(item.streszczenie_pl) + '</p>';
  if (i < items.length - 1) {
    html += '<hr style="border:1px solid #eee;">';
  }
}

html += '<hr style="border:1px solid #eee;">';
html += '<p style="color:#999;font-size:12px;">Wygenerowano automatycznie przez n8n workflow codziennie o 08:00.</p>';
html += '</body></html>';

return [{ json: { htmlBody: html, subject: 'HN + Lobste.rs Top 10 \\u2014 ' + date } }];
`
    },
    position: [2400, 300]
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
    position: [2640, 300]
  },
  output: [{ id: 'msg123', labelIds: ['SENT'], threadId: 'thread123' }]
});

export default workflow('lobsters-hn-top10-daily', 'Lobste.rs + HN Top 10 - codziennie 08:00')
  .add(scheduleTrigger)
  .to(fetchTopStories)
  .to(fetchStoryDetails)
  .to(fetchLobsteRs)
  .to(filterAndMerge)
  .to(translateTitle)
  .to(summarizeWithGemini)
  .to(formatResults)
  .to(saveToTable)
  .to(buildHtmlEmail)
  .to(sendEmail);
