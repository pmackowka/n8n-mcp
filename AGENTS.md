# AGENTS.md — n8n-MCP

Ten projekt łączy model językowy z instancją n8n przez protokół MCP.

## Zasady

- Przed stworzeniem workflowa zawsze wywołaj `get_sdk_reference`
- Przed zapisem kodu użyj `search_nodes` i `get_node_types` aby poznać nazwy parametrów
- Zawsze waliduj kod przez `validate_workflow` przed `create_workflow_from_code`
- URL serwera: zmienna środowiskowa `N8N_MCP_URL`
- Token: zmienna środowiskowa `N8N_MCP_TOKEN`
- Konfiguracja MCP: `opencode.json` w katalogu głównym

## Architektura projektu

- Każdy workflow tworzy w katalogu `workflows/<nazwa-workflowu>/workflow.ts`
- Do kopiowania szablonu nowego workflowu: `workflows/_template/workflow.ts`
- Po utworzeniu workflowu zarejestruj go w `TEMPLATES.md`
- Współdzielone helpery (jeśli potrzebne): `shared/`
- Testowe workflowy (utworzone podczas debugowania/poprawek) **zawsze archiwizuj** (`archive_workflow`) po zakończeniu sesji

## Główne workflowy

| Workflow | ID w n8n | Status | Opis |
|---|---|---|---|
| HN Top 10 — Groq | `nicN5lZNI0LSb7Jz` | ✅ Aktywny | Główny workflow, codziennie o 08:00. Groq/Llama 3.3 70B. |
| HN Top 10 — Gemini | `KmPY4nLRoV6JwYmz` | 🗑️ Usunięty z serwera | Alternatywa Gemini. Kod źródłowy zachowany lokalnie (`workflows/hn-top10-gemini/workflow.ts`). |

## Dokumentacja

- https://docs.n8n.io/advanced-ai/mcp/accessing-n8n-mcp-server/
- https://blog.n8n.io/n8n-mcp-server/

---

## Historia sesji — problemy i rozwiązania

### Sesja 2026-05-14: Naprawa pustych streszczeń i data alignment w splitInBatches

**Cel:** HN Top 10 email workflow — poprawne, pełne streszczenia dla wszystkich 6+ przefiltrowanych artykułów.

**Wybór modelu:** Groq (Llama 3.3 70B) przez OpenAI Chat Model + custom base URL `https://api.groq.com/openai/v1`.
- DeepSeek usunięty (płatny)
- Gemini free tier (5 RPM) działa ale wolny
- n8n nie miał zainstalowanego `lmChatGroq`, stąd `lmChatOpenAi` + base URL

#### Problem 1: urlContext: true powodował błędy API

**Objaw:** `"This node is not currently installed"` lub błędy 400 przy wywołaniu Gemini.
**Przyczyna:** `urlContext: true` w node Gemini próbował fetchować URL-e artykułów, które były niedostępne (zwracały błędy SSL/403).
**Fix:** Usunięto `urlContext: true` — prompt dostaje tytuł i URL jako tekst, model streszcza na podstawie tytułu.

Wpłynęło na: `workflows/hn-top10-gemini/workflow.ts` i `workflows/hn-top10-groq/workflow.ts`.

#### Problem 2: $("Filtruj i ranking").item zwracał pierwszy batch zamiast bieżącego

**Objaw:** mergeData (i AI prompt) dla batchy #2+ dostawał dane z pierwszego batcha zamiast bieżącego.
**Przyczyna:** `$("Filtruj i ranking").item` w splitInBatches odnosi się do pierwszego itemu w tym node, nie do bieżącego batcha. Węzeł `Filtruj i ranking` jest przed splitem, więc `.item` zawsze zwraca pierwszy item.

**Fix:** Dodano `saveOriginal` (Code node, `$input.first().json`) jako pierwszy node wewnątrz każdego batcha. Wszystkie downstream node'y (`mergeData`, `formatResults`) używają `$("Zapisz oryginalne").item` lub `$("Zapisz oryginalne").all()` zamiast `$("Filtruj i ranking").item`.

Wpłynęło na: `workflows/hn-top10-gemini/workflow.ts` i `workflows/hn-top10-groq/workflow.ts` (commit 41ef173).

#### Problem 3: $().all() w onDone zwraca tylko ostatni batch (kluczowy bug)

**Objaw:** Formatuj wyniki w onDone produkował 1 artykuł zamiast 6+.
**Przyczyna:** `$("Zapisz oryginalne").all()`, `$("Tlumacz tytul").all()`, `$("Generuj streszczenie (Groq)").all()` w onDone zwracają tylko dane z OSTATNIEGO batcha, nie ze wszystkich. Potwierdzone testem diagnostycznym (execution #340): `$input.all()` miał 6 itemów, ale `$().all()` do node'ów wewnątrz batcha zwracał 1.

**Fix:** Dodano node `Przygotuj wynik batcha` (Code) na końcu każdego batcha (`onEachBatch`), który łączy streszczenie + dane oryginalne + tłumaczenie w jeden kompletny obiekt (wykorzystując `$("Zapisz oryginalne").item`, `$("Tlumacz tytul").item` i `$json` z bieżącego batcha). W onDone, `Formatuj wyniki` używa `$input.all()` (które poprawnie zwraca 6 kompletnych obiektów) i po prostu mapuje je.

Chain przed fixem:
```
onEachBatch: saveOriginal → translateTitle → mergeData → summarizeWithGroq → nextBatch
onDone: formatResults(→ $().all() x3 → tylko 1 item)
```

Chain po fixie:
```
onEachBatch: saveOriginal → translateTitle → mergeData → summarizeWithGroq → prepareBatchResult → nextBatch
onDone: formatResults(→ $input.all() → 6 itemów)
```

Wpłynęło na: `workflows/hn-top10-gemini/workflow.ts` i `workflows/hn-top10-groq/workflow.ts` (commit 9565b61).

#### Inne zmiany

- **Gmail OAuth token:** Wygasł — ręczne odświeżenie w UI n8n (reconnect credential).
- **maxOutputTokens:** Zwiększono z 1024 do 4096 (dłuższe streszczenia).
- **Prompt:** Zmieniono z "2-3 zdania" na "5-6 zdań".
- **DeepSeek:** Usunięto `workflows/hn-top10-deepseek/` i zarchiwizowano na serwerze (płatny model, niepotrzebny).
- **Gemini workflow:** Usunięty z serwera. Kod źródłowy zachowany lokalnie (`workflows/hn-top10-gemini/workflow.ts`).

#### Ważne dla przyszłych sesji

- W splitInBatches, `$("NazwaZewnetrzna").item` zawsze zwraca pierwszy item, nie bieżący batch.
- W onDone, `$().all()` dla node'ów wewnątrz onEachBatch zwraca tylko ostatni batch.
- W onDone, `$input.all()` zawiera poprawne dane ze wszystkich batchy (to jest output ostatniego node'a w onEachBatch).
- Rozwiązanie: agreguj dane w ostatnim node wewnątrz batcha, czytaj w onDone przez `$input.all()`.
- Groq ma limit 30 RPM (nie wymaga Wait node). Gemini free tier ma 5 RPM (wymaga Wait 20s).
- Credential dla Groq: typ `openAiApi` z Base URL `https://api.groq.com/openai/v1`.
- MCP server wymaga `-k` (invalid SSL) i `Accept: application/json, text/event-stream`.
- `lmChatGroq` nie jest zainstalowany na instancji — używamy `lmChatOpenAi` z base URL do Groq.
