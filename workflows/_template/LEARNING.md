# Szablon workflow n8n

Ten folder zawiera szablon do tworzenia nowych workflowów przy użyciu `@n8n/workflow-sdk`.

## Jak użyć

1. Skopiuj folder `_template` do nowej nazwy:

```bash
cp -r workflows/_template workflows/moj-nowy-workflow
```

2. Otwórz `workflows/moj-nowy-workflow/workflow.ts` i dostosuj go.

3. Przed zapisem kodu zawsze waliduj przez MCP:

```bash
# Wyślij workflow do validate_workflow przez MCP
```

4. Po walidacji utwórz workflow przez `create_workflow_from_code` lub zaktualizuj istniejący przez `update_workflow`.

5. Zarejestruj nowy workflow w `TEMPLATES.md`.

## Importy SDK

Podstawowe importy dostępne w `@n8n/workflow-sdk`:

- `workflow` — definiuje workflow z ID i nazwą
- `node` — definiuje pojedynczy węzeł
- `trigger` — definiuje węzeł triggera (schedule, webhook, manual itp.)
- `expr` — oznacza wyrażenie n8n (`{{ ... }}`)
- `newCredential` — referencja do istniejącego kredencjału w n8n
- `splitInBatches`, `nextBatch` — przetwarzanie wsadowe
- `languageModel`, `memory`, `tool`, `outputParser` — węzły LangChain
- `ifElse`, `switchCase`, `merge` — rozgałęzienia i scalanie
- `fromAi` — parametry wypełniane przez AI
- `sticky`, `placeholder` — notatki wizualne

## Struktura pliku

1. Definicje triggerów
2. Definicje nodów
3. Definicje subnodów (modele, tool/e, pamięć)
4. Kompozycja workflow przez `.add().to().to()...`
