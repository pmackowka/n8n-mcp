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

## Dokumentacja

- https://docs.n8n.io/advanced-ai/mcp/accessing-n8n-mcp-server/
- https://blog.n8n.io/n8n-mcp-server/
