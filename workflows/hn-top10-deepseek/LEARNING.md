# HN Top 10 — codziennie 08:00 (DeepSeek)

Eksperymentalny fork workflow #4 (Gemini) — zamienia Google Gemini na DeepSeek Chat Model przez AI Agent. Identyczna struktura poza modelami AI.

## Architektura

```
Schedule (daily 08:00)
  → HTTP: Pobierz top stories HN (lista 500 ID)
  → HTTP: Pobierz detale HN (szczegóły 500 artykułów, batch po 10)
  → Code: Filtruj i ranking (słowa kluczowe → top 10 po score)
  → splitInBatches(1) ──┬── onEachBatch ─────────────────────────┐
                         │  → HTTP: Tlumacz tytul (MyMemory)      │
                         │  → AI Agent: Generuj streszczenie (DS) │
                         │  → nextBatch                            │
                         ├── onDone ──────────────────────────────┤
                         │  → Code: Formatuj wyniki                │
                         │  → Data Table: Zapisz do tabeli         │
                         │  → Code: Buduj HTML email               │
                         │  → Gmail: Wyslij email                  │
                         └────────────────────────────────────────┘
```

## Węzły (12)

| # | Nazwa | Typ | Opis |
|---|---|---|---|
| 1 | Codziennie 08:00 | Schedule Trigger | Odpala workflow codziennie o 08:00 |
| 2 | Pobierz top stories HN | HTTP Request | GET `https://hacker-news.firebaseio.com/v0/topstories.json` |
| 3 | Pobierz detale HN | HTTP Request | GET każdego ID z batch 10, interval 200ms |
| 4 | Filtruj i ranking | Code | Filtruje po 10 słowach kluczowych, sortuje, top 10 |
| 5 | Przetwarzaj po 1 | splitInBatches | Batch size: 1 |
| 6 | Tlumacz tytul | HTTP Request | MyMemory API EN→PL |
| 7 | Generuj streszczenie (DS) | AI Agent | DeepSeek (`deepseek-chat`, temp 0.4) przez AI Agent |
| 8 | — (subnode) | DeepSeek Model | languageModel `@n8n/n8n-nodes-langchain.lmChatDeepSeek` |
| 9 | Formatuj wyniki | Code | Łączy dane z tłumaczenia, oryginałów i streszczeń |
| 10 | Zapisz do tabeli | Data Table | Zapisuje do tabeli `Iy9nbjya69dnFGOf` |
| 11 | Buduj HTML email | Code | Generuje HTML z dopiskiem "(DeepSeek)" |
| 12 | Wyslij email | Gmail | Wysyła na `pmackowka@gmail.com` |

## Różnice vs #4 (Gemini)

| Aspekt | Gemini (#4) | DeepSeek (#5) |
|---|---|---|
| Model | `@n8n/n8n-nodes-langchain.googleGemini` (text/message) | `@n8n/n8n-nodes-langchain.lmChatDeepSeek` przez AI Agent |
| Temperatura | 0.4 | 0.4 |
| `urlContext` | ✅ Tak (model czyta treść z URL) | ❌ Nie (DeepSeek nie wspiera) |
| Wait między callami | 20s (limit 5 req/min) | Brak (wyższe limity API) |
| Prompt | Wbudowany w node Gemini | `systemMessage` w AI Agent + `text` jako user prompt |
| Output format | `content.parts[0].text` | `output` |
| Email | "HN Top 10 — data" | "HN Top 10 — data (DeepSeek)" |
| Wymaga płatności | ❌ (darmowy tier) | ✅ (konto z saldem) |

## Uwaga

Workflow wymaga opłaconego konta DeepSeek (API klucz z dodatnim saldem). Bez tego modele nie odpowiadają.

## Kredencjały

- **DeepSeek** — przez `deepSeekApi` w `@n8n/n8n-nodes-langchain.lmChatDeepSeek`
- **Gmail account (GCP)** — przez `gmailOAuth2`

## Kod źródłowy

`workflows/hn-top10-deepseek/workflow.ts`
