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
| 5 | **HN Top 5 — poniedziałek 09:30** | `6jZjcgs6k9yOrO7k` | Schedule Trigger | 4 | brak | 2026-05-10 |

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
- **Struktura:** Schedule → HTTP (topstories) → Code (fetch+filter) → Code (translate)
- **Trigger:** Co poniedziałek o 09:30
- **Filtrowane frazy:** OpenCode, Cloud Code, OpenRouter, OpenAI Codex, Antigravity, @warpdotdev, Gemini CLI, @stape_io, n8n
- **Wyszukiwanie:** Top 50 HN stories → szczegóły → filtr po tytułach → sort po score → top 5
- **Tłumaczenie:** Tytuły pozostawione w oryginale (EN), struktura danych w języku polskim
- **Output:** Węzeł NoOp (gotowy do podłączenia Data Table)
- **Kod źródłowy:** `workflows/hn-top5/workflow.ts`
- **Data dodania:** 2026-05-10

---

## Zmiany

| Data | Opis |
|---|---|---|
| 2026-05-10 | Dodano #5: HN Top 5 — poniedziałek 09:30. Stworzony przez MCP. |
| 2026-05-08 | Rozszerzono o wszystkie 4 workflowy. Dodano szczegóły konfiguracji. |
| 2026-05-07 | Utworzono plik. Dodano szablon #1: Query GA4 with Gemini in Slack |
