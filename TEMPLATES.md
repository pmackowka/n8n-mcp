# Rejestr szablonów n8n

Plik śledzący wszystkie workflowy załadowane na instancję n8n na Hostingerze (`https://n8n.srv1645572.hstgr.cloud`).

---

## Szablony

| # | Nazwa workflow | ID w n8n | Trigger | Węzły | Wymagane kredencjały | Data dodania |
|---|---|---|---|---|---|---|---|
| 1 | **Sieć Agentów AI (Gemini)** | `5OnOB4FwZMK8uMNl` | Chat Trigger | 11 | Google Gemini, Gmail, Google Calendar, Tavily | 2026-05-07 |
| 2 | **Sieć Agentów AI (Deepseek)** | `Sus7cpF3VSkhwbgl` | Chat Trigger | 11 | DeepSeek, Gmail (GCP), Google Calendar (GCP), Tavily | 2026-05-06 |
| 3 | **Query GA4 data with Google Gemini AI in a Slack channel** | `b6dM5vmG0oZ0z8sh` | Slack Trigger | 8 | Slack, Google Analytics OAuth2, Google Gemini (AI Studio) | 2026-05-07 |
| 4 | **HN Top 10 — codziennie 08:00 (Gemini)** | `KmPY4nLRoV6JwYmz` | Schedule Trigger (daily) | 12 | Google Gemini (AI Studio), Gmail account (GCP) | 2026-05-10 (przebud. 2026-05-13) |
| 5 | **HN Top 10 — codziennie 08:00 (DeepSeek)** | `D82114KdzodYpPvP` | Schedule Trigger (daily) | 12 | DeepSeek, Gmail account (GCP) | 2026-05-13 |

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

### 4. HN Top 10 — codziennie 08:00 (Gemini)
- **Źródło:** Zbudowany od podstaw przez MCP, rozbudowany o email i top 10
- **Struktura:** Schedule (daily) → HTTP (topstories) → HTTP (detale HN ×500, batch 10) → Code (filtr+ranking) → **splitInBatches(1)** → HTTP (tłumaczenie ×10) → Wait 15s → Google Gemini (streszczenie ×10) → Code (formatowanie) → Data Table (zapis) → Code (HTML email) → Gmail (wysyłka)
- **Trigger:** Codziennie o 08:00
- **Filtrowane frazy:** opencode, cloud code, openrouter, openai, codex, antigravity, warpdotdev, gemini, stape_io, n8n
- **Wyszukiwanie:** Top 500 HN → fetch szczegółów wszystkich 500 (batch 10) → filtr po tytułach → sort po score → top **10**
- **Tłumaczenie:** MyMemory API (EN→PL), z fallbackiem do oryginalnego tytułu
- **Streszczenie:** Google Gemini (`text:message`, model domyślny, `urlContext: true`) generuje 2-3 zdaniowe polskie podsumowanie każdego artykułu
- **E-mail:** Gmail (`n8n-nodes-base.gmail`) wysyła sformatowany HTML na `pmackowka@gmail.com` z linkami, tytułami PL/EN, punktami i streszczeniami
- **Wait 15s między Gemini callami:** wymuszone limitem 5 req/min darmowego tieru Gemini
- **Output:** Data Table "HN Top 5 - Artykuly" (ID: `Iy9nbjya69dnFGOf`), 8 kolumn: `tytul_pl`, `tytul_en`, `url`, `punkty`, `autor`, `komentarze`, `data`, `streszczenie_pl`
- **Kredencjały:** Google Gemini (AI Studio) przez `@n8n/n8n-nodes-langchain.googleGemini`, Gmail account (GCP) przez `gmailOAuth2`
- **Kod źródłowy:** `workflows/hn-top10-gemini/workflow.ts`
- **Data dodania:** 2026-05-10 (przebudowany 2026-05-13 — splitInBatches + Wait 15s)

### 5. HN Top 10 — codziennie 08:00 (DeepSeek)
- **Źródło:** Fork z #4, eksperyment porównawczy DeepSeek vs Gemini
- **Struktura:** Schedule (daily) → HTTP (topstories) → HTTP (detale HN ×500, batch 10) → Code (filtr+ranking) → **splitInBatches(1)** → HTTP (tłumaczenie ×10) → **AI Agent \| DeepSeek (streszczenie ×10)** → Code (formatowanie) → Data Table (zapis) → Code (HTML email) → Gmail (wysyłka)
- **Trigger:** Codziennie o 08:00
- **Filtrowane frazy:** opencode, cloud code, openrouter, openai, codex, antigravity, warpdotdev, gemini, stape_io, n8n
- **Wyszukiwanie:** Top 500 HN → fetch szczegółów wszystkich 500 (batch 10) → filtr po tytułach → sort po score → top **10**
- **Różnice vs #4:** DeepSeek (`deepseek-chat`, temp: 0.4) zamiast Gemini, brak `urlContext` (DeepSeek nie wspiera), brak Wait node (DeepSeek ma wyższe limity API), AI Agent z `systemMessage`
- **Streszczenie:** DeepSeek Chat Model (`@n8n/n8n-nodes-langchain.lmChatDeepSeek`) przez AI Agent (`@n8n/n8n-nodes-langchain.agent`) generuje 2-3 zdaniowe polskie podsumowanie każdego artykułu na podstawie tytułu i URL (bez pobierania treści)
- **E-mail:** Gmail wysyła sformatowany HTML na `pmackowka@gmail.com` z dopiskiem "(DeepSeek)" w temacie i nagłówku
- **Output:** Data Table (ta sama co #4: `Iy9nbjya69dnFGOf`)
- **Kredencjały:** DeepSeek przez `deepSeekApi`, Gmail account (GCP) przez `gmailOAuth2`
- **Kod źródłowy:** `workflows/hn-top10-deepseek/workflow.ts`
- **Data dodania:** 2026-05-13

---

## Zmiany

| Data | Opis |
|---|---|---|
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
