# Rejestr szablonów n8n

Plik śledzący wszystkie workflowy załadowane na instancję n8n na Hostingerze (`https://n8n.srv1645572.hstgr.cloud`).

---

## Szablony

| # | Nazwa workflow | ID w n8n | Trigger | Węzły | Wymagane kredencjały | Data dodania |
|---|---|---|---|---|---|---|
| 1 | **Sieć Agentów AI (Gemini)** | `5OnOB4FwZMK8uMNl` | Chat Trigger | 11 | Google Gemini, Gmail, Google Calendar, Tavily | 2026-05-07 |
| 2 | **Sieć Agentów AI (Deepseek)** | `Sus7cpF3VSkhwbgl` | Chat Trigger | 11 | DeepSeek, Gmail (GCP), Google Calendar (GCP), Tavily | 2026-05-06 |
| 3 | **Query GA4 data with Google Gemini AI in a Slack channel** | `b6dM5vmG0oZ0z8sh` | Slack Trigger | 8 | Slack, Google Analytics OAuth2, Google Gemini (AI Studio) | 2026-05-07 |
| 4 | **My workflow** (pusty) | `gpvpszunXxwjHvwl` | brak | 0 | brak | 2026-05-08 |
| 5 | **HN Top 5 — poniedziałek 09:30** | `KmPY4nLRoV6JwYmz` | Schedule Trigger | 10 | Google Gemini (AI Studio), Gmail (GCP) | 2026-05-10 (przebud. 2026-05-13) |
| 6 | **HN Top 10 — poniedziałek 09:30** | — | Schedule Trigger | 10 | Google Gemini (AI Studio), Gmail account (GCP) | 2026-05-13 |

---

## Szczegóły

### 1. Sieć Agentów AI (Gemini)
- **Źródło:** Zbudowany od podstaw
- **Struktura:** Chat → Agent Conductor → Calendar/Mail/Research Agent
- **Model główny:** Google Gemini Chat Model (brak temperatury)
- **Modele sub-agentów:** Google Gemini Chat Model1 (temp: 0)
- **Narzędzia:** Google Calendar, Gmail, Tavily
- **Pamięć:** Buffer Window (10 kontekstów)

### 2. Sieć Agentów AI (Deepseek)
- **Źródło:** Zbudowany od podstaw
- **Struktura:** Chat → Agent Conductor → Calendar/Mail/Research Agent
- **Model główny:** DeepSeek (`deepseek-chat`, temp: 0.7)
- **Modele sub-agentów:** DeepSeek (`deepseek-chat`, temp: 0.7)
- **Narzędzia:** Google Calendar, Gmail, Tavily
- **Pamięć:** Buffer Window (10 kontekstów)
- **Uwaga:** Zmieniono model z `deepseek-v4-flash` na `deepseek-chat`, podniesiono temperaturę z 0 na 0.7, usunięto maxTokens: 500

### 3. Query GA4 data with Google Gemini AI in a Slack channel
- **Źródło:** https://n8n.io/workflows/13038-query-ga4-data-with-google-gemini-ai-in-a-slack-channel/
- **Autor:** scalo-labs
- **Struktura:** Slack Trigger → Edit Fields → AI Agent → Slack reply
- **Model:** Google Gemini 2.5 Pro
- **Narzędzie:** Google Analytics 4 (RunReport)
- **Pamięć:** Buffer Window (10 kontekstów, klucz własny)

### 4. My workflow (pusty)
- Pusty workflow gotowy do wypełnienia

### 5. HN Top 5 — poniedziałek 09:30
- **Źródło:** Zbudowany od podstaw przez MCP
- **Struktura:** Schedule → HTTP (topstories) → HTTP (detale HN ×500, batch 10) → Code (filtr+ranking) → HTTP (tłumaczenie ×5) → Google Gemini (streszczenie ×5) → Code (formatowanie) → Data Table (zapis) → Code (HTML email) → Gmail (wysyłka)
- **Trigger:** Co poniedziałek o 09:30
- **Filtrowane frazy:** opencode, cloud code, openrouter, openai, codex, antigravity, warpdotdev, gemini, stape_io, n8n
- **Wyszukiwanie:** Top 500 HN → fetch szczegółów wszystkich 500 (batch 10) → filtr po tytułach → sort po score → top 5
- **Tłumaczenie:** MyMemory API (EN→PL), z fallbackiem do oryginalnego tytułu
- **Streszczenie:** Google Gemini (`text:message`, model domyślny, `urlContext: true`) generuje 2-3 zdaniowe polskie podsumowanie każdego artykułu
- **E-mail:** Gmail (`n8n-nodes-base.gmail`) wysyła sformatowany HTML na `pmackowka@gmail.com` z linkami, tytułami PL/EN, punktami i streszczeniami
- **Output:** Data Table "HN Top 5 - Artykuly" (ID: `Iy9nbjya69dnFGOf`), 8 kolumn: `tytul_pl`, `tytul_en`, `url`, `punkty`, `autor`, `komentarze`, `data`, `streszczenie_pl`
- **Kredencjały:** Google Gemini (AI Studio) przez `@n8n/n8n-nodes-langchain.googleGemini`, Gmail account (GCP) przez `gmailOAuth2`
- **Kod źródłowy:** `workflows/hn-top5/workflow.ts`
- **Data dodania:** 2026-05-10 (przebudowany 2026-05-12)

### 6. HN Top 10 — poniedziałek 09:30
- **Źródło:** Fork z #5 (HN Top 5)
- **Struktura:** Schedule → HTTP (topstories) → HTTP (detale HN ×500, batch 10) → Code (filtr+ranking) → HTTP (tłumaczenie ×10) → Google Gemini (streszczenie ×10) → Code (formatowanie) → Data Table (zapis) → Code (HTML email) → Gmail (wysyłka)
- **Trigger:** Co poniedziałek o 09:30
- **Filtrowane frazy:** opencode, cloud code, openrouter, openai, codex, antigravity, warpdotdev, gemini, stape_io, n8n
- **Wyszukiwanie:** Top 500 HN → fetch szczegółów wszystkich 500 (batch 10) → filtr po tytułach → sort po score → top **10**
- **Tłumaczenie:** MyMemory API (EN→PL), z fallbackiem do oryginalnego tytułu
- **Streszczenie:** Google Gemini (`text:message`, model domyślny, `urlContext: true`) generuje 2-3 zdaniowe polskie podsumowanie każdego artykułu
- **E-mail:** Gmail (`n8n-nodes-base.gmail`) wysyła sformatowany HTML na `pmackowka@gmail.com` z linkami, tytułami PL/EN, punktami i streszczeniami
- **Output:** Data Table (nowa tabela dla top 10)
- **Kredencjały:** Google Gemini (AI Studio) przez `@n8n/n8n-nodes-langchain.googleGemini`, Gmail account (GCP) przez `gmailOAuth2`
- **Kod źródłowy:** `workflows/hn-top10/workflow.ts`
- **Data dodania:** 2026-05-13

---

## Zmiany

| Data | Opis |
|---|---|---|
| 2026-05-13 | Dodano #6: HN Top 10 — fork z #5, top 5→10, nowa Data Table. |
| 2026-05-13 | Przebudowano #5: dodano wysyłkę e-mail przez Gmail. 8→10 nodów. Code node buduje HTML z 5 artykułów, Gmail wysyła na pmackowka@gmail.com. |
| 2026-05-12 | Przebudowano #5: dodano Google Gemini do generowania polskich streszczeń artykułów (`urlContext`). 7→8 nodów. Dodano kolumnę `streszczenie_pl` do Data Table. |
| 2026-05-10 | Dodano #5: HN Top 5 — poniedziałek 09:30. Stworzony przez MCP. |
| 2026-05-10 | Przebudowano #5: 4→8 nodów. Naprawiono: parametry HTTP pod `parameters`, `rule` w `parameters` trigera, Code node z `mode`/`jsCode` zamiast `executeOnce`/`code`, dodano HTTP Request zamiast `$http` w kodzie, dodano Data Table i tłumaczenie przez MyMemory. |
| 2026-05-08 | Rozszerzono o wszystkie 4 workflowy. Dodano szczegóły konfiguracji. |
| 2026-05-07 | Utworzono plik. Dodano szablon #1: Query GA4 with Gemini in Slack |
