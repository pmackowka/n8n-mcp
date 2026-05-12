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
// Importujemy 4 funkcje z n8n Workflow SDK — każda służy do innej rzeczy:
import { workflow, node, trigger, expr } from '@n8n/workflow-sdk';
// import: { workflow, node, trigger, expr }
//   workflow() — tworzy cały workflow i łączy nody w łańcuch
//   node() — definiuje pojedynczy node (krok) w workflow
//   trigger() — definiuje trigger (zdarzenie uruchamiające workflow)
//   expr() — tworzy wyrażenia {{ }} do dynamicznych wartości w parametrach
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
// importujemy tylko 4 funkcje — nasz workflow jest prosty i liniowy (nie ma rozgałęzień, pętli ani AI)
```

### Kompozycja workflow:

```typescript
export default workflow('hn-top5-monday', 'HN Top 5 - poniedzialek 09:30')
//                      ^^^^^^^^^^^^^^^^  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//                      ID workflow (unikalne w instancji n8n)  nazwa wyświetlana w edytorze
  .add(scheduleTrigger) // .add() = START — dodaje trigger jako pierwszy node
  .to(fetchTopStories) // .to() = łączy scheduleTrigger → fetchTopStories
  .to(limitStories) // .to() = łączy fetchTopStories → limitStories
  .to(fetchStoryDetails) // .to() = łączy limitStories → fetchStoryDetails
  .to(filterAndRank) // .to() = łączy fetchStoryDetails → filterAndRank
  .to(translateTitle) // .to() = łączy filterAndRank → translateTitle
  .to(formatResults) // .to() = łączy translateTitle → formatResults
  .to(saveToTable); // .to() = ostatni node — koniec łańcucha
```

- `.add(node)` — dodaje pierwszy node do workflow (zazwyczaj trigger)
- `.to(nextNode)` — łączy poprzedni node z następnym (tworzy połączenie)

### output — próbka danych

Każdy node ma właściwość `output`, która zawiera **przykładowe dane** jakie ten node zwróci. To nie są rzeczywiste dane — to tylko typy dla TypeScript, żeby następne nody wiedziały jakie pola są dostępne.

```typescript
output: [{ id: 1, title: '', by: '', score: 0 }]
// output — próbka danych: mówi TypeScriptowi jakie pola zwróci ten node
// Zawartość: obiekt z polami id (numer), title (string), by (string), score (liczba)
// To nie są rzeczywiste dane — to tylko typy dla następnych nodów
```

---

## 3. Node 1: Schedule Trigger

### Kod

```typescript
// Definiujemy trigger czasowy — punkt startowy workflow, który uruchamia się automatycznie
const scheduleTrigger = trigger({
  // trigger() to funkcja SDK tworząca trigger (zdarzenie uruchamiające workflow)
  type: 'n8n-nodes-base.scheduleTrigger',
  // type — typ noda: scheduleTrigger = wbudowany trigger czasowy (cron-like)
  // Każdy node w n8n ma typ — to mówi n8n jakiego rodzaju to node
  version: 1.3,
  // version — wersja 1.3 tego konkretnego noda
  // Różne wersje mogą mieć różne parametry i zachowanie — to pole jest wymagane
  config: {
    // config — obiekt konfiguracyjny zawierający wszystkie ustawienia noda
    name: 'Co poniedzialek 09:30',
    // name — nazwa widoczna w edytorze n8n
    // Ważne: później można się do niej odwołać przez $('Nazwa') w innych nodach
    parameters: {
      // parameters — KLUCZOWE: wszystkie parametry specyficzne dla danego noda muszą być tutaj
      // W starym SDK pisano je na poziomie config — to już nie działa
      rule: {
        // rule — reguła harmonogramu, obiekt definiujący kiedy trigger ma wystartować
        interval: [{
          // interval — tablica interwałów (można zdefiniować wiele, my używamy jednego)
          field: 'weeks',
          // field — jednostka czasu: 'weeks' = tygodnie, 'days' = dni, 'hours' = godziny
          weeksInterval: 1,
          // weeksInterval — co 1 tydzień (gdyby było 2 = co 2 tygodnie)
          triggerAtDay: [1],
          // triggerAtDay — tablica dni: 0=niedziela, 1=poniedziałek, ...6=sobota
          // Działa tylko gdy field: 'weeks'
          triggerAtHour: 9,
          // triggerAtHour — godzina: 9 = 09:00
          triggerAtMinute: 30
          // triggerAtMinute — minuta: 30 → ostatecznie: poniedziałek 09:30
        }]
      }
    },
    position: [240, 300]
    // position — współrzędne [x, y] na wizualnym canvas n8n (tylko dla edytora)
  },
  output: [{}]
  // output — próbka danych wyjściowych: pusty obiekt, bo trigger zwraca różne pola czasowe
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
  rule: { ... }, // ❌ rule na poziomie config — nowe SDK tego nie akceptuje
}
```

```typescript
// NOWY SPOSÓB (poprawny):
config: {
  name: '...',
  parameters: { // ✅ wszystkie parametry noda muszą być w parameters
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

Ten 1 item trafia do następnego noda jako punkt wyjścia.

---

## 4. Node 2: HTTP Request — Pobierz top stories HN

### Kod

```typescript
// Definiujemy node HTTP Request do pobrania listy ID najgorętszych artykułów z HN
const fetchTopStories = node({
  // node() — funkcja SDK definiująca pojedynczy krok (node) w workflow
  type: 'n8n-nodes-base.httpRequest',
  // type — httpRequest = wbudowany node do wykonywania zapytań HTTP (GET, POST, itd.)
  // To najczęściej używany node w n8n — pozwala komunikować się z dowolnym REST API
  version: 4.4,
  // version — wersja 4.4 HTTP Request noda
  config: {
    name: 'Pobierz top stories HN',
    // name — nazwa noda w edytorze, używana później przez $('Nazwa') w wyrażeniach
    parameters: {
      // parameters — wszystkie ustawienia specyficzne dla HTTP Request noda
      method: 'GET',
      // method — GET = metoda tylko-do-odczytu (pobiera dane, nie modyfikuje)
      // Inne: POST (tworzy), PUT (aktualizuje), DELETE (usuwa), PATCH (modyfikuje)
      url: 'https://hacker-news.firebaseio.com/v0/topstories.json',
      // url — adres endpointu HN API na Firebase Realtime Database
      // firebaseio.com zamiast hacker-news.com: HN używa Firebase Google'a jako backendu
      // topstories.json zwraca tablicę 500 ID najgorętszych aktualnie artykułów
      authentication: 'none',
      // authentication — 'none' = HN API jest publiczne, nie wymaga klucza ani tokena
      options: {}
      // options — pusty obiekt = brak dodatkowych opcji (timeout, proxy, paginacja itp.)
    },
    alwaysOutputData: true,
    // alwaysOutputData — true = nawet jeśli API zwróci 0 wyników, wyślij 1 pusty item dalej
    // WAŻNE: bez tego, jeśli API zwróci pustą tablicę, cały workflow zostanie przerwany
    position: [480, 300]
    // position — pozycja na canvas: 480 = 240 (trigger) + 240 (odstęp między nodami)
  },
  output: [{ storyIds: [1, 2, 3] }]
  // output — próbka danych dla TypeScript (tylko typ, nie realne dane)
  // W rzeczywistości HN API zwraca gołą tablicę [123, 456, ...] a nie obiekt z polem
});
```

### Co robi?

Wykonuje zapytanie HTTP GET do API Hacker News i pobiera listę **500 ID najgorętszych artykułów**.

HN API (hostowane na Firebase Google'a) zwraca tablicę liczb:
```json
[48086190, 48085821, 48090521, ...]  // 500 ID — każdy to unikalny numer artykułu w HN
```

Ważne: n8n automatycznie **rozdziela tablicę** na osobne itemy. Z 1 odpowiedzi HTTP (która zwraca tablicę 500 elementów) n8n tworzy **500 osobnych itemów**, każdy zawierający jeden numer ID. To zachowanie jest domyślne dla HTTP Request node — tablica JSON → N itemów.

### alwaysOutputData — dlaczego to ważne?

W n8n, jeśli node zwróci **0 itemów**, cały dalszy łańcuch jest **przerywany**. Żaden następny node się nie wykona.

`alwaysOutputData: true` mówi: _"nawet jeśli nie ma danych, wyślij pusty item dalej, żeby workflow nie został przerwany"_.

To szczególnie ważne dla HTTP Requestów, które mogą czasem zwrócić pustą odpowiedź (np. gdy API jest tymczasowo niedostępne).

### Co wychodzi z tego noda?

500 itemów, każdy wygląda tak:
```json
{ "json": 48086190 }
//  ^^^^^^^^^^^^^^^^^^
//  $json to liczba (ID artykułu), a nie obiekt!
//  To ważne — przy następnym HTTP node URL będzie używał {{ $json }} bez żadnego klucza
```

Każdy item to jeden numer ID. Te ID trafiają do następnego noda.

---

## 5. Node 3: Limit

### Kod

```typescript
// Definiujemy node Limit — ogranicza liczbę przepływających itemów
const limitStories = node({
  // node() — tworzy nowy node w workflow
  type: 'n8n-nodes-base.limit',
  // type — 'limit' = wbudowany node do ograniczania liczby itemów
  // Działa jak "kran" — przepuszcza tylko określoną liczbę itemów dalej
  version: 1,
  // version — wersja 1 (prosty node, nie zmieniał się znacząco)
  config: {
    name: 'Pierwsze 30 ID',
    // name — czytelna nazwa: "weź tylko pierwsze 30 ID z 500"
    parameters: {
      maxItems: 30,
      // maxItems — maksymalnie 30 itemów, reszta (470) zostanie odrzucona
      // Dlaczego 30? Pobranie szczegółów 500 artykułów = 500 zapytań HTTP → za wolno
      // 30 to kompromis: wystarczająco dużo by znaleźć ciekawe artykuły
      keep: 'firstItems'
      // keep — 'firstItems' = zachowaj pierwsze N itemów (licząc od początku)
      // Alternatywa: 'lastItems' = zachowaj ostatnie N itemów
    },
    position: [720, 300]
    // position — 720 = trigger(240) + pierwszy HTTP(240) + limit(240)
  },
  output: [{ storyId: 0 }]
  // output — próbka danych dla TypeScript (tylko typ, nie realne dane)
});
```

### Co robi?

Bierze **pierwsze 30** z 500 itemów i resztę odrzuca. To prosty "kran" — ogranicza przepływ danych.

Dlaczego 30? Bo pobieranie szczegółów 500 artykułów byłoby za wolne (500 zapytań HTTP). 30 to rozsądny kompromis — wystarczająco dużo, żeby znaleźć ciekawe artykuły, ale nie za dużo, żeby workflow działał szybko.

### Co wychodzi?

30 itemów (pierwszych 30 ID z listy 500):
```json
{ "json": 48086190 }  // pierwsze ID z 500
{ "json": 48085821 }  // drugie ID
// ... 28 więcej
```

### Uwaga: typ `limit` vs `splitInBatches`

To jest zwykły node `limit`. Jest też node `splitInBatches`, który działa inaczej — dzieli itemy na grupy i przetwarza je partiami. My tego nie potrzebujemy, bo wszystkie 30 szczegółów możemy pobrać równolegle (jednocześnie).

---

## 6. Node 4: HTTP Request — Pobierz detale HN

### Kod

```typescript
// Definiujemy drugi HTTP Request — pobiera SZCZEGÓŁY dla każdego artykułu
const fetchStoryDetails = node({
  // node() — definiuje kolejny node w workflow
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Pobierz detale HN',
    // name — "pobierz szczegółowe dane o artykule z HN API"
    parameters: {
      method: 'GET',
      // GET — tylko odczyt, nie modyfikujemy danych na serwerze HN
      url: expr('https://hacker-news.firebaseio.com/v0/item/{{ $json }}.json'),
      // url — expr() tworzy wyrażenie {{ }} obliczane w czasie wykonania
      // $json to ID artykułu z poprzedniego noda (np. 48086190)
      // Dla każdego z 30 itemów URL będzie inny:
      //   Item 0: $json = 48086190 → URL = .../v0/item/48086190.json
      //   Item 1: $json = 48085821 → URL = .../v0/item/48085821.json
      // Dlaczego $json, a nie $json.id? Bo poprzedni node zwrócił gołą liczbę
      authentication: 'none',
      // authentication — 'none' = HN API jest publiczne
      options: {}
    },
    // Brak alwaysOutputData: true — jeśli API nie znajdzie artykułu, pomiń go
    position: [960, 300]
    // position — trigger(240) + pierwszy HTTP(240) + limit(240) + 240 = 960
  },
  output: [{ id: 1, title: '', by: '', score: 0, descendants: 0, url: '' }]
  // output — próbka pól zwracanych przez HN API dla pojedynczego artykułu:
  // id — unikalny numer, title — tytuł, by — autor, score — punkty
  // descendants — liczba komentarzy, url — link do oryginalnego artykułu
});
```

### Co robi?

Dla **każdego z 30 ID** wykonuje zapytanie do HN API, żeby pobrać szczegóły artykułu. Ponieważ mamy 30 itemów wchodzących, node wykonuje się **30 razy** — raz dla każdego itemu.

To jest kluczowa koncepcja: **jeśli do noda wchodzi N itemów, node wykona się N razy** (chyba że ma `executeOnce: true` albo `mode: runOnceForAllItems`).

### Wyrażenia — `expr()` i `{{ }}`

```typescript
url: expr('https://hacker-news.firebaseio.com/v0/item/{{ $json }}.json')
//         ^^^^^^^                                                      ^
//         expr() zamienia string na wyrażenie n8n: wszystko między {{ }} zostanie obliczone
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
  "id": 48086190,              // unikalne ID artykułu
  "title": "Hardware Attestation as Monopoly Enabler",  // tytuł
  "by": "ChuckMcM",            // autor na HN
  "score": 1317,               // liczba punktów (głosów)
  "descendants": 436,          // liczba komentarzy w dyskusji
  "url": "https://grapheneos.social/...",  // link do artykułu (może być pusty dla "Ask HN")
  "type": "story",             // typ: "story" (zwykły link), "job" (oferta pracy), "ask" (pytanie)
  "time": 1778435642,          // timestamp UNIX (sekundy od 1970)
  "kids": [...]                // tablica ID komentarzy (nieużywana w tym workflow)
}
```

### Co wychodzi?

30 itemów, każdy to szczegóły jednego artykułu:
```json
{ "json": { "id": 48086190, "title": "...", "by": "...", "score": 1317, "descendants": 436, "url": "..." } }
{ "json": { "id": 48085821, "title": "...", "by": "...", "score": 42, "descendants": 5, "url": "..." } }
// ... 28 więcej — każdy to pełny obiekt z danymi artykułu
```

---

## 7. Node 5: Code — Filtruj i ranking

### Kod — definicja noda

```typescript
// Definiujemy Code node — SERCE workflow, tu odbywa się filtrowanie i ranking
const filterAndRank = node({
  // node() — Code node pozwala napisać własny JavaScript do transformacji danych
  type: 'n8n-nodes-base.code',
  // type — 'code' = wbudowany node do wykonywania kodu JavaScript
  // Używamy go, gdy gotowe nody (Filter, Sort) nie dają wystarczającej kontroli
  version: 2,
  // version — wersja 2 Code noda (wersja 1 miała inny format parametrów)
  config: {
    name: 'Filtruj i ranking',
    parameters: {
      mode: 'runOnceForAllItems',
      // mode — 'runOnceForAllItems' = wykonaj kod JEDEN raz z dostępem do WSZYSTKICH 30 itemów
      // Domyślnie Code node wykonuje się raz na każdy item (runOnceForEachItem)
      // My chcemy przefiltrować i posortować wszystkie 30 naraz — stąd ta opcja
      language: 'javaScript',
      // language — jedyna dostępna opcja: 'javaScript'
      jsCode: `
        //[JAVASCRIPT - ANALIZA W OSOBNEJ SEKCJI PONIŻEJ]
      `
      // jsCode — właściwy kod JavaScript w formie stringa (template literal z backtickami)
      // n8n używa silnika V8 w trybie sandbox — ograniczony dostęp do API systemowych
    },
    position: [1200, 300]
  },
  output: [{ title: '', url: '', score: 0, author: '', comments: 0 }]
  // output — próbka: ten node zwróci 5 itemów, każdy z polami:
  // title — tytuł (EN, oryginalny), url — link, score — punkty
  // author — autor, comments — liczba komentarzy
});
```

### Kod JavaScript — analiza linijka po linijce

```javascript
// ===== INICJALIZACJA SŁÓW KLUCZOWYCH =====
var keywords = ['opencode', 'openrouter', 'openai', 'codex', 'gemini',
  // Lista słów/fraz które muszą wystąpić w tytule, żeby artykuł został zakwalifikowany
  // 'opencode' — narzędzie AI do pisania kodu (to co aktualnie używasz)
  'stape_io', 'n8n', 'cursor', 'copilot', 'claude', 'llm',
  // stape.io  n8n(twój workflow automation)  Cursor(AI editor)  GitHub Copilot(AI pair programming)
  // Claude(AI chat)  large language model
  'gpt', 'agent', 'mcp', 'aider', 'devin', 'langchain',
  // GPT(OpenAI)  AI Agent  MCP(Model Context Protocol)  Aider(AI dev tool)
  // Devin(AI dev tool)  LangChain(framework LLM)
  'llama', 'mistral', 'perplexity', 'vibe coding',
  // LLaMa(Meta)  Mistral(AI model)  Perplexity(AI search)  "vibe coding"(trend w AI)
  'windsurf', 'bolt.new', 'lovable'];
  // Windsurf(AI IDE)  bolt.new(AI app builder)  Lovable(AI app builder)

// ===== POBIERANIE DANYCH WEJŚCIOWYCH =====
var stories = $input.all().map(function(item) { return item.json; });
// $input.all() — zwraca WSZYSTKIE 30 itemów z poprzedzającego noda "Pobierz detale HN"
// .map(function(item) { return item.json; }) — wyciąga właściwe dane spod klucza .json
// Struktura itemu w n8n: { json: { ... }, binary?: ..., pairedItem?: ... }
// Nas interesuje tylko .json — reszta to metadane n8n
// Wynik: tablica 30 obiektów { id, title, by, score, descendants, url, ... }

// ===== FILTROWANIE PO SŁOWACH KLUCZOWYCH =====
var filtered = [];
// Inicjalizujemy pustą tablicę — tu trafią artykuły które przeszły filtr
for (var s = 0; s < stories.length; s++) {
  // Pętla po wszystkich 30 artykułach (s = index od 0 do 29)
  var title = (stories[s].title || '').toLowerCase();
  // Pobieramy tytuł artykułu; jeśli brak tytułu → użyj pustego stringa
  // .toLowerCase() — zamieniamy na małe litery, żeby porównanie było case-insensitive
  for (var k = 0; k < keywords.length; k++) {
    // Pętla wewnętrzna po wszystkich słowach kluczowych — sprawdzamy każde po kolei
    if (title.indexOf(keywords[k].toLowerCase()) !== -1) {
      // indexOf() zwraca pozycję słowa w tytule, lub -1 jeśli nie znaleziono
      // !== -1 znaczy "słowo znalezione w tytule"
      // keywords[k].toLowerCase() — słowo kluczowe też zamieniamy na małe litery
      filtered.push(stories[s]);
      // Jeśli znaleziono — dodaj cały artykuł do tablicy filtered
      break;
      // Przerwij wewnętrzną pętlę (wystarczy że JEDNO słowo pasuje)
    }
  }
}
// Po tej pętli filtered zawiera tylko artykuły które mają w tytule któreś ze słów kluczowych

// ===== SORTOWANIE PO PUNKTACH (malejąco) =====
filtered.sort(function(a, b) { return (b.score || 0) - (a.score || 0); });
// sort() z funkcją porównującą: sortowanie MALEJĄCO po liczbie punktów
// Jeśli wynik > 0: b będzie przed a (b.score > a.score → b ma wyższy score)
// Jeśli wynik < 0: a będzie przed b
// Jeśli wynik = 0: kolejność bez zmian
// (b.score || 0) — zabezpieczenie: jeśli brak score, przyjmij 0

var top5 = filtered.slice(0, 5);
// .slice(0, 5) — weź pierwsze 5 elementów z posortowanej tablicy (top 5)
// Jeśli filtered ma mniej niż 5 elementów, weź tyle ile jest

// ===== FORMATOWANIE WYNIKU =====
var result = [];
// Inicjalizujemy pustą tablicę — tu trafią sformatowane obiekty wyjściowe
for (var t = 0; t < top5.length; t++) {
  // Pętla po top 5 artykułach
  result.push({
    // Dodajemy nowy obiekt do tablicy wynikowej
    json: {
      // json — KLUCZOWE: n8n wymaga struktury { json: { ... } }
      // Każdy obiekt zwracany przez Code node MUSI mieć pole .json
      title: top5[t].title,
      // title — oryginalny tytuł artykułu (EN)
      url: top5[t].url || 'https://news.ycombinator.com/item?id=' + top5[t].id,
      // url — link do artykułu; jeśli HN nie ma URL-a, zbuduj link do HN discussion używając ID
      score: top5[t].score || 0,
      // score — liczba punktów (głosów społeczności), domyślnie 0 jeśli brak
      author: top5[t].by || 'unknown',
      // author — autor (pole z HN API to 'by'), domyślnie 'unknown' jeśli brak
      comments: top5[t].descendants || 0
      // comments — liczba komentarzy (pole z HN API to 'descendants'), domyślnie 0
    }
  });
}
return result;
// n8n oczekuje, że Code node zwróci TABLICĘ obiektów { json: { ... } }
// Każdy element tablicy stanie się osobnym itemem na wyjściu — w tym przypadku 5 itemów
```

### mode: runOnceForAllItems — dlaczego?

```typescript
mode: 'runOnceForAllItems'
```

Domyślnie Code node wykonuje się **raz na każdy item** (jak HTTP Request powyżej). Ale tu chcemy przetworzyć **wszystkie 30 artykułów naraz** — dlatego używamy `runOnceForAllItems`.

- `runOnceForEachItem` (domyślny bez podania mode) — kod wykonuje się N razy, raz na każdy wchodzący item. `$input.all()` zwraca tylko 1 item.
- `runOnceForAllItems` — kod wykonuje się **1 raz** dla wszystkich itemów naraz. `$input.all()` zwraca tablicę wszystkich itemów.

### $input.all() vs $input.first()

- `$input.all()` — zwraca **wszystkie** itemy z poprzedniego noda (tablica)
- `$input.first()` — zwraca **tylko pierwszy** item z poprzedniego noda
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
// Definiujemy trzeci HTTP Request — tym razem do MyMemory API (darmowe API tłumaczeniowe)
const translateTitle = node({
  // node() — tworzy nowy node
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Tlumacz tytul',
    // name — nazwa z polskim "ł" — n8n obsługuje Unicode w nazwach nodów
    parameters: {
      method: 'GET',
      // GET — MyMemory API przyjmuje parametry w URL (query string), nie w body
      url: expr('https://api.mymemory.translated.net/get?q={{ encodeURIComponent($json.title) }}&langpair=en|pl'),
      // url — MyMemory to darmowe API tłumaczeniowe, ~5000 znaków/dzień w darmowym tierze
      // q=... — tekst do tłumaczenia, URL-encoded (encodeURIComponent zamienia spacje na %20)
      // $json.title — pole title z bieżącego itemu (1 z 5 artykułów)
      // langpair=en|pl — z angielskiego (en) na polski (pl)
      // encodeURIComponent jest WAŻNY — tytuły mogą zawierać spacje i znaki specjalne
      authentication: 'none',
      // authentication — MyMemory API w darmowym tierze jest publiczne
      options: {}
    },
    position: [1440, 300]
    // position — po Code node "Filtruj i ranking" (1200+240)
  },
  output: [{ responseData: { translatedText: '', match: 0 } }]
  // output — próbka odpowiedzi MyMemory API:
  // responseData.translatedText — przetłumaczony tekst
  // responseData.match — poziom dopasowania (0.0 do 1.0)
  // responseStatus — kod statusu (200 = OK)
});
```

### Co robi?

Dla każdego z 5 artykułów wywołuje **MyMemory API** — darmowe API tłumaczeniowe z ogromną bazą pamięci tłumaczeniowej (TM). Tłumaczy tytuł z angielskiego na polski.

Ponieważ wchodzi 5 itemów, node wykonuje się **5 razy** — każde wywołanie tłumaczy inny tytuł.

### Wyrażenie URL

```
https://api.mymemory.translated.net/get
  ?q={{ encodeURIComponent($json.title) }}
  &langpair=en|pl
```

- `q` — tekst do tłumaczenia (zakodowany URL-encoding)
- `langpair=en|pl` — z angielskiego na polski (ISO 639-1)
- `encodeURIComponent()` — funkcja JS: spacja → `%20`, cudzysłów → `%22` itp.
- `$json.title` — tytuł artykułu z poprzedniego noda (pole `title`)

**$json** — w tym momencie `$json` to obiekt `{ title: "An AI coding agent...", url: "...", score: 122, ... }` (bo wchodzą itemy z noda "Filtruj i ranking"). Dlatego `$json.title` działa.

### Co zwraca MyMemory API?

```json
{
  "responseData": {
    "translatedText": "Agent kodujący sztuczną inteligencję...",
    "match": 0.85                    // 0.85 = 85% pewności tłumaczenia
  },
  "responseStatus": 200,             // 200 = OK
  "matches": [ ... ]                 // inne możliwe tłumaczenia (nie używamy)
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

### Kod — definicja noda

```typescript
// Definiujemy drugi Code node — łączy oryginalne dane z tłumaczeniami
const formatResults = node({
  // node() — tworzy Code node do transformacji danych
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Formatuj wyniki',
    parameters: {
      mode: 'runOnceForAllItems',
      // mode — 'runOnceForAllItems' = chcemy widzieć wszystkie 5 itemów naraz
      language: 'javaScript',
      jsCode: `
        //[JAVASCRIPT - ANALIZA W OSOBNEJ SEKCJI PONIŻEJ]
      `
      // jsCode — kod JavaScript do łączenia danych z dwóch źródeł
    },
    position: [1680, 300]
    // position — po "Tlumacz tytul" (1440+240)
  },
  output: [{ tytul_pl: '', tytul_en: '', url: '', punkty: 0, autor: '', komentarze: 0, data: '' }]
  // output — STRUKTURA DOCELOWA dla Data Table:
  // tytul_pl — przetłumaczony tytuł (PL)
  // tytul_en — oryginalny tytuł (EN)
  // url — link do artykułu
  // punkty — liczba punktów
  // autor — autor artykułu
  // komentarze — liczba komentarzy
  // data — data przetworzenia (YYYY-MM-DD)
});
```

### Kod JavaScript — analiza linijka po linijce

```javascript
// ===== POBIERANIE TŁUMACZEŃ (dane z bezpośredniego poprzednika) =====
var translations = $input.all().map(function(i) { return i.json; });
// $input.all() — dane z bezpośrednio poprzedzającego noda = "Tlumacz tytul"
// Zwraca 5 itemów, każdy z odpowiedzią MyMemory API
// .map(i => i.json) wyciąga z każdego .json — czyli właściwą odpowiedź API

// ===== POBIERANIE ORYGINAŁÓW (dane z wcześniejszego noda "Filtruj i ranking") =====
var originals = $('Filtruj i ranking').all().map(function(i) { return i.json; });
// $('NazwaNoda') — specjalna funkcja n8n do sięgania do danych Z DOWOLNEGO wcześniejszego noda
// To BARDZO ważna koncepcja: nawet po 2 kolejnych nodach (tłumaczenie, formatowanie)
// wciąż mamy dostęp do oryginalnych danych z "Filtruj i ranking"
// $('Filtruj i ranking').all() — zwraca WSZYSTKIE 5 itemów z tamtego noda

// ===== ŁĄCZENIE DANYCH PO INDEKSIE =====
var result = [];
// Inicjalizujemy pustą tablicę wynikową
for (var idx = 0; idx < originals.length; idx++) {
  // Pętla po 5 oryginalnych artykułach (indeksy 0-4)
  var orig = originals[idx];
  // orig — dane oryginalnego artykułu z "Filtruj i ranking"
  var trans = translations[idx] || {};
  // trans — odpowiadające tłumaczenie z "Tlumacz tytul" (zakładamy tę samą kolejność)
  // || {} — zabezpieczenie: jeśli brak tłumaczenia dla tego indeksu, użyj pustego obiektu

  var translatedText = (trans.responseData && trans.responseData.translatedText) || orig.title;
  // Jeśli MyMemory zwrócił poprawną odpowiedź (responseData.translatedText istnieje)
  // → użyj przetłumaczonego tekstu
  // W przeciwnym razie (błąd sieci, limit API) → użyj oryginalnego tytułu (fallback)
  // trans.responseData && trans.responseData.translatedText — krótkie spięcie (short-circuit):
  // jeśli responseData jest null/undefined, wyrażenie nie idzie dalej, nie rzuca błędu
  // || orig.title — fallback: jeśli lewa strona jest pusta/null, użyj oryginalnego tytułu

  // ===== TWORZENIE STRUKTURY DOCELOWEJ =====
  result.push({
    // Dodajemy nowy obiekt do tablicy wynikowej
    json: {
      // json — zgodnie z wymogami n8n: każdy zwracany element musi mieć .json
      tytul_pl: translatedText,
      // tytul_pl — przetłumaczony tytuł (pasuje do kolumny Data Table "tytul_pl")
      tytul_en: orig.title,
      // tytul_en — oryginalny tytuł (pasuje do kolumny "tytul_en")
      url: orig.url || 'https://news.ycombinator.com/item?id=' + orig.id,
      // url — link do artykułu z fallbackiem do HN discussion jeśli brak URL
      punkty: orig.score || 0,
      // punkty — liczba punktów (pasuje do kolumny "punkty")
      autor: orig.author || 'unknown',
      // autor — autor (pasuje do kolumny "autor")
      komentarze: orig.comments || 0,
      // komentarze — liczba komentarzy (pasuje do kolumny "komentarze")
      data: new Date().toISOString().split('T')[0]
      // data — dzisiejsza data w formacie YYYY-MM-DD
      // new Date() — aktualny czas
      // .toISOString() → "2026-05-11T07:09:17.608Z"
      // .split('T')[0] → "2026-05-11" (część przed T = sama data)
    }
  });
}
return result;
// Zwraca 5 itemów w strukturze gotowej do Data Table (7 pól, polskie nazwy kolumn)
```

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

Zakładamy, że itemy są w tej samej kolejności. `translations[0]` odpowiada `originals[0]` — to działa bo nody są połączone liniowo i itemy zachowują kolejność (pierwszy w → pierwszy out).

### Fallback dla tłumaczenia

```javascript
var translatedText = (trans.responseData && trans.responseData.translatedText) || orig.title;
```

Jeśli MyMemory API nie zwróciło tłumaczenia (np. błąd sieci, limit API), używamy oryginalnego tytułu. To **fallback** — zabezpieczenie przed błędami. Bez tego moglibyśmy dostać `undefined` jako tytuł w tabeli.

### Dlaczego polskie nazwy pól?

Tabela w n8n ma kolumny z polskimi nazwami (`tytul_pl`, `punkty`, `autor`, itd.). Node mapuje angielskie pola z HN na polskie nazwy kolumn, żeby `autoMapInputData` (w następnym nodzie) automatycznie dopasował je do kolumn.

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
// Definiujemy ostatni node — zapisuje dane do wbudowanej tabeli n8n (Data Table)
const saveToTable = node({
  // node() — tworzy node Data Table do zapisu danych
  type: 'n8n-nodes-base.dataTable',
  // type — 'dataTable' = node do zapisu/odczytu danych w tabelach n8n (wbudowana baza)
  // To jest odpowiednik prostej bazy SQL — przechowuje dane między uruchomieniami
  version: 1.1,
  // version — wersja 1.1 Data Table noda (dodała m.in. operacje insert/update/upsert)
  config: {
    name: 'Zapisz do tabeli',
    parameters: {
      resource: 'row',
      // resource — 'row' = pracujemy na POJEDYNCZYCH WIERSZACH tabeli
      // Alternatywa: 'table' = operacje na całej tabeli (create, delete, list)
      operation: 'insert',
      // operation — 'insert' = wstaw NOWY wiersz do tabeli
      // Inne: 'get' (odczytaj), 'update' (aktualizuj), 'deleteRows' (usuń)
      dataTableId: {
        // dataTableId — resource locator: sposób identyfikacji tabeli
        mode: 'id',
        // mode — 'id' = identyfikuj tabelę po jej unikalnym ID
        value: 'Iy9nbjya69dnFGOf'
        // value — ID tabeli "HN Top 5 - Artykuly" (wygenerowane przy tworzeniu tabeli)
      },
      columns: {
        // columns — KONFIGURACJA MAPOWANIA (najważniejszy i najtrudniejszy parametr!)
        mappingMode: 'autoMapInputData',
        // mappingMode — 'autoMapInputData' = automatycznie dopasuj pola z itemów
        // do kolumn tabeli o tych samych nazwach
        // DZIAŁA tylko gdy nazwy pól ($json.tytul_pl, $json.tytul_en, ...)
        // DOKŁADNIE odpowiadają nazwom kolumn w tabeli
        value: null
        // value — null bo autoMapInputData nie potrzebuje dodatkowej konfiguracji
      },
      options: {}
      // options — puste opcje
    },
    position: [1920, 300]
    // position — ostatni node: 8 × 240px od triggera
  },
  output: [{ tytul_pl: '', tytul_en: '', url: '', punkty: 0, autor: '',
             komentarze: 0, data: '', id: 1, createdAt: '2026-05-10' }]
  // output — wszystkie kolumny tabeli + automatyczne pola id, createdAt, updatedAt
});
```

### Co robi?

Zapisuje każdy z 5 itemów jako **nowy wiersz** w Data Table o nazwie "HN Top 5 - Artykuly".

### dataTableId — Resource Locator

```typescript
dataTableId: { mode: 'id', value: 'Iy9nbjya69dnFGOf' }
```

To jest **resource locator** — specjalny typ parametru w n8n do identyfikacji zasobów. Możliwe tryby:
- `mode: 'id'` — po ID tabeli (używamy tego — najprostszy i najpewniejszy)
- `mode: 'name'` — po nazwie tabeli (ale nazwa może się zmienić)
- `mode: 'list'` — z listy rozwijanej (wymaga interakcji użytkownika, nie działa w SDK)

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
    { column: 'tytul_pl' },     // mapuje pole tytul_pl → kolumna tytul_pl
    { column: 'tytul_en' },     // mapuje pole tytul_en → kolumna tytul_en
    // ...
  ]
}
```

### Dlaczego `autoMapInputData` a nie `defineBelow`?

Początkowo próbowaliśmy `defineBelow` z różnymi formatami, ale:
- Obiekty `{ column: 'tytul_pl' }` dawały błąd **"unexpected object input"** — node interpretował obiekty jako wartości do wstawienia, a nie specyfikację mapowania
- Tablica stringów `['tytul_pl', ...]` dawała **"unknown column name '0'"** — node używał indeksów tablicy (0, 1, 2...) jako nazw kolumn
- Brak `columns` powodował **"Cannot convert undefined or null to object"** — node próbował parsować niezdefiniowaną wartość

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
    "tytul_pl": "Agent kodujący...",    // wstawiona wartość
    "tytul_en": "An AI coding agent...", // wstawiona wartość
    "url": "https://...",
    "punkty": 122,
    "autor": "cratermoon",
    "komentarze": 29,
    "data": "2026-05-11",
    "id": 1,                            // auto-generowane przez Data Table
    "createdAt": "2026-05-11T07:09:17.608Z",  // auto-generowane — timestamp utworzenia
    "updatedAt": "2026-05-11T07:09:17.608Z"   // auto-generowane — timestamp ostatniej modyfikacji
  }
}
```

`id`, `createdAt`, `updatedAt` są generowane automatycznie przez Data Table przy każdym insert.

---

## 11. Workflow composition

### Jak SDK łączy nody?

```typescript
export default workflow('hn-top5-monday', 'HN Top 5 - poniedzialek 09:30')
//                      ^^^^^^^^^^^^^^^^  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//                      ID workflow (unikalne w instancji)  nazwa wyświetlana w edytorze
  .add(scheduleTrigger) // .add() = START — dodaje pierwszy (trigger) node do workflow
  .to(fetchTopStories) // .to() = połącz scheduleTrigger → fetchTopStories (strzałka w edytorze)
  .to(limitStories) // .to() = połącz fetchTopStories → limitStories
  .to(fetchStoryDetails) // .to() = połącz limitStories → fetchStoryDetails (ID → szczegóły)
  .to(filterAndRank) // .to() = połącz fetchStoryDetails → filterAndRank (30 → 5)
  .to(translateTitle) // .to() = połącz filterAndRank → translateTitle (tłumacz 5 tytułów)
  .to(formatResults) // .to() = połącz translateTitle → formatResults (połącz dane)
  .to(saveToTable); // .to() = połącz formatResults → saveToTable (zapisz do tabeli — KONIEC)
```

### workflow(id, name)

- Pierwszy argument: **ID workflow** (`'hn-top5-monday'`) — unikalny identyfikator w obrębie instancji n8n. Używany w URL i do identyfikacji workflow. Bez znaków specjalnych, najlepiej z myślnikami.
- Drugi argument: **Nazwa** (`'HN Top 5 - poniedzialek 09:30'`) — wyświetlana w edytorze n8n, na liście workflowów i w powiadomieniach. Może zawierać polskie znaki i spacje.

### .add() vs .to()

- `.add(node)` — dodaje pierwszy node do workflow (zazwyczaj trigger). **Tylko pierwszy node** używa .add(), reszta używa .to().
- `.to(nextNode)` — łączy poprzedni node z następnym (tworzy połączenie/strzałkę w edytorze)

Dla rozgałęzień używa się `.add()` wielokrotnie:

```typescript
export default workflow('id', 'name')
  .add(triggerNode) // START → trigger
  .to(sharedNode) // trigger → sharedNode
  .add(triggerNode) // DRUGI START (ten sam trigger)
  .to(branchNode.to(mergeNode.input(0))) // trigger → branchNode → merge.input(0)
  .add(mergeNode) // dodaj merge po zdefiniowaniu obu gałęzi
  .to(finalNode); // merge → finalNode
```

### Pozycje na canvas

```typescript
position: [240, 300]
```

Każdy node ma pozycję na wizualnym canvas n8n. `[x, y]`:
- `x` — odległość od lewej krawędzi (każdy node ~240px w prawo)
- `y` — odległość od góry (zazwyczaj stała: 300)

To nie wpływa na działanie, tylko na wygląd w edytorze. Można ustawić dowolne wartości.

---

## 12. Kluczowe koncepcje n8n

### Item

**Item** to podstawowa jednostka danych w n8n. Każdy node przyjmuje tablicę itemów na wejściu i zwraca tablicę itemów na wyjściu.

Item ma strukturę:
```typescript
{
  json: { ... },          // właściwe dane (obiekt JSON) — to jest to co widzisz w $json
  binary?: { ... },       // dane binarne (pliki, obrazy, PDF) — opcjonalne, nie używamy tego
  pairedItem?: { ... }    // informacja o powiązaniu z itemem wejściowym (dla śledzenia pochodzenia)
}
```

### Jak zmienia się liczba itemów?

| Node | Wejście | Wyjście | Operacja |
|---|---|---|---|
| Schedule Trigger | — | 1 item | Trigger zawsze produkuje 1 item |
| HTTP (topstories) | 1 | 500 | n8n rozdziela TABLICĘ JSON [1,2,3...] na 500 osobnych itemów |
| Limit | 500 | 30 | Odrzuca 470 itemów — zostawia tylko pierwsze 30 |
| HTTP (detale) | 30 | 30 | Każdy item → osobne zapytanie HTTP (30 razy!) |
| Code (filtr) | 30 | 5 | Kod redukuje z 30 do 5 po filtrze i sortowaniu |
| HTTP (tlumacz) | 5 | 5 | Każdy item → osobne zapytanie HTTP (5 razy) |
| Code (format) | 5 | 5 | Kod transformuje dane (zmienia strukturę) |
| Data Table | 5 | 5 | Każdy item → osobny wiersz w tabeli |

**Wniosek**: zawsze śledź ile itemów przepływa przez workflow. To klucz do zrozumienia dlaczego niektóre nody wykonują się wiele razy (np. HTTP details × 30).

### $json, $input, $('NodeName')

| Zmienna | Znaczenie |
|---|---|
| `$json` | Zawartość JSON bieżącego itemu. W Code node: pojedynczy obiekt. |
| `$input.all()` | Wszystkie itemy z **bezpośrednio poprzedzającego** noda (tablica) |
| `$input.first()` | Tylko **pierwszy** item z poprzedzającego noda |
| `$input.item` | Bieżący item (gdy `mode: runOnceForEachItem`) |
| `$('NazwaNoda')` | Dostęp do danych z **dowolnego wcześniejszego** noda po jego **nazwie** |
| `$('NazwaNoda').all()` | Wszystkie itemy z danego noda |
| `$('NazwaNoda').first()` | Pierwszy item z danego noda |
| `$now` / `$today` | Aktualna data/czas (obiekt Luxon DateTime — biblioteka dat w JS) |
| `$itemIndex` | Indeks bieżącego itemu (0-based — pierwszy item ma indeks 0) |
| `$execution.id` | ID bieżącego wykonania (unikalne dla każdego uruchomienia workflow) |

### Wyrażenia — expr()

`expr()` tworzy składnię `{{ }}` w n8n. W tej składni można używać zmiennych i wyrażeń JavaScript:

```typescript
// Proste podstawienie — $json.name zostanie zastąpione wartością pola 'name'
expr('Hello {{ $json.name }}')
// Przykład: jeśli $json.name = "Jan", wynik = "Hello Jan"

// Wywołanie funkcji Luxon na $now — formatuje datę
expr('Report for {{ $now.toFormat("MMMM d, yyyy") }}')
// $now.toFormat() to metoda Luxon DateTime
// Przykład: "Report for May 11, 2026"

// Ternary (warunek) w wyrażeniu
expr('Status: {{ $json.count > 0 ? "active" : "empty" }}')
// Jeśli count > 0 → "active", inaczej → "empty"

// URL z dynamicznym ID — nasz przypadek z HN
expr('https://api.example.com/item/{{ $json }}.json')
// $json to goła liczba (ID), np. 48086190 → https://api.example.com/item/48086190.json
```

**Ważne**: `$json`, `$now`, `$()` itp. muszą być WEWNĄTRZ `{{ }}`, nigdy na zewnątrz:

```typescript
// ❌ ŹLE — $now poza {{ }}, przez co nie zostanie obliczone w kontekście n8n
expr('Daily Digest - ' + $now.toFormat('MMMM d'))

// ✅ DOBRZE — wszystko w {{ }}, n8n poprawnie obliczy wyrażenie
expr('Daily Digest - {{ $now.toFormat("MMMM d") }}')
```

### mode w Code node

```typescript
parameters: {
  mode: 'runOnceForAllItems'  // lub 'runOnceForEachItem'
}
```

- `runOnceForEachItem` (domyślny bez podania mode) — kod wykonuje się raz na każdy item. W kodzie `$input.all()` zwraca jeden item.
- `runOnceForAllItems` — kod wykonuje się raz dla wszystkich itemów (łącznie). W kodzie `$input.all()` zwraca wszystkie itemy jako tablicę.

### alwaysOutputData

```typescript
config: {
  alwaysOutputData: true,
}
```

Gdy node zwróci 0 itemów, workflow zostaje przerwany. `alwaysOutputData: true` zapobiega temu — jeśli nie ma prawdziwych danych, node zwraca 1 pusty item (z `{}` jako json). Przydatne dla HTTP Requestów które mogą zwrócić pustą odpowiedź.

### Stare vs nowe SDK — kluczowe różnice

| Aspekt | Stare SDK (wersja 1.x) | Nowe SDK (wersja 2.x) |
|---|---|---|
| Parametry | Bezpośrednio w `config` | W `config.parameters` |
| Code node | `code` (string), `executeOnce: true` | `jsCode` (string), `mode: 'runOnceForAllItems'` |
| Wyrażenia | Bezpośrednio w stringu URL-a | Poprzez `expr('url {{ }}')` |
| Trigger | `rule` w `config` | `rule` w `parameters` |

---

## 13. Lessons Learned

### 1. "Cannot convert undefined or null to object"

**Problem**: Data Table node nie miał parametru `columns`.

**Przyczyna**: Bez `columns`, node próbuje parsować niezdefiniowaną wartość, co powoduje błąd JavaScript `Object.keys(null)`.

**Rozwiązanie**: Dodaj `columns: { mappingMode: 'autoMapInputData', value: null }`.

### 2. "Must be an n8n expression"

**Problem**: Próbowaliśmy przekazać `columns` jako zwykły string JSON (`'{"mappingMode":...}'`).

**Przyczyna**: Node oczekiwał, że `columns` będzie obiektem JavaScript, a nie stringiem.

**Rozwiązanie**: Przekaż jako obiekt, nie string.

### 3. "unexpected object input"

**Problem**: `columns.value` jako tablica obiektów `[{column: "tytul_pl"}]`.

**Przyczyna**: Node interpretował obiekty `{column: "tytul_pl"}` jako wartości do wstawienia do bazy danych, a nie jako specyfikację mapowania.

**Rozwiązanie**: Użyj `autoMapInputData` zamiast ręcznego mapowania `defineBelow`.

### 4. Parametry w `config` vs `parameters`

**Problem**: Stary kod miał `method`, `url` bezpośrednio w `config` (obok `name`, `position`).

**Przyczyna**: Starsza wersja SDK akceptowała ten format, nowsza wymaga `parameters`.

**Rozwiązanie**: Umieść wszystko w `parameters: { method, url, ... }`.

### 5. $http w Code node vs osobny HTTP Request node

**Problem**: Kod w Code node używał `$http.get()` do wywołań HTTP (w oryginalnej wersji workflow).

**Przyczyna**: `$http` jest dostępny w Code node, ale miesza logikę — kod i komunikacja sieciowa w jednym miejscu. Ciężko debugować, testować i modyfikować.

**Rozwiązanie**: Użyj osobnego HTTP Request noda dla każdego wywołania API — to czystsze, łatwiejsze do debugowania i pozwala korzystać z wbudowanych opcji (paginacja, batching, timeout).

### 6. executeOnce vs mode

**Problem**: Stary kod używał `executeOnce: true` w Code node.

**Przyczyna**: `executeOnce` to stary mechanizm (SDK v1) na jednokrotne wykonanie noda. Nowe SDK (v2) używa `mode`.

**Rozwiązanie**: `mode: 'runOnceForAllItems'` zamiast `executeOnce: true`.

### 7. rule w trigger

**Problem**: `rule` był na poziomie `config` zamiast w `parameters`.

**Przyczyna**: Trigger to też node — jego parametry też muszą być w `parameters` (zasada nowego SDK).

**Rozwiązanie**: `config: { parameters: { rule: { ... } } }`.

---

## Dodatek: Przydatne materiały

- [n8n Documentation](https://docs.n8n.io/)
- [n8n MCP Server Docs](https://docs.n8n.io/advanced-ai/mcp/accessing-n8n-mcp-server/)
- [HN API Documentation](https://github.com/HackerNews/API) — Firebase Realtime Database, publiczne API
- [MyMemory API](https://mymemory.translated.net/doc/spec.php) — darmowe API tłumaczeniowe
- [Firebase Realtime Database](https://firebase.google.com/docs/database) — baza danych Google, na której hostowane jest HN API
