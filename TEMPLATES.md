# Rejestr szablonów n8n

Plik śledzący wszystkie workflowy załadowane na instancję n8n na Hostingerze (`https://n8n.srv1645572.hstgr.cloud`).

---

## Szablony

| # | Nazwa workflow | ID w n8n | Trigger | Węzły | Wymagane kredencjały | Status | Data dodania |
|---|---|---|---|---|---|---|---|---|
| 1 | **Sieć Agentów AI (Gemini)** | `5OnOB4FwZMK8uMNl` | Chat Trigger | 11 | Google Gemini, Gmail, Google Calendar, Tavily | ❌ | 2026-05-07 |
| 2 | **Sieć Agentów AI (Deepseek)** | `Sus7cpF3VSkhwbgl` | Chat Trigger | 11 | DeepSeek, Gmail (GCP), Google Calendar (GCP), Tavily | ❌ | 2026-05-06 |
| 3 | **Query GA4 data with Google Gemini AI in a Slack channel** | `b6dM5vmG0oZ0z8sh` | Slack Trigger | 8 | Slack, Google Analytics OAuth2, Google Gemini (AI Studio) | ❌ | 2026-05-07 |
| 4 | **HN Top 10 — codziennie 08:00 (Groq)** | `nicN5lZNI0LSb7Jz` | Schedule Trigger (daily) | 15 | Groq account (OpenAI), Gmail account (GCP) | ✅ | 2026-05-14 |

---

## Szczegóły

### 1. Sieć Agentów AI (Gemini)
- **Źródło:** Zbudowany od podstaw
- **Struktura:** Chat → Agent Conductor → Calendar/Mail/Research Agent
- **Model główny:** Google Gemini Chat Model (brak temperatury)
- **Modele sub-agentów:** Google Gemini Chat Model1 (temp: 0)
- **Narzędzia:** Google Calendar, Gmail, Tavily
- **Pamięć:** Buffer Window (10 kontekstów)
- **Kod źródłowy:** brak (utworzony ręcznie w n8n)

### 2. Sieć Agentów AI (Deepseek)
- **Źródło:** Zbudowany od podstaw
- **Struktura:** Chat → Agent Conductor → Calendar/Mail/Research Agent
- **Model główny:** DeepSeek (`deepseek-chat`, temp: 0.7)
- **Modele sub-agentów:** DeepSeek (`deepseek-chat`, temp: 0.7)
- **Narzędzia:** Google Calendar, Gmail, Tavily
- **Pamięć:** Buffer Window (10 kontekstów)
- **Uwaga:** Zmieniono model z `deepseek-v4-flash` na `deepseek-chat`, podniesiono temperaturę z 0 na 0.7, usunięto maxTokens: 500
- **Kod źródłowy:** brak (utworzony ręcznie w n8n)

### 3. Query GA4 data with Google Gemini AI in a Slack channel
- **Źródło:** https://n8n.io/workflows/13038-query-ga4-data-with-google-gemini-ai-in-a-slack-channel/
- **Autor:** scalo-labs
- **Struktura:** Slack Trigger → Edit Fields → AI Agent → Slack reply
- **Model:** Google Gemini 2.5 Pro
- **Narzędzie:** Google Analytics 4 (RunReport)
- **Pamięć:** Buffer Window (10 kontekstów, klucz własny)
- **Kod źródłowy:** brak (zaimportowany z szablonu n8n)

### 4. HN Top 10 — codziennie 08:00 (Groq)
- **Status:** ✅ **Główny, aktywny workflow.** Opublikowany na serwerze z aktywnym triggerem codziennym.
- **Źródło:** Zastępuje DeepSeek i Gemini jako główny workflow. Darmowy model przez Groq.
- **Struktura:** Schedule (daily) → HTTP (topstories) → HTTP (detale HN ×500, batch 10) → Code (filtr+ranking) → **splitInBatches(1)** → Code (saveOriginal) → HTTP (tłumaczenie ×10) → Code (mergeData) → **AI Agent | Groq / Llama 3.3 70B (streszczenie ×10)** → **Code (prepareBatchResult)** → Code (formatowanie) → Data Table (zapis) → Code (HTML email) → Gmail (wysyłka)
- **Trigger:** Codziennie o 08:00
- **Filtrowane frazy:** opencode, cloud code, openrouter, openai, codex, antigravity, warpdotdev, gemini, stape_io, n8n
- **Wyszukiwanie:** Top 500 HN → fetch szczegółów wszystkich 500 (batch 10) → filtr po tytułach → sort po score → top **10**
- **Tłumaczenie:** MyMemory API (EN→PL), z fallbackiem do oryginalnego tytułu
- **Streszczenie:** Groq / Llama 3.3 70B przez `@n8n/n8n-nodes-langchain.lmChatOpenAi` (custom base URL) + `@n8n/n8n-nodes-langchain.agent`. Generuje 5-6 zdaniowe polskie podsumowanie każdego artykułu.
- **E-mail:** Gmail wysyła sformatowany HTML na `pmackowka@gmail.com` z dopiskiem "(Groq)" w temacie i nagłówku
- **Brak Wait node:** Groq ma limit 30 RPM, nie wymaga opóźnienia między callami
- **Output:** Data Table (ta sama co #4: `Iy9nbjya69dnFGOf`)
- **Kredencjały:** Groq account przez `openAiApi` (Base URL `https://api.groq.com/openai/v1`), Gmail account (GCP) przez `gmailOAuth2`
- **Kod źródłowy:** `workflows/hn-top10-groq/workflow.ts`
- **Data dodania:** 2026-05-14 (Ostatnia aktualizacja: fix data alignment onDone)

---

## Usunięte z serwera

| Dawny # | Workflow | ID | Data usunięcia | Powód |
|---|---|---|---|---|
| 4 | **HN Top 10 — codziennie 08:00 (Gemini)** | `KmPY4nLRoV6JwYmz` | 2026-05-14 | Zastąpiony przez Groq. Kod źródłowy w `workflows/hn-top10-gemini/workflow.ts` |
| — | **HN Top 10 — codziennie 08:00 (DeepSeek)** | `D82114KdzodYpPvP` | 2026-05-14 | Płatny model, niepotrzebny. Zarchiwizowany na serwerze. |

## Zmiany

| Data | Opis |
|---|---|
| 2026-05-14 | Usunięto #4 (HN Gemini) z rejestru — workflow usunięty z serwera. Przenumerowanie #5→#4 (Groq). Dodano kolumnę Status i sekcję "Usunięte z serwera". Dark mode + większe fonty w HTML emailu. |
| 2026-05-14 | **Naprawa data alignment w splitInBatches:** dodano `saveOriginal` (fix cross-batch refs) i `prepareBatchResult` (fix $().all() w onDone). Unpublish Gemini, archive DeepSeek. 13→15 nodes w obu workflowach. |
| 2026-05-14 | Przebudowano #4 (Gemini) i #5 (Groq): usunięcie `urlContext`, maxTokens 1024→4096, prompt 2-3→5-6 zdań. Dodano Groq (darmowy) zamiast DeepSeek (płatny). |
| 2026-05-13 | Wyczyszczono rejestr: usunięto #4 (My workflow), #6 (HN poniedziałek), #7 (Lobste.rs) — nie istnieją w n8n. Zarchiwizowano `hn-top10/` i `lobsters-hn-top10/`. Przenumerowano #5→#4 (Gemini), #8→#5 (DeepSeek). |
| 2026-05-13 | Dodano #5 (dawniej #8): HN Top 10 DeepSeek — fork z #4, Gemini → DeepSeek, AI Agent, bez Wait, bez urlContext. |
| 2026-05-13 | Przebudowano #4 (dawniej #5): dodano splitInBatches(1) + Wait 15s (fix rate limitu Gemini). |
| 2026-05-13 | Przebudowano #4 (dawniej #5): top 5→10, trigger z poniedziałku na codziennie 08:00. |
| 2026-05-13 | Przebudowano #4 (dawniej #5): dodano wysyłkę e-mail przez Gmail. 8→10 nodów. |
| 2026-05-12 | Przebudowano #4 (dawniej #5): dodano Google Gemini + `urlContext`. |
| 2026-05-10 | Dodano #4 (dawniej #5): HN Top 5 — poniedziałek 09:30. Stworzony przez MCP. |
| 2026-05-10 | Przebudowano #4 (dawniej #5): dodano HTTP Request, Data Table, tłumaczenie MyMemory. |
| 2026-05-08 | Rozszerzono o wszystkie workflowy. |
| 2026-05-07 | Utworzono plik. |
