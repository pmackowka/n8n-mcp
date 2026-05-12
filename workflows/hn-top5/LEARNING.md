# Understanding the HN Top 5 Workflow

## Spis treści

1. [Overview](#1-overview)
2. [n8n Workflow SDK](#2-n8n-workflow-sdk)
3. [Node 1: Schedule Trigger — harmonogram](#3-node-1-schedule-trigger)
4. [Node 2: HTTP Request — lista ID z HN](#4-node-2-http-request)
5. [Node 3: Limit — pierwsze 30](#5-node-3-limit)
6. [Node 4: HTTP Request — szczegóły artykułów](#6-node-4-http-request)
7. [Node 5: Code — filtrowanie i ranking](#7-node-5-code)
8. [Node 6: HTTP Request — tłumaczenie](#8-node-6-http-request)
9. [Node 7: Code — formatowanie danych](#9-node-7-code)
10. [Node 8: Data Table — zapis danych](#10-node-8-data-table)
11. [Workflow composition — łączenie nodów](#11-workflow-composition)
12. [Kluczowe koncepcje n8n](#12-kluczowe-koncepcje-n8n)
13. [Lessons Learned](#13-lessons-learned)

---

## 1. Overview

Workflow uruchamia się w każdy poniedziałek o 09:30. Łączy się z Hacker News, pobiera 500 najgorętszych artykułów, filtruje po słowach kluczowych AI/dev, wybiera top 5, tłumaczy tytuły na polski i zapisuje do tabeli.

Przepływ danych:

```
Trigger (poniedziałek 09:30) → HTTP (pobierz 500 ID) → Limit (pierwsze 30)
→ HTTP (szczegóły 30 artykułów) → Code (filtruj po słowach kluczowych → top 5)
→ HTTP (tłumacz tytuły × 5) → Code (formatuj) → Data Table (zapisz)
```

Kluczowa koncepcja: każdy node zmienia liczbę przepływających **itemów**. Na początku mamy 1 item (trigger), potem 500 (bo HN zwraca tablicę), potem 30, potem 5 — śledzenie liczby itemów to klucz do projektowania workflow w n8n.

---

## 2. n8n Workflow SDK

Workflow pisany jest w TypeScript przy użyciu **n8n Workflow SDK**. Definiujemy nody w kodzie zamiast klikać w interfejsie.

Główne funkcje SDK:

| Funkcja | Zastosowanie |
|---|---|
| `trigger()` | Definiuje trigger (co uruchamia workflow) |
| `node()` | Definiuje pojedynczy node (krok) |
| `expr()` | Tworzy wyrażenie `{{ }}` do dynamicznych wartości |
| `workflow()` | Tworzy workflow i łączy nody w całość |
| `newCredential()` | Referencja do istniejącego credencjału |
| `languageModel()` | Model językowy (np. DeepSeek, OpenAI) |
| `merge(), ifElse(), splitInBatches()` | Rozgałęzienia, pętle |

Workflow buduje się przez łańcuch `.add(trigger).to(node1).to(node2)...`. `.add()` dodaje pierwszy node (START), `.to()` tworzy połączenie między nodami. Każdy node ma `type` (typ noda), `version`, `config.name` (nazwa w edytorze) i `config.parameters` (wszystkie specyficzne parametry).

---

## 3. Node 1: Schedule Trigger

**Trigger czasowy** — punkt startowy workflow. Mówi n8n: "uruchom ten workflow w każdy poniedziałek o 09:30".

Parametry:

| Parametr | Wartość | Znaczenie |
|---|---|---|
| `field` | `weeks` | Jednostka czasu: tygodnie |
| `weeksInterval` | `1` | Co 1 tydzień |
| `triggerAtDay` | `[1]` | Dzień: 1 = poniedziałek (0=nd, 1=pn, ...6=sb) |
| `triggerAtHour` | `9` | Godzina 09:00 |
| `triggerAtMinute` | `30` | Minuta 30 → 09:30 |

**Ważne**: wszystkie parametry specyficzne dla noda muszą być w `config.parameters`, a nie bezpośrednio w `config`. W starym SDK (`v1`) pisano je w `config` — to już nie działa w nowym SDK.

Trigger zwraca **1 item** z danymi czasowymi (`timestamp`, "Readable date", "Day of week"). Ten 1 item trafia do następnego noda.

---

## 4. Node 2: HTTP Request

**Pierwsze zapytanie HTTP** do Hacker News API. Pobiera listę 500 ID najgorętszych artykułów.

- `method: 'GET'` — tylko odczyt
- `url: 'https://hacker-news.firebaseio.com/v0/topstories.json'` — HN API na Firebase Google'a
- `authentication: 'none'` — API jest publiczne
- `alwaysOutputData: true` — **ważne**: jeśli API zwróci pustą tablicę, node mimo to wysyła 1 pusty item dalej. Bez tego, przy 0 wynikach cały workflow zostałby przerwany.

HN API zwraca gołą tablicę liczb: `[48086190, 48085821, ...]`. n8n automatycznie rozdziela ją na **500 osobnych itemów** — każdy to jeden numer ID (`$json = liczba`). To domyślne zachowanie HTTP Request node dla tablic JSON.

---

## 5. Node 3: Limit

Ogranicza liczbę przepływających itemów — bierze pierwsze 30 z 500 i resztę odrzuca.

- `maxItems: 30` — maksymalnie 30 itemów
- `keep: 'firstItems'` — zachowaj pierwsze N (alternatywa: `lastItems`)

Dlaczego 30? Pobranie szczegółów 500 artykułów = 500 zapytań HTTP → za wolno. 30 to kompromis: wystarczająco dużo by znaleźć ciekawe artykuły, ale nie za dużo by działało szybko.

---

## 6. Node 4: HTTP Request

**Drugie zapytanie HTTP** — dla każdego z 30 ID pobiera szczegóły artykułu. Wykonuje się **30 razy**, raz na każdy wchodzący item.

- `url: expr('https://.../v0/item/{{ $json }}.json')` — `expr()` tworzy dynamiczny URL. `$json` to ID artykułu (liczba). Dla każdego z 30 itemów URL jest inny: `.../item/48086190.json`, `.../item/48085821.json` itd.

**Dlaczego `$json` bez klucza?** Bo poprzedni node zwrócił gołą liczbę — n8n rozdzielając tablicę `[1, 2, 3]` tworzy itemy gdzie `$json` JEST tą liczbą, a nie obiektem z kluczem.

### Wyrażenia `expr()` i `{{ }}`

`expr()` tworzy wyrażenie n8n. Wszystko między `{{ }}` jest obliczane w czasie wykonania:
- `$json` — bieżący item (jego JSON)
- `$('NazwaNoda').item.json` — dane z innego noda
- `$now` — aktualna data/czas (Luxon DateTime)
- `$input.all()` — wszystkie itemy z poprzedniego noda

HN API dla pojedynczego artykułu zwraca: `id`, `title`, `by` (autor), `score` (punkty), `descendants` (komentarze), `url`, `type`, `time`.

---

## 7. Node 5: Code

**Code node** — SERCE workflow. Przyjmuje 30 artykułów, filtruje po słowach kluczowych, sortuje po punktach i zwraca tylko top 5.

- `mode: 'runOnceForAllItems'` — kod wykonuje się **1 raz** z dostępem do wszystkich 30 itemów naraz. Domyślnie Code node wykonuje się raz na każdy item (`runOnceForEachItem`), ale tu potrzebujemy widzieć wszystkie artykuły żeby je posortować.

**Co robi kod?**
1. Pobiera 30 artykułów przez `$input.all()`
2. Dla każdego sprawdza tytuł pod kątem słów kluczowych (`opencode`, `n8n`, `cursor`, `claude`, `gpt`, `agent`, `mcp`, `llm`, `llama`, `mistral`, `perplexity`, `windsurf`, itp. — ~24 słów związanych z AI i devtools)
3. Jeśli tytuł zawiera któreś słowo (case-insensitive) — artykuł przechodzi dalej
4. Sortuje przefiltrowane artykuły **malejąco po score** (najwięcej punktów pierwsze)
5. Bierze **pierwsze 5** (`slice(0, 5)`)
6. Zwraca 5 itemów ze strukturą: `{ title, url, score, author, comments }`

**Ważne**: Code node w n8n wymaga struktury `{ json: { ... } }` dla każdego zwracanego obiektu. Kod to czysty JavaScript (var, funkcje), silnik V8 w trybie sandbox.

---

## 8. Node 6: HTTP Request

**Trzecie zapytanie HTTP** — tym razem do MyMemory API (darmowe API tłumaczeniowe, ~5000 znaków/dzień w darmowym tierze). Tłumaczy tytuły z angielskiego na polski. Wykonuje się **5 razy** (raz na każdy artykuł).

- `url: expr('https://api.mymemory.translated.net/get?q={{ encodeURIComponent($json.title) }}&langpair=en|pl')`
- `encodeURIComponent()` — ważne: tytuły zawierają spacje i znaki specjalne, trzeba je zakodować do formatu URL
- `$json.title` — tytuł z bieżącego itemu (1 z 5 artykułów)
- `langpair=en|pl` — z angielskiego na polski

MyMemory zwraca: `responseData.translatedText` (przetłumaczony tekst) i `responseData.match` (poziom dopasowania 0.0-1.0).

---

## 9. Node 7: Code

**Drugi Code node** — łączy oryginalne dane artykułów z przetłumaczonymi tytułami i zmienia strukturę na format zgodny z kolumnami Data Table.

**Co robi kod?**
1. Pobiera tłumaczenia z bezpośredniego poprzednika przez `$input.all()` (5 itemów z MyMemory)
2. Pobiera oryginalne dane z wcześniejszego noda przez **`$('Filtruj i ranking').all()`** — to kluczowa koncepcja: nawet po 2 kolejnych nodach wciąż mamy dostęp do danych z dowolnego wcześniejszego noda po jego nazwie
3. Łączy dane po indeksie (zakłada tę samą kolejność itemów)
4. Jeśli MyMemory nie zwrócił tłumaczenia, używa oryginalnego tytułu jako **fallback**
5. Tworzy strukturę z polskimi nazwami pól: `tytul_pl`, `tytul_en`, `url`, `punkty`, `autor`, `komentarze`, `data`

**Dlaczego polskie nazwy pól?** Data Table używa `autoMapInputData` w następnym nodzie — automatycznie dopasowuje pola wejściowe do kolumn tabeli po nazwie. Polskie nazwy muszą dokładnie odpowiadać nazwom kolumn w tabeli.

---

## 10. Node 8: Data Table

Ostatni node — zapisuje 5 itemów jako nowe wiersze w tabeli "HN Top 5 - Artykuly". Każdy item → osobny wiersz.

- `resource: 'row'` — pracujemy na wierszach (nie na całej tabeli)
- `operation: 'insert'` — wstawiamy nowe wiersze
- `dataTableId: { mode: 'id', value: 'Iy9nbjya69dnFGOf' }` — identyfikator tabeli (resource locator)
- `columns: { mappingMode: 'autoMapInputData', value: null }` — **automatyczne mapowanie** pól do kolumn po nazwie

**columns** to resourceMapper — najtrudniejszy parametr w tym workflow. Początkowo próbowaliśmy `defineBelow` (ręczne mapowanie), ale różne formaty (obiekty, tablice stringów) dawały błędy. `autoMapInputData` okazał się właściwym rozwiązaniem — działa gdy nazwy pól dokładnie odpowiadają nazwom kolumn.

Tabela ma kolumny: `tytul_pl` (string), `tytul_en` (string), `url` (string), `punkty` (number), `autor` (string), `komentarze` (number), `data` (string). Po zapisie Data Table dodaje automatycznie `id`, `createdAt`, `updatedAt`.

---

## 11. Workflow composition

Workflow łączy nody w liniowy łańcuch:

```
Trigger (.add) → HTTP (.to) → Limit (.to) → HTTP (.to) → Code (.to) → HTTP (.to) → Code (.to) → Data Table (.to)
```

- `.add(node)` — START, dodaje pierwszy node (trigger)
- `.to(node)` — tworzy połączenie/strzałkę między nodami
- `workflow('id', 'name')` — tworzy workflow: pierwszy argument to unikalne ID, drugi to nazwa wyświetlana
- `position: [x, y]` — współrzędne na canvas (tylko dla edytora, nie wpływa na działanie)

Dla rozgałęzień używa się `.add()` wielokrotnie z tym samym triggerem i `.to()` dla każdej gałęzi.

---

## 12. Kluczowe koncepcje n8n

### Item

Podstawowa jednostka danych. Każdy node przyjmuje tablicę itemów i zwraca tablicę itemów. Struktura:
- `json: { ... }` — właściwe dane (to co widzisz w `$json`)
- `binary?: { ... }` — dane binarne (pliki, obrazy)
- `pairedItem?: { ... }` — pochodzenie itemu

### Jak zmienia się liczba itemów?

| Node | Wejście | Wyjście |
|---|---|---|
| Schedule Trigger | — | 1 item |
| HTTP (topstories) | 1 | 500 |
| Limit | 500 | 30 |
| HTTP (detale) | 30 | 30 (× 30 zapytań) |
| Code (filtr) | 30 | 5 |
| HTTP (tłumacz) | 5 | 5 (× 5 zapytań) |
| Code (format) | 5 | 5 |
| Data Table | 5 | 5 |

**Wniosek**: śledź liczbę itemów — to wyjaśnia dlaczego niektóre nody wykonują się wiele razy.

### $json, $input, $('NodeName')

| Zmienna | Znaczenie |
|---|---|
| `$json` | JSON bieżącego itemu |
| `$input.all()` | Wszystkie itemy z poprzedzającego noda |
| `$input.first()` | Pierwszy item z poprzedzającego noda |
| `$input.item` | Bieżący item (tryb `runOnceForEachItem`) |
| `$('NazwaNoda')` | Dane z dowolnego wcześniejszego noda po nazwie |
| `$('NazwaNoda').all()` | Wszystkie itemy z danego noda |
| `$now / $today` | Aktualna data/czas (Luxon DateTime) |
| `$itemIndex` | Indeks bieżącego itemu (0-based) |

**Zasada**: `$json` i `$()` muszą być **wewnątrz `{{ }}`**, nigdy na zewnątrz. Poza `{{ }}` nie są obliczane.

### mode w Code node

- `runOnceForEachItem` (domyślny bez podania mode) — kod wykonuje się raz na każdy item. `$input.all()` zwraca 1 item.
- `runOnceForAllItems` — kod wykonuje się 1 raz dla wszystkich itemów naraz. `$input.all()` zwraca tablicę.

### alwaysOutputData

Gdy node zwróci 0 itemów, workflow zostaje przerwany. `alwaysOutputData: true` zapobiega temu — jeśli nie ma danych, node wysyła 1 pusty item. Przydatne dla HTTP Requestów.

### Stare vs nowe SDK

| Aspekt | Stare SDK (v1) | Nowe SDK (v2) |
|---|---|---|
| Parametry | Bezpośrednio w `config` | W `config.parameters` |
| Code node | `code` (string), `executeOnce: true` | `jsCode` (string), `mode: 'runOnceForAllItems'` |
| Wyrażenia | Bezpośrednio w stringu | Poprzez `expr('url {{ }}')` |
| Trigger | `rule` w `config` | `rule` w `parameters` |

---

## 13. Lessons Learned

### 1. "Cannot convert undefined or null to object"
**Problem**: Data Table node nie miał parametru `columns`.
**Rozwiązanie**: Dodaj `columns: { mappingMode: 'autoMapInputData', value: null }`.

### 2. "Must be an n8n expression"
**Problem**: `columns` przekazany jako string JSON, a nie obiekt.
**Rozwiązanie**: Przekaż jako obiekt JavaScript, nie string.

### 3. "unexpected object input"
**Problem**: `columns.value` jako tablica obiektów `[{column: "tytul_pl"}]` — node interpretował obiekty jako wartości do bazy, nie mapowanie.
**Rozwiązanie**: Użyj `autoMapInputData` zamiast `defineBelow`.

### 4. Parametry w config vs parameters
**Problem**: `method`, `url` bezpośrednio w `config` (jak w starym SDK).
**Rozwiązanie**: Wszystko w `parameters: { method, url, ... }`.

### 5. $http w Code node vs osobny HTTP Request
**Problem**: Kod w Code node używał `$http.get()` do wywołań HTTP (mieszanie logiki z komunikacją sieciową).
**Rozwiązanie**: Osobny HTTP Request node dla każdego API — czystsze, łatwiejsze do debugowania, dostęp do paginacji i timeoutów.

### 6. executeOnce vs mode
**Problem**: Stary kod używał `executeOnce: true` (SDK v1).
**Rozwiązanie**: `mode: 'runOnceForAllItems'` (SDK v2).

### 7. rule w trigger
**Problem**: `rule` na poziomie `config` zamiast w `parameters`.
**Rozwiązanie**: `config: { parameters: { rule: { ... } } }`.

---

## Dodatek: Przydatne materiały

- [n8n Documentation](https://docs.n8n.io/)
- [n8n MCP Server Docs](https://docs.n8n.io/advanced-ai/mcp/accessing-n8n-mcp-server/)
- [HN API Documentation](https://github.com/HackerNews/API)
- [MyMemory API](https://mymemory.translated.net/doc/spec.php)
- [Firebase Realtime Database](https://firebase.google.com/docs/database)
