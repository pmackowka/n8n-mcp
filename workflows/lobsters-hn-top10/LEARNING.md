# Understanding the Lobste.rs + HN Top 10 Workflow

## Spis treści

 1. [Overview](#1-overview)
 2. [n8n Workflow SDK](#2-n8n-workflow-sdk)
 3. [Node 1: Schedule Trigger — codziennie 08:00](#3-node-1-schedule-trigger)
 4. [Node 2: HTTP Request — lista ID z HN](#4-node-2-http-request)
 5. [Node 3: HTTP Request — szczegóły 500 artykułów](#5-node-3-http-request)
 6. [Node 4: HTTP Request — lista z Lobste.rs](#6-node-4-http-request--lobsters)
 7. [Node 5: Code — filtrowanie i scalanie 5+5](#7-node-5-code--filtrowanie-i-scalanie)
 8. [Node 6: HTTP Request — tłumaczenie](#8-node-6-http-request)
 9. [Node 7: Google Gemini — streszczenie](#9-node-7-google-gemini)
10. [Node 8: Code — formatowanie danych](#10-node-8-code)
11. [Node 9: Data Table — zapis danych](#11-node-9-data-table)
12. [Node 10: Code — HTML email](#12-node-10-code--html-email)
13. [Node 11: Gmail — wysyłka](#13-node-11-gmail)
14. [Kluczowe koncepcje n8n](#14-kluczowe-koncepcje-n8n)
15. [Lessons Learned](#15-lessons-learned)

---

## 1. Overview

Workflow uruchamia się codziennie o 08:00. Łączy się z **Hacker News** (500 ID) i **Lobste.rs** (200 stories), filtruje po słowach kluczowych AI/devtools, wybiera **top 5 z każdego źródła** (łącznie 10), tłumaczy tytuły na polski, generuje polskie streszczenia przez Google Gemini i wysyła sformatowany HTML e-mail.

Przepływ danych:

```
Trigger (daily 08:00)
→ HTTP (HN 500 ID) → HTTP (szczegóły × 500)
→ HTTP (Lobste.rs stories)
→ Code (filtruj oba źródła → top 5 HN + top 5 Lobste.rs = 10)
→ HTTP (tłumacz tytuły × 10) → Gemini (streszczenie × 10)
→ Code (formatuj) → Data Table (zapisz)
→ Code (HTML email) → Gmail (wyślij)
```

Kluczowe różnice vs HN-only: **dwa źródła** (HN + Lobste.rs), **5+5=10 artykułów**, HN sortowane po score, Lobste.rs po comment_count, **kolejność HN first**, codzienny trigger.

---

## 2. n8n Workflow SDK

Workflow pisany jest w TypeScript przy użyciu **n8n Workflow SDK**.

Główne funkcje SDK:

| Funkcja | Zastosowanie |
|---|---|
| `trigger()` | Definiuje trigger (co uruchamia workflow) |
| `node()` | Definiuje pojedynczy node (krok) |
| `expr()` | Tworzy wyrażenie `{{ }}` do dynamicznych wartości |
| `workflow()` | Tworzy workflow i łączy nody w całość |
| `newCredential()` | Referencja do istniejącego credencjału |
| `languageModel()` | Model językowy (np. DeepSeek, OpenAI) — patrz uwaga: Google Gemini używa `node()` z `@n8n/n8n-nodes-langchain.googleGemini`, **nie** `languageModel()` |
| `merge(), ifElse(), splitInBatches()` | Rozgałęzienia, pętle |

Workflow buduje się przez łańcuch `.add(trigger).to(node1).to(node2)...`. `.add()` dodaje pierwszy node (START), `.to()` tworzy połączenie. Każdy node ma `type`, `version`, `config.name` i `config.parameters` (wszystkie parametry specyficzne).

---

## 3. Node 1: Schedule Trigger

Trigger czasowy — uruchamia workflow w każdy poniedziałek o 09:30.

| Parametr | Wartość | Znaczenie |
|---|---|---|---|
| `field` | `weeks` | Jednostka: tygodnie |
| `weeksInterval` | `1` | Co 1 tydzień |
| `triggerAtDay` | `[1]` | 1 = poniedziałek |
| `triggerAtHour` | `9` | Godzina 09:00 |
| `triggerAtMinute` | `30` | Minuta 30 → 09:30 |

Zwraca **1 item** z danymi czasowymi. Wszystkie parametry muszą być w `config.parameters` (nowe SDK).

---

## 4. Node 2: HTTP Request

Pierwsze zapytanie HTTP do Hacker News API. Pobiera listę **500 ID** najgorętszych artykułów.

- `method: 'GET'` — tylko odczyt
- `url: 'https://hacker-news.firebaseio.com/v0/topstories.json'` — HN API na Firebase Google'a
- `authentication: 'none'` — API publiczne
- `alwaysOutputData: true` — jeśli API zwróci pustą tablicę, workflow nie zostanie przerwany

HN API zwraca gołą tablicę liczb: `[48086190, 48085821, ...]`. n8n automatycznie rozdziela ją na **500 osobnych itemów** — każdy to jeden numer ID (`$json = liczba`).

---

## 5. Node 3: HTTP Request

**Drugie zapytanie HTTP** — dla każdego z 500 ID pobiera szczegóły artykułu. Wykonuje się **500 razy**, raz na każdy item.

- `url: expr('https://.../v0/item/{{ $json }}.json')` — dynamiczny URL. `$json` to ID artykułu (liczba). Dla każdego z 500 itemów URL jest inny.

**Dlaczego `$json` bez klucza?** Bo poprzedni node zwrócił gołą liczbę — n8n rozdzielając tablicę `[1, 2, 3]` tworzy itemy gdzie `$json` JEST tą liczbą.

### Wyrażenia `expr()` i `{{ }}`

`expr()` tworzy wyrażenie n8n. Wszystko między `{{ }}` jest obliczane w czasie wykonania:
- `$json` — bieżący item
- `$('NazwaNoda').item.json` — dane z innego noda
- `$now` — aktualna data/czas
- `$input.all()` — wszystkie itemy z poprzedniego noda

HN API dla pojedynczego artykułu zwraca: `id`, `title`, `by` (autor), `score` (punkty), `descendants` (komentarze), `url`.

**500 zapytań HTTP równolegle**: n8n wykonuje je jednocześnie (nie sekwencyjnie). HN na Firebase jest skalowalny, więc to działa wydajnie.

---

## 6. Node 4: Code

**Code node** — serce workflow. Przyjmuje **500 artykułów**, filtruje po słowach kluczowych, sortuje po punktach i zwraca **top 5**.

- `mode: 'runOnceForAllItems'` — kod wykonuje się **1 raz** z dostępem do wszystkich 500 itemów naraz

**Słowa kluczowe** (zawężone do Twoich zainteresowań):
`opencode`, `cloud code`, `openrouter`, `openai`, `codex`, `antigravity`, `warpdotdev`, `gemini`, `stape_io`, `n8n`

**Co robi kod?**
1. Pobiera 500 artykułów przez `$input.all()`
2. Dla każdego sprawdza tytuł pod kątem słów kluczowych (case-insensitive)
3. Przepuszcza tylko artykuły z dopasowaniem
4. Sortuje wyniki **malejąco po score** (najwięcej punktów pierwsze)
5. Bierze **pierwsze 5** (`slice(0, 5)`)
6. Zwraca strukturę: `{ title, url, score, author, comments }`

**Ważne**: Code node wymaga struktury `{ json: { ... } }` dla każdego zwracanego obiektu. Gdyby artykułów pasujących do słów kluczowych było mniej niż 5, workflow zwróci tyle ile znajdzie.

---

## 7. Node 5: HTTP Request

**Trzecie zapytanie HTTP** — MyMemory API (darmowe tłumaczenie, ~5000 znaków/dzień). Tłumaczy tytuły z angielskiego na polski. Wykonuje się **do 5 razy**.

- `url: expr('https://api.mymemory.translated.net/get?q={{ encodeURIComponent($json.title) }}&langpair=en|pl')`
- `encodeURIComponent()` — koduje znaki specjalne w URL (spacja → `%20`)
- `$json.title` — tytuł z bieżącego itemu
- `langpair=en|pl` — angielski → polski

MyMemory zwraca: `responseData.translatedText` i `responseData.match` (dopasowanie 0.0-1.0).

---

## 8. Node 6: Google Gemini

**Google Gemini** — generuje polskie streszczenie każdego artykułu. Wykonuje się **do 5 razy**, raz na każdy artykuł.

- `type: '@n8n/n8n-nodes-langchain.googleGemini'` — dedykowany node do Google Gemini
- `resource: 'text'`, `operation: 'message'` — tryb tekstowego chat completion
- `modelId` — domyślny model (obecnie `models/gemini-3-flash-preview`)
- `messages.values[0].content` — prompt z tytułem i URL-em artykułu (referencja do `$("Filtruj i ranking")` przez `$("NazwaNoda").item.json`)
- `simplify: true` — upraszcza odpowiedź do zwięzłego formatu
- `builtInTools.urlContext: true` — pozwala Gemini samodzielnie odczytać treść spod URL-a
- `options.temperature: 0.4` — niska temperatura = bardziej deterministyczne odpowiedzi
- `newCredential('Google Gemini (AI Studio)')` — referencja do istniejącego kredencjału Google Gemini

Google Gemini zwraca strukturę: `{ content: { parts: [ { text: "streszczenie..." } ] } }`. Node `@n8n/n8n-nodes-langchain.googleGemini` to zwykły node n8n (nie LangChain Chain), więc działa w liniowym przepływie — przyjmuje itemy i zwraca itemy.

**Kluczowa zmiana w stosunku do oryginalnego planu:** Zamiast osobnego HTTP Request + Code do pobierania i wyciągania treści artykułów, Gemini używa wbudowanego narzędzia `urlContext` do samodzielnego odczytania URL-a. Eliminuje to problem z Cloudflare (Gemini czyta ze swojej infrastruktury) i upraszcza workflow o 2 nod-y.

---

## 9. Node 7: Code

**Trzeci Code node** — łączy oryginalne dane z przetłumaczonymi tytułami i streszczeniami Gemini, mapuje na polskie nazwy kolumn Data Table.

**Co robi kod?**
1. Pobiera tłumaczenia przez **`$('Tlumacz tytul').all()`**
2. Pobiera oryginały przez **`$('Filtruj i ranking').all()`**
3. Pobiera streszczenia przez **`$('Generuj streszczenie').all()`**
4. Łączy po indeksie (zakłada tę samą kolejność)
5. Jeśli MyMemory zawiódł → fallback do oryginalnego tytułu
6. Wyciąga tekst odpowiedzi Gemini z `content.parts[0].text`
7. Tworzy strukturę: `tytul_pl`, `tytul_en`, `url`, `punkty`, `autor`, `komentarze`, `data`, `streszczenie_pl`

**Dlaczego polskie nazwy?** `autoMapInputData` w Data Table dopasowuje pola do kolumn po nazwie.

**Dlaczego `$('NazwaNoda').all()` zamiast `$input.all()`?** Ponieważ node nie jest bezpośrednim następnikiem wszystkich źródeł danych — tłumaczenia pochodzą z HTTP, oryginały z Code, streszczenia z Gemini. `$('NazwaNoda')` pozwala sięgnąć do dowolnego wcześniejszego noda po nazwie.

---

## 10. Node 8: Data Table

Zapisuje do 5 itemów jako nowe wiersze w tabeli "HN Top 5 - Artykuly".

- `resource: 'row'` — pracujemy na wierszach
- `operation: 'insert'` — wstawiamy nowe
- `dataTableId: { mode: 'id', value: 'Iy9nbjya69dnFGOf' }` — identyfikator tabeli
- `columns: { mappingMode: 'autoMapInputData', value: null }` — automatyczne mapowanie po nazwie

Tabela: `tytul_pl` (string), `tytul_en` (string), `url` (string), `punkty` (number), `autor` (string), `komentarze` (number), `data` (string), `streszczenie_pl` (string). Data Table dodaje `id`, `createdAt`, `updatedAt`.

---

## 11. Node 9: Code — HTML email

**Code node** — scala 5 artykułów w jeden sformatowany e-mail HTML. Wykonuje się **1 raz** (`runOnceForAllItems`).

- Pobiera wszystkie 5 itemów przez `$input.all()`
- Buduje kompletny dokument HTML z `<html><body>` i stylami inline
- Dla każdego artykułu: link <a>, tytuł PL/EN, punkty, autor, komentarze, streszczenie
- Funkcja `escapeHtml()` zabezpiecza przed XSS/injection w treści
- Zwraca **1 item** z `{ htmlBody: "...", subject: "HN Top 5 — data" }`

**Dlaczego osobny Code node?** Gmail działa na pojedynczym itemie — wysyła 1 e-mail na 1 item. Mając 5 itemów dostałbyś 5 osobnych maili. Code node scala wszystko w jeden item → 1 e-mail ze wszystkimi artykułami.

---

## 12. Node 10: Gmail — wysyłka

**Gmail** — wysyła sformatowany e-mail na adres `pmackowka@gmail.com`.

- `resource: 'message'`, `operation: 'send'` — wysyłanie wiadomości
- `sendTo: 'pmackowka@gmail.com'` — adres docelowy
- `subject` i `message` z poprzedniego Code node'a przez wyrażenia `{{ $json.subject }}` i `{{ $json.htmlBody }}`
- `emailType: 'html'` — treść w formacie HTML (zamiast plain text)
- `options.appendAttribution: false` — usuwa domyślną stopkę n8n
- `credentials: { gmailOAuth2: newCredential('Gmail (GCP)') }` — kredencjał Gmail OAuth2

Gmail zwraca `{ id, labelIds: ['SENT'], threadId }`. Workflow kończy się po wysłaniu maila.

**Uwaga:** Node Gmail używa kredencjału `gmailOAuth2` (Gmail OAuth2), który musi być skonfigurowany na instancji n8n. Wymaga autoryzacji Google — po pierwszym uruchomieniu workflowu może być potrzebne ręczne potwierdzenie OAuth.

---

## 13. Workflow composition

```
Trigger (.add) → HTTP (.to) → HTTP (.to) → Code (.to) → HTTP (.to) → Gemini (.to) → Code (.to) → Data Table (.to) → Code (.to) → Gmail (.to)
```

10 nodów w liniowym łańcuchu. Każdy node przesunięty w prawo o 240px na canvas.

- `.add(node)` — START (tylko pierwszy node)
- `.to(node)` — połączenie między nodami
- `workflow('id', 'name')` — ID (unikalne) + nazwa wyświetlana

Dla rozgałęzień: `.add()` wielokrotnie z tym samym triggerem.

---

## 14. Kluczowe koncepcje n8n

### Item

Podstawowa jednostka danych. Struktura: `{ json: { ... }, binary?: { ... }, pairedItem?: { ... } }`.

### Jak zmienia się liczba itemów?

| Node | Wejście | Wyjście |
|---|---|---|
| Schedule Trigger | — | 1 item |
| HTTP (topstories) | 1 | 500 |
| HTTP (detale) | 500 | 500 (× 500 zapytań) |
| Code (filtr) | 500 | 5 |
| HTTP (tłumacz) | 5 | 5 (× 5 zapytań) |
| Gemini (streszczenie) | 5 | 5 (× 5 zapytań API) |
| Code (format) | 5 | 5 |
| Data Table | 5 | 5 |
| Code (HTML) | 5 | 1 (scala 5 → 1) |
| Gmail (wysyłka) | 1 | 1 |

### $json, $input, $('NodeName')

| Zmienna | Znaczenie |
|---|---|
| `$json` | JSON bieżącego itemu |
| `$input.all()` | Wszystkie itemy z poprzedzającego noda |
| `$input.first()` | Pierwszy item z poprzedzającego noda |
| `$input.item` | Bieżący item (tryb per-item) |
| `$('NazwaNoda')` | Dowolny wcześniejszy node po nazwie |
| `$('NazwaNoda').all()` | Wszystkie itemy z danego noda |
| `$now / $today` | Aktualna data/czas |
| `$itemIndex` | Indeks bieżącego itemu |

### mode w Code node

- `runOnceForEachItem` (domyślny) — kod N razy, raz na każdy item
- `runOnceForAllItems` — kod 1 raz, `$input.all()` zwraca wszystkie itemy

### alwaysOutputData

Gdy node zwróci 0 itemów, workflow zostaje przerwany. `alwaysOutputData: true` zapobiega temu.

### Stare vs nowe SDK

| Aspekt | Stare SDK (v1) | Nowe SDK (v2) |
|---|---|---|
| Parametry | Bezpośrednio w `config` | W `config.parameters` |
| Code node | `code`, `executeOnce: true` | `jsCode`, `mode: 'runOnceForAllItems'` |
| Wyrażenia | Bezpośrednio w stringu | Przez `expr('url {{ }}')` |
| Trigger | `rule` w `config` | `rule` w `parameters` |

---

## 15. Lessons Learned

### 1. "Cannot convert undefined or null to object"
Brak `columns` w Data Table. **Rozwiązanie**: `columns: { mappingMode: 'autoMapInputData', value: null }`.

### 2. "Must be an n8n expression"
`columns` jako string JSON. **Rozwiązanie**: obiekt JavaScript, nie string.

### 3. "unexpected object input"
`columns.value` jako tablica obiektów zamiast `autoMapInputData`. **Rozwiązanie**: używaj `autoMapInputData`.

### 4. Parametry w config vs parameters
`method`, `url` w `config` zamiast `parameters`. **Rozwiązanie**: zawsze w `parameters`.

### 5. $http w Code node vs osobny HTTP Request
`$http.get()` w Code node miesza logikę z komunikacją. **Rozwiązanie**: osobny HTTP Request node.

### 6. executeOnce vs mode
`executeOnce: true` to stare SDK. **Rozwiązanie**: `mode: 'runOnceForAllItems'`.

### 7. rule w trigger
`rule` na poziomie `config`. **Rozwiązanie**: `config: { parameters: { rule: {...} } }`.

### 8. Limit przed filtrowaniem
Limit 30 przed filtrowaniem oznaczał pracę tylko na pierwszych 30 ID. **Rozwiązanie**: usunięto Limit — filtrujemy wszystkie 500, wybieramy top 5 z pełnego zbioru.

### 9. Format odpowiedzi Google Gemini
Zakładałem, że Gemini z `simplify: true` zwróci `{ response: "tekst" }`. W rzeczywistości zwraca `{ content: { parts: [ { text: "tekst" } ] } }`. **Rozwiązanie**: sprawdź rzeczywisty output przed napisaniem kodu formatującego — użyj `get_execution` z `includeData: true`, aby podejrzeć strukturę odpowiedzi.

### 10. urlContext vs własny fetch
Planowałem osobny HTTP Request + Code do pobierania treści artykułów, ale Cloudflare blokował automatyczne zapytania. **Rozwiązanie**: użyj wbudowanego narzędzia `urlContext` w Gemini — model sam odczytuje URL-e z własnej infrastruktury, co eliminuje problemy z blokowaniem i upraszcza workflow.

---

## Dodatek: Przydatne materiały

- [n8n Documentation](https://docs.n8n.io/)
- [n8n MCP Server Docs](https://docs.n8n.io/advanced-ai/mcp/accessing-n8n-mcp-server/)
- [HN API Documentation](https://github.com/HackerNews/API)
- [MyMemory API](https://mymemory.translated.net/doc/spec.php)
- [Firebase Realtime Database](https://firebase.google.com/docs/database)
