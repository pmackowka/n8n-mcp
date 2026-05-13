# HN Top 10 — codziennie 08:00 (Gemini)

Codzienny workflow pobierający top 10 artykułów z Hacker News, tłumaczący tytuły na polski, generujący streszczenia przez Google Gemini i wysyłający je mailem.

## Architektura

```
Schedule (daily 08:00)
  → HTTP: Pobierz top stories HN (lista 500 ID)
  → HTTP: Pobierz detale HN (szczegóły 500 artykułów, batch po 10)
  → Code: Filtruj i ranking (słowa kluczowe → top 10 po score)
  → splitInBatches(1) ──┬── onEachBatch ──────────────────────┐
                         │  → HTTP: Tlumacz tytul (MyMemory)   │
                         │  → Wait: Odczekaj 20s               │
                         │  → Gemini: Generuj streszczenie     │
                         │  → nextBatch                         │
                         ├── onDone ───────────────────────────┤
                         │  → Code: Formatuj wyniki             │
                         │  → Data Table: Zapisz do tabeli      │
                         │  → Code: Buduj HTML email            │
                         │  → Gmail: Wyslij email               │
                         └─────────────────────────────────────┘
```

## Węzły (12)

| # | Nazwa | Typ | Opis |
|---|---|---|---|
| 1 | Codziennie 08:00 | Schedule Trigger | Odpala workflow codziennie o 08:00 |
| 2 | Pobierz top stories HN | HTTP Request | GET `https://hacker-news.firebaseio.com/v0/topstories.json` — zwraca listę ~500 ID |
| 3 | Pobierz detale HN | HTTP Request | GET każdego ID z batch 10, interval 200ms — pobiera title, score, author, url |
| 4 | Filtruj i ranking | Code | Filtruje po 10 słowach kluczowych, sortuje po score, bierze top 10 |
| 5 | Przetwarzaj po 1 | splitInBatches | Batch size: 1 — przetwarza każdy artykuł osobno |
| 6 | Tlumacz tytul | HTTP Request | MyMemory API — tłumaczy tytuł EN→PL z fallbackiem do oryginału |
| 7 | Odczekaj 20s | Wait | Wymuszony odstęp między Gemini callami (limit 5 req/min darmowego tieru) |
| 8 | Generuj streszczenie | Google Gemini | `urlContext: true` — model czyta artykuł z URL i generuje 2-3 zdania po polsku |
| 9 | Formatuj wyniki | Code | Łączy dane z tłumaczenia, oryginałów i streszczeń w jeden wynik |
| 10 | Zapisz do tabeli | Data Table | Zapisuje do tabeli `Iy9nbjya69dnFGOf` (8 kolumn) |
| 11 | Buduj HTML email | Code | Generuje sformatowany HTML z artykułami, linkami i streszczeniami |
| 12 | Wyslij email | Gmail | Wysyła HTML na `pmackowka@gmail.com` |

## Filtrowane frazy

`opencode`, `cloud code`, `openrouter`, `openai`, `codex`, `antigravity`, `warpdotdev`, `gemini`, `stape_io`, `n8n`

## Rate limiting (Gemini Free)

Darmowe konto Google AI Studio (gemini-2.0-flash) ma limit **5 requests/min/model**. Aby go obsłużyć:
- `splitInBatches(1)` przetwarza 1 artykuł na batch
- Wait 20s między Gemini callami = max 3 req/min, bezpiecznie poniżej limitu
- Całe 10 artykułów wykonuje się w ~2,5 min (10 × 15s delay + czas Gemini)

## Kredencjały

- **Google Gemini (AI Studio)** — przez `googlePalmApi` w `@n8n/n8n-nodes-langchain.googleGemini`
- **Gmail account (GCP)** — przez `gmailOAuth2` w `n8n-nodes-base.gmail`

## Output

Data Table `HN Top 5 - Artykuly` (ID: `Iy9nbjya69dnFGOf`) z kolumnami:
`tytul_pl`, `tytul_en`, `url`, `punkty`, `autor`, `komentarze`, `data`, `streszczenie_pl`

## Kod źródłowy

`workflows/hn-top10-gemini/workflow.ts`
