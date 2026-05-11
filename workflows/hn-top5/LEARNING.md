# Understanding the HN Top 5 Workflow

## Spis treści

1. [Overview](#1-overview)
2. [n8n Workflow SDK — jak definiujemy workflow w kodzie](#2-n8n-workflow-sdk)
3. [Node 1: Schedule Trigger — Co poniedziałek 09:30](#3-node-1-schedule-trigger)
4. [Node 2: HTTP Request — Pobierz top stories HN](#4-node-2-http-request-pobierz-top-stories-hn)
5. [Node 3: Limit — Pierwsze 30 ID](#5-node-3-limit)
6. [Node 4: HTTP Request — Pobierz detale HN](#6-node-4-http-request-pobierz-detale-hn)
7. [Node 5: Code — Filtruj i ranking](#7-node-5-code-filtruj-i-ranking)
8. [Node 6: HTTP Request — Tlumacz tytul](#8-node-6-http-request-tlumacz-tytul)
9. [Node 7: Code — Formatuj wyniki](#9-node-7-code-formatuj-wyniki)
10. [Node 8: Data Table — Zapisz do tabeli](#10-node-8-data-table-zapisz-do-tabeli)
11. [Workflow composition — jak wszystko się łączy](#11-workflow-composition)
12. [Kluczowe koncepcje n8n](#12-kluczowe-koncepcje-n8n)
13. [Lessons Learned — błędy które naprawialiśmy](#13-lessons-learned)

---

## 1. Overview

### Co robi ten workflow?

Raz w tygodniu (w każdy poniedziałek o 09:30) workflow:

1. Łączy się z **Hacker News** (popularny serwis o tematyce technologicznej)
2. Pobiera **500 najgorętszych** aktualnie artykułów
3. Bierze **pierwsze 30** z nich
4. Dla każdego pobiera **szczegóły** (tytuł, autor, punkty, liczba komentarzy, URL)
5. Filtruje po **słowach kluczowych** związanych z AI i programowaniem
6. Wybiera **top 5** najlepszych (najwięcej punktów)
7. Tłumaczy tytuły na **polski** (przez MyMemory API)
8. Formatuje wyniki do **struktury tabeli**
9. Zapisuje wszystko do **Data Table** w n8n

### Przepływ danych — wizualnie

```
[Trigger: poniedziałek 09:30]
        │
        ▼
[HTTP: pobierz 500 ID z HN]
        │
        ▼
[Limit: weź pierwsze 30]
        │
        ▼
[HTTP: pobierz szczegóły × 30 artykułów]
        │
        ▼
[Code: filtruj po słowach kluczowych → top 5]
        │
        ▼
[HTTP: tłumacz tytuły × 5 na polski]
        │
        ▼
[Code: formatuj do struktury tabeli]
        │
        ▼
[Data Table: zapisz wiersz]
```

### Dlaczego akurat taki przepływ?

Każdy node zmienia dane w konkretny sposób. Kluczowa koncepcja w n8n to **itemy** — każdy przepływający obiekt danych. Na początku mamy 1 item (trigger), potem suddenly 500 itemów (bo HN zwraca tablicę), potem 30, potem szczegóły 30 artykułów, potem tylko 5 (po filtrze), itd.

Zrozumienie jak zmienia się **liczba itemów** to klucz do projektowania workflow w n8n.

---

## 2. n8n Workflow SDK

### Jak definiujemy workflow w kodzie?

Workflow pisany jest w TypeScript/Javascript przy użyciu **n8n Workflow SDK**. To biblioteka, która pozwala definiować nody i ich połączenia w kodzie, zamiast klikania w interfejsie graficznym.

```typescript
import { workflow, node, trigger, expr } from '@n8n/workflow-sdk';
```

### Główne funkcje SDK:

| Funkcja | Do czego służy |
|---|---|
| `trigger()` | Definiuje **trigger** — co uruchamia workflow |
| `node()` | Definiuje **node** — pojedynczy krok w workflow |
| `expr()` | Tworzy **wyrażenie** `{{ }}` — dynamiczną wartość |
| `workflow()` | Tworzy workflow i łączy nody w całość |
| `newCredential()` | Referencja do istniejącego credencjału |
| `languageModel()` | Model językowy (np. DeepSeek, OpenAI) |
| `merge()` | Łączy dane z dwóch ścieżek |
| `ifElse()` / `switchCase()` | Rozgałęzienia warunkowe |
| `splitInBatches()` | Przetwarzanie wsadowe |

### Importowane w tym workflow:

```typescript
import { workflow, node, trigger, expr } from '@n8n/workflow-sdk';
```

Używamy tylko tych 4 funkcji, bo nasz workflow jest liniowy — nie ma rozgałęzień ani pętli.

### Kompozycja workflow:

```typescript
export default workflow('hn-top5-monday', 'HN Top 5 - poniedzialek 09:30')
  .add(triggerNode)         // pierwszy node (trigger)
  .to(node1)                // kolejny node
  .to(node2)
  .to(node3)
  // ...
  .to(lastNode);
```

- `.add(node)` — dodaje pierwszy node do workflow
- `.to(nextNode)` — łączy poprzedni node z następnym (tworzy połączenie)

### output — próbka danych

Każdy node ma właściwość `output`, która zawiera **przykładowe dane** jakie ten node zwróci. To nie są rzeczywiste dane — to tylko typy dla TypeScript, żeby następne nody wiedziały jakie pola są dostępne.

```typescript
output: [{ id: 1, title: '', by: '', score: 0 }]
//         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//         To mówi: "ten node zwraca obiekty z polami id, title, by, score"
```

---

## 3. Node 1: Schedule Trigger

### Kod

```typescript
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
```

### Co robi?

To jest **trigger** — punkt startowy workflow. Mówi n8n: _"Uruchom ten workflow w każdy poniedziałek o 09:30"_.

Bez triggera workflow nie ma kiedy się uruchomić.

### Parametry krok po kroku:

| Parametr | Wartość | Znaczenie |
|---|---|---|
| `type` | `n8n-nodes-base.scheduleTrigger` | Typ noda — to jest wbudowany trigger czasowy |
| `version` | `1.3` | Która wersja tego noda (różne wersje mogą mieć inne parametry) |
| `name` | `Co poniedzialek 09:30` | Nazwa widoczna w edytorze n8n (ważne: później można się do niej odwołać) |
| `field` | `weeks` | Jednostka czasu — co tydzień |
| `weeksInterval` | `1` | Co 1 tydzień |
| `triggerAtDay` | `[1]` | Dzień tygodnia: 1 = poniedziałek (0 = niedziela, 1 = poniedziałek, ... 6 = sobota) |
| `triggerAtHour` | `9` | Godzina 09:00 |
| `triggerAtMinute` | `30` | Minuta 30 → 09:30 |

### Dlaczego `parameters: { rule: {...} }`?

W starszych wersjach SDK parametry pisalo się bezpośrednio na poziomie `config`:

```typescript
// STARY SPOSÓB (nie działa już):
config: {
  name: '...',
  rule: { ... },     // ❌ rule na poziomie config
}
```

```typescript
// NOWY SPOSÓB (poprawny):
config: {
  name: '...',
  parameters: {       // ✅ wszystko w parameters
    rule: { ... },
  },
}
```

To była **częsta pułapka** — SDK wymaga, żeby wszystkie parametry specyficzne dla danego noda były w `parameters`.

### Co zwraca?

Trigger zwraca **1 item** z danymi o aktualnym czasie:
```json
{
  "timestamp": "2026-05-11T07:09:15.276+00:00",
  "Readable date": "May 11th 2026, 7:09:15 am",
  "Day of week": "Monday"
}
```

Ten item trafia do następnego noda.

---

## 4. Node 2: HTTP Request — Pobierz top stories HN

### Kod

```typescript
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
```

### Co robi?

Wykonuje zapytanie HTTP GET do API Hacker News i pobiera listę **500 ID najgorętszych artykułów**.

HN API zwraca tablicę liczb:
```json
[48086190, 48085821, 48090521, ...]  // 500 ID
```

Ważne: n8n automatycznie **rozdziela tablicę** na osobne itemy. Z 1 odpowiedzi HTTP (która zwraca tablicę 500 elementów) n8n tworzy **500 osobnych itemów**, każdy zawierający jeden numer ID.

### Parametry

| Parametr | Wartość | Znaczenie |
|---|---|---|
| `method` | `GET` | Typ zapytania HTTP |
| `url` | `https://hacker-news.firebaseio.com/v0/topstories.json` | Adres API HN |
| `authentication` | `none` | To API jest publiczne — nie potrzebuje klucza |
| `options` | `{}` | Dodatkowe opcje (tu nie używamy żadnych) |
| `alwaysOutputData` | `true` | **Ważne**: nawet jeśli API zwróci 0 wyników, node ma kontynuować |

### alwaysOutputData — dlaczego to ważne?

W n8n, jeśli node zwróci **0 itemów**, cały dalszy łańcuch jest **przerywany**. Żaden następny node się nie wykona.

`alwaysOutputData: true` mówi: _"nawet jeśli nie ma danych, wyślij pusty item dalej, żeby workflow nie został przerwany"_.

To szczególnie ważne dla HTTP Requestów, które mogą czasem zwrócić pustą odpowiedź.

### Co wychodzi z tego noda?

500 itemów, każdy wygląda tak:
```json
{ "json": 48086190 }
```

Każdy item to jeden numer ID. Te ID trafiają do następnego noda.

---

## 5. Node 3: Limit

### Kod

```typescript
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
```

### Co robi?

Bierze **pierwsze 30** z 500 itemów i resztę odrzuca. To prosty "kran" — ogranicza przepływ danych.

Dlaczego 30? Bo pobieranie szczegółów 500 artykułów byłoby za wolne (500 zapytań HTTP). 30 to rozsądny kompromis — wystarczająco dużo, żeby znaleźć ciekawe artykuły, ale nie za dużo, żeby workflow działał szybko.

### Parametry

| Parametr | Wartość | Znaczenie |
|---|---|---|
| `maxItems` | `30` | Maksymalna liczba itemów do przepuszczenia |
| `keep` | `firstItems` | Które zachować: pierwsze (`firstItems`) czy ostatnie (`lastItems`) |

### Co wychodzi?

30 itemów (pierwszych 30 ID z listy 500):
```json
{ "json": 48086190 }  // pierwsze ID
{ "json": 48085821 }  // drugie ID
// ... 28 więcej
```

### Uwaga: typ `limit` vs `splitInBatches`

To jest zwykły node `limit`. Jest też node `splitInBatches`, który działa inaczej — dzieli itemy na grupy i przetwarza je partiami. My tego nie potrzebujemy, bo wszystkie 30 szczegółów możemy pobrać równolegle.

---

## 6. Node 4: HTTP Request — Pobierz detale HN

### Kod

```typescript
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
```

### Co robi?

Dla **każdego z 30 ID** wykonuje zapytanie do HN API, żeby pobrać szczegóły artykułu. Ponieważ mamy 30 itemów wchodzących, node wykonuje się **30 razy** — raz dla każdego itemu.

To jest kluczowa koncepcja: **jeśli do noda wchodzi N itemów, node wykona się N razy** (chyba że ma `executeOnce: true` albo `mode: runOnceForAllItems`).

### Wyrażenia — `expr()` i `{{ }}`

```typescript
url: expr('https://hacker-news.firebaseio.com/v0/item/{{ $json }}.json')
```

`expr()` tworzy **wyrażenie n8n**. W środku `{{ }}` można używać zmiennych:

- `$json` — bieżący item (jego zawartość JSON)
- `$('NodeName').item.json` — dane z innego noda
- `$now` — aktualna data/czas
- `$input.all()` — wszystkie itemy z poprzedniego noda

W tym przypadku: dla każdego z 30 itemów, `$json` to ID artykułu (liczba). n8n podstawia to ID do URL:

```
Dla itemu { json: 48086190 }:
URL = https://hacker-news.firebaseio.com/v0/item/48086190.json

Dla itemu { json: 48085821 }:
URL = https://hacker-news.firebaseio.com/v0/item/48085821.json
```

**Zasada**: `$json` zawsze odnosi się do bieżącego itemu. Gdy node wykonuje się 30 razy, `$json` za każdym razem ma inną wartość.

### Co zwraca HN API dla pojedynczego artykułu?

```json
{
  "id": 48086190,
  "title": "Hardware Attestation as Monopoly Enabler",
  "by": "ChuckMcM",
  "score": 1317,
  "descendants": 436,
  "url": "https://grapheneos.social/...",
  "type": "story",
  "time": 1778435642,
  "kids": [...]
}
```

### Co wychodzi?

30 itemów, każdy to szczegóły jednego artykułu:
```json
{ "json": { "id": 48086190, "title": "...", "by": "...", "score": 1317, ... } }
{ "json": { "id": 48085821, "title": "...", "by": "...", "score": 42, ... } }
```

---

## 7. Node 5: Code — Filtruj i ranking

### Kod

```typescript
const filterAndRank = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Filtruj i ranking',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `
var keywords = ['opencode', 'openrouter', 'openai', 'codex', 'gemini',
                'stape_io', 'n8n', 'cursor', 'copilot', 'claude', 'llm',
                'gpt', 'agent', 'mcp', 'aider', 'devin', 'langchain',
                'llama', 'mistral', 'perplexity', 'vibe coding',
                'windsurf', 'bolt.new', 'lovable'];

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
```

### Co robi?

To **serce workflow** — przyjmuje 30 artykułów, filtruje je po słowach kluczowych, sortuje po liczbie punktów i zwraca tylko **top 5**.

### mode: runOnceForAllItems

```typescript
mode: 'runOnceForAllItems'
```

Domyślnie Code node wykonuje się **raz na każdy item** (jak HTTP Request powyżej). Ale tu chcemy przetworzyć **wszystkie 30 artykułów naraz** — dlatego używamy `runOnceForAllItems`.

- `runOnceForEachItem` (domyślny) — kod wykonuje się N razy, raz na item
- `runOnceForAllItems` — kod wykonuje się **1 raz**, a `$input.all()` zwraca wszystkie itemy

### Kod — analiza linijka po linijce

```javascript
// Lista słów kluczowych — artykuły muszą zawierać któreś z nich w tytule
var keywords = ['opencode', 'openrouter', ...];

// Pobierz wszystkie 30 itemów i wyciągnij z nich właściwe dane (.json)
var stories = $input.all().map(function(item) { return item.json; });

// Filtruj: sprawdź każdy tytuł czy zawiera któreś słowo kluczowe
var filtered = [];
for (var s = 0; s < stories.length; s++) {
  var title = (stories[s].title || '').toLowerCase();
  for (var k = 0; k < keywords.length; k++) {
    if (title.indexOf(keywords[k].toLowerCase()) !== -1) {
      filtered.push(stories[s]);
      break;    // przestań szukać gdy znajdziesz pierwsze dopasowanie
    }
  }
}

// Sortuj po score (najwyżej punktowane pierwsze)
filtered.sort(function(a, b) {
  return (b.score || 0) - (a.score || 0);
});
var top5 = filtered.slice(0, 5);  // weź tylko 5 najlepszych

// Formatuj wynik
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
return result;  // n8n przyjmie tę tablicę jako itemy wyjściowe
```

**Ważne**: Kod w Code node to **JavaScript**, nie TypeScript. Używamy `var` zamiast `let`/`const` (chociaż `let` też działa). Wynik musi być tablicą obiektów z polem `json`.

### $input.all() vs $input.first()

- `$input.all()` — zwraca **wszystkie** itemy z poprzedniego noda (tablica)
- `$input.first()` — zwraca **pierwszy** item
- `$input.item` — bieżący item (gdy `mode: runOnceForEachItem`)

### Co wychodzi?

5 itemów, każdy z przefiltrowanymi i posortowanymi danymi:
```json
{
  "json": {
    "title": "An AI coding agent...",
    "url": "https://...",
    "score": 122,
    "author": "cratermoon",
    "comments": 29
  }
}
```

---

## 8. Node 6: HTTP Request — Tlumacz tytul

### Kod

```typescript
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
```

### Co robi?

Dla każdego z 5 artykułów wywołuje **MyMemory API** — darmowe API tłumaczeniowe. Tłumaczy tytuł z angielskiego na polski.

Ponieważ wchodzi 5 itemów, node wykonuje się **5 razy**.

### Wyrażenie URL

```
https://api.mymemory.translated.net/get
  ?q={{ encodeURIComponent($json.title) }}
  &langpair=en|pl
```

- `q` — tekst do tłumaczenia (URL-encoded)
- `langpair=en|pl` — z angielskiego na polski
- `encodeURIComponent()` — funkcja JavaScript, zamienia znaki specjalne na format URL (np. spacja → `%20`)
- `$json.title` — tytuł artykułu z poprzedniego noda

**$json** — w tym momencie `$json` to obiekt `{ title: "An AI coding agent...", url: "...", score: 122, ... }` (bo wchodzą itemy z noda "Filtruj i ranking"). Dlatego `$json.title` działa.

### Co zwraca MyMemory API?

```json
{
  "responseData": {
    "translatedText": "Agent kodujący sztuczną inteligencję...",
    "match": 0.85
  },
  "responseStatus": 200
}
```

### Co wychodzi?

5 itemów, każdy z odpowiedzią z API tłumaczenia:
```json
{
  "json": {
    "responseData": {
      "translatedText": "Agent kodujący sztuczną inteligencję...",
      "match": 0.85
    },
    "responseStatus": 200
  }
}
```

---

## 9. Node 7: Code — Formatuj wyniki

### Kod

```typescript
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
```

### Co robi?

Łączy dane z dwóch źródeł:
1. **Bieżące dane** (`$input`) — przetłumaczone tytuły z MyMemory
2. **Dane z noda "Filtruj i ranking"** (`$('Filtruj i ranking')`) — oryginalne tytuły i metadane

Tworzy wynikowy obiekt z polskimi nazwami pól, gotowy do zapisu w tabeli.

### $('NodeName') — dostęp do innych nodów

```javascript
var originals = $('Filtruj i ranking').all().map(function(i) { return i.json; });
```

`$('Filtruj i ranking')` to specjalna funkcja n8n — pozwala sięgnąć do danych **z dowolnego wcześniejszego noda** po jego nazwie.

To jest bardzo potężne: nawet jeśli między nodami przepłynęły inne dane (tłumaczenia), wciąż mamy dostęp do oryginałów.

### $input.all() — dane z bezpośrednio poprzedzającego noda

```javascript
var translations = $input.all().map(function(i) { return i.json; });
```

`$input` zawsze odnosi się do **bezpośredniego poprzednika** w łańcuchu.

### Łączenie danych po indeksie

```javascript
for (var idx = 0; idx < originals.length; idx++) {
  var orig = originals[idx];
  var trans = translations[idx] || {};
```

Zakładamy, że itemy są w tej samej kolejności. `translations[0]` odpowiada `originals[0]` — to działa bo nody są połączone liniowo i itemy zachowują kolejność.

### Fallback dla tłumaczenia

```javascript
var translatedText = (trans.responseData && trans.responseData.translatedText) || orig.title;
```

Jeśli MyMemory API nie zwróciło tłumaczenia (np. błąd sieci, limit API), używamy oryginalnego tytułu. To **fallback** — zabezpieczenie przed błędami.

### Dlaczego polskie nazwy pól?

Tabela w n8n ma kolumny z polskimi nazwami (`tytul_pl`, `punkty`, `autor`, itd.). Node mapuje angielskie pola z HN na polskie nazwy kolumn.

### Co wychodzi?

5 itemów z gotową strukturą dla Data Table:
```json
{
  "json": {
    "tytul_pl": "Agent kodujący sztuczną inteligencję...",
    "tytul_en": "An AI coding agent...",
    "url": "https://www.jamesshore.com/...",
    "punkty": 122,
    "autor": "cratermoon",
    "komentarze": 29,
    "data": "2026-05-11"
  }
}
```

---

## 10. Node 8: Data Table — Zapisz do tabeli

### Kod

```typescript
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
  output: [{ tytul_pl: '', tytul_en: '', url: '', punkty: 0, autor: '',
             komentarze: 0, data: '', id: 1, createdAt: '2026-05-10' }]
});
```

### Co robi?

Zapisuje każdy z 5 itemów jako **nowy wiersz** w Data Table o nazwie "HN Top 5 - Artykuly".

### Parametry

| Parametr | Wartość | Znaczenie |
|---|---|---|
| `resource` | `'row'` | Działamy na poziomie wierszy (nie tabel) |
| `operation` | `'insert'` | Wstawiamy nowe wiersze |
| `dataTableId` | `{ mode: 'id', value: 'Iy9nbjya69dnFGOf' }` | Która tabela — identyfikator tabeli |

### dataTableId — Resource Locator

```typescript
dataTableId: { mode: 'id', value: 'Iy9nbjya69dnFGOf' }
```

To jest **resource locator** — sposób identyfikacji tabeli. Możliwe tryby:
- `mode: 'id'` — po ID tabeli (używamy tego)
- `mode: 'name'` — po nazwie tabeli
- `mode: 'list'` — z listy (wymaga interakcji użytkownika)

### columns — najważniejszy parametr

```typescript
columns: {
  mappingMode: 'autoMapInputData',
  value: null
}
```

To był **najtrudniejszy do skonfigurowania** parametr w tym workflow!

**`columns`** to `resourceMapper` — specjalny typ parametru w n8n, który mówi jak mapować pola wejściowe na kolumny tabeli.

- `mappingMode: 'autoMapInputData'` — **automatyczne mapowanie**: weź pola z wejściowych itemów i dopasuj do kolumn tabeli po nazwie. Działa gdy nazwy pól (`tytul_pl`, `tytul_en`, ...) dokładnie odpowiadają nazwom kolumn.
- `mappingMode: 'defineBelow'` — ręczne mapowanie: trzeba wymienić każdą kolumnę z osobna

Alternatywnie można było użyć:
```typescript
// Ręczne mapowanie (gdyby nazwy pól nie pasowały do nazw kolumn):
columns: {
  mappingMode: 'defineBelow',
  value: [
    { column: 'tytul_pl' },
    { column: 'tytul_en' },
    // ...
  ]
}
```

### Dlaczego `autoMapInputData` a nie `defineBelow`?

Początkowo próbowaliśmy `defineBelow` z różnymi formatami, ale:
- Obiekty `{ column: 'tytul_pl' }` dawały błąd "unexpected object input"
- Tablica stringów `['tytul_pl', ...]` dawała "unknown column name '0'"
- Brak `columns` powodował "Cannot convert undefined or null to object"

`autoMapInputData` okazał się właściwym rozwiązaniem — automatycznie dopasowuje pola wejściowe do kolumn po nazwie.

### Struktura tabeli docelowej

Tabela "HN Top 5 - Artykuly" ma kolumny:

| Kolumna | Typ | Indeks |
|---|---|---|
| `tytul_pl` | string | 0 |
| `tytul_en` | string | 1 |
| `url` | string | 2 |
| `punkty` | number | 3 |
| `autor` | string | 4 |
| `komentarze` | number | 5 |
| `data` | string | 6 |

### Co zwraca?

5 itemów potwierdzających zapis:
```json
{
  "json": {
    "tytul_pl": "Agent kodujący...",
    "tytul_en": "An AI coding agent...",
    "url": "https://...",
    "punkty": 122,
    "autor": "cratermoon",
    "komentarze": 29,
    "data": "2026-05-11",
    "id": 1,
    "createdAt": "2026-05-11T07:09:17.608Z",
    "updatedAt": "2026-05-11T07:09:17.608Z"
  }
}
```

`id`, `createdAt`, `updatedAt` są generowane automatycznie przez Data Table.

---

## 11. Workflow composition

### Jak SDK łączy nody?

```typescript
export default workflow('hn-top5-monday', 'HN Top 5 - poniedzialek 09:30')
  .add(scheduleTrigger)     // 1. Dodaj trigger
  .to(fetchTopStories)       // 2. Połącz trigger → fetchTopStories
  .to(limitStories)          // 3. Połącz fetchTopStories → limitStories
  .to(fetchStoryDetails)     // 4. Połącz limitStories → fetchStoryDetails
  .to(filterAndRank)         // 5. Połącz fetchStoryDetails → filterAndRank
  .to(translateTitle)        // 6. Połącz filterAndRank → translateTitle
  .to(formatResults)         // 7. Połącz translateTitle → formatResults
  .to(saveToTable);          // 8. Połącz formatResults → saveToTable
```

### workflow(id, name)

- Pierwszy argument: **ID workflow** (`'hn-top5-monday'`) — unikalny identyfikator
- Drugi argument: **Nazwa** (`'HN Top 5 - poniedzialek 09:30'`) — wyświetlana w n8n

### .add() vs .to()

- `.add(node)` — dodaje pierwszy node do workflow (zazwyczaj trigger)
- `.to(nextNode)` — łączy poprzedni node z następnym

Dla rozgałęzień używa się `.add()` wielokrotnie:

```typescript
export default workflow('id', 'name')
  .add(triggerNode)
  .to(sharedNode)
  .add(triggerNode)           // drugie .add() z tym samym triggerem
  .to(branchNode.to(mergeNode.input(0)))
  .add(mergeNode)             // dodaj merge po zdefiniowaniu obu gałęzi
  .to(finalNode);
```

### Pozycje na canvas

```typescript
position: [240, 300]
```

Każdy node ma pozycję na wizualnym canvas n8n. `[x, y]` — każdy kolejny node jest przesunięty w prawo o ~240px. To nie wpływa na działanie, tylko na wygląd w edytorze.

---

## 12. Kluczowe koncepcje n8n

### Item

**Item** to podstawowa jednostka danych w n8n. Każdy node przyjmuje tablicę itemów na wejściu i zwraca tablicę itemów na wyjściu.

Item ma strukturę:
```typescript
{
  json: { ... },          // właściwe dane (obiekt JSON)
  binary?: { ... },       // dane binarne (pliki, obrazy) — opcjonalne
  pairedItem?: { ... }    // informacja o tym, z którego itemu wejściowego powstał
}
```

### Jak zmienia się liczba itemów?

| Node | Wejście | Wyjście | Operacja |
|---|---|---|---|
| Schedule Trigger | — | 1 item | Trigger zawsze produkuje 1 item |
| HTTP (topstories) | 1 | 500 | n8n rozdziela tablicę JSON na itemy |
| Limit | 500 | 30 | Odrzuca 470 itemów |
| HTTP (detale) | 30 | 30 | Każdy item → osobne zapytanie HTTP |
| Code (filtr) | 30 | 5 | Kod redukuje z 30 do 5 |
| HTTP (tlumacz) | 5 | 5 | Każdy item → osobne zapytanie HTTP |
| Code (format) | 5 | 5 | Kod transformuje dane |
| Data Table | 5 | 5 | Każdy item → osobny wiersz w tabeli |

**Wniosek**: zawsze śledź ile itemów przepływa przez workflow. To klucz do zrozumienia dlaczego niektóre nody wykonują się wiele razy.

### $json, $input, $('NodeName')

| Zmienna | Znaczenie |
|---|---|
| `$json` | Zawartość JSON bieżącego itemu (w Code node: pojedynczy item) |
| `$input.all()` | Wszystkie itemy z bezpośrednio poprzedzającego noda |
| `$input.first()` | Pierwszy item z poprzedzającego noda |
| `$input.item` | Bieżący item (gdy `mode: runOnceForEachItem`) |
| `$('NodeName')` | Dostęp do danych z dowolnego noda po nazwie |
| `$('NodeName').all()` | Wszystkie itemy z danego noda |
| `$('NodeName').first()` | Pierwszy item z danego noda |
| `$now` / `$today` | Aktualna data/czas (Luxon DateTime) |
| `$itemIndex` | Indeks bieżącego itemu (0-based) |
| `$execution.id` | ID bieżącego wykonania |

### Wyrażenia — expr()

`expr()` tworzy składnię `{{ }}` w n8n. W tej składni można używać zmiennych i wyrażeń JavaScript:

```typescript
// Proste podstawienie
expr('Hello {{ $json.name }}')

// Wywołanie funkcji
expr('Report for {{ $now.toFormat("MMMM d, yyyy") }}')

// Ternary
expr('Status: {{ $json.count > 0 ? "active" : "empty" }}')

// URL z dynamicznym ID
expr('https://api.example.com/item/{{ $json }}.json')
```

**Ważne**: `$json`, `$now`, `$()` itp. muszą być WEWNĄTRZ `{{ }}`, nigdy na zewnątrz:

```typescript
// ❌ ŹLE — $now poza {{ }}
expr('Daily Digest - ' + $now.toFormat('MMMM d'))

// ✅ DOBRZE — wszystko w {{ }}
expr('Daily Digest - {{ $now.toFormat("MMMM d") }}')
```

### mode w Code node

```typescript
parameters: {
  mode: 'runOnceForAllItems'  // lub 'runOnceForEachItem'
}
```

- `runOnceForEachItem` (domyślny bez podania mode) — kod wykonuje się raz na każdy item. W kodzie `$input.all()` zwraca jeden item.
- `runOnceForAllItems` — kod wykonuje się raz dla wszystkich itemów. W kodzie `$input.all()` zwraca wszystkie itemy.

### alwaysOutputData

```typescript
config: {
  alwaysOutputData: true,
}
```

Gdy node zwróci 0 itemów, workflow zostaje przerwany. `alwaysOutputData: true` zapobiega temu — jeśli nie ma prawdziwych danych, node zwraca 1 pusty item. Przydatne dla HTTP Requestów które mogą zwrócić pustą odpowiedź.

### Stare vs nowe SDK — kluczowe różnice

| Aspekt | Stare SDK | Nowe SDK |
|---|---|---|
| Parametry | Bezpośrednio w `config` | W `config.parameters` |
| Code node | `code`, `executeOnce` | `jsCode`, `mode` |
| Wyrażenia | Bezpośrednio w stringu | Poprzez `expr()` |
| Trigger | `rule` w `config` | `rule` w `parameters` |

---

## 13. Lessons Learned

### 1. "Cannot convert undefined or null to object"

**Problem**: Data Table node nie miał parametru `columns`.

**Przyczyna**: Bez `columns`, node próbuje parsować niezdefiniowaną wartość, co powoduje błąd JavaScript `Object.keys(null)`.

**Rozwiązanie**: Dodaj `columns: { mappingMode: 'autoMapInputData', value: null }`.

### 2. "Must be an n8n expression"

**Problem**: Próbowaliśmy przekazać `columns` jako zwykły string JSON.

**Przyczyna**: Node oczekiwał, że `columns` będzie obiektem, a nie stringiem.

**Rozwiązanie**: Przekaż jako obiekt, nie string.

### 3. "unexpected object input"

**Problem**: `columns.value` jako tablica obiektów `[{column: "tytul_pl"}]`.

**Przyczyna**: Node interpretował obiekty jako wartości do wstawienia, a nie jako specyfikację mapowania.

**Rozwiązanie**: Użyj `autoMapInputData` zamiast ręcznego mapowania.

### 4. Parametry w `config` vs `parameters`

**Problem**: Stary kod miał `method`, `url` bezpośrednio w `config`.

**Przyczyna**: Starsza wersja SDK akceptowała ten format, nowsza wymaga `parameters`.

**Rozwiązanie**: Umieść wszystko w `parameters: { method, url, ... }`.

### 5. http vs HTTP Request node

**Problem**: Kod w Code node używał `$http.get()` do wywołań HTTP.

**Przyczyna**: `$http` jest dostępny w Code node, ale miesza logikę — kod i komunikacja sieciowa w jednym.

**Rozwiązanie**: Użyj osobnego HTTP Request noda dla każdego wywołania API — to czystsze i łatwiejsze do debugowania.

### 6. executeOnce vs mode

**Problem**: Stary kod używał `executeOnce: true` w Code node.

**Przyczyna**: `executeOnce` to stary sposób na jednokrotne wykonanie. Nowe SDK używa `mode`.

**Rozwiązanie**: `mode: 'runOnceForAllItems'` zamiast `executeOnce: true`.

### 7. rule w trigger

**Problem**: `rule` był na poziomie `config` zamiast w `parameters`.

**Przyczyna**: Trigger to też node — jego parametry też muszą być w `parameters`.

**Rozwiązanie**: `config: { parameters: { rule: { ... } } }`.

---

## Dodatek: Przydatne materiały

- [n8n Documentation](https://docs.n8n.io/)
- [n8n MCP Server Docs](https://docs.n8n.io/advanced-ai/mcp/accessing-n8n-mcp-server/)
- [HN API Documentation](https://github.com/HackerNews/API)
- [MyMemory API](https://mymemory.translated.net/doc/spec.php)
