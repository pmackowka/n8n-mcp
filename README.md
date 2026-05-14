# n8n-MCP — Połączenie MCP z instancją n8n

## Instrukcja dla modelu językowego

```text
Ten projekt łączy model językowy z instancją n8n przez protokół MCP.
Aby korzystać z narzędzi n8n, wykonaj poniższe kroki:

1. Odczytać konfigurację MCP z pliku opencode.json w katalogu głównym
2. Użyć natywnego mechanizmu MCP klienta do wywołania narzędzi n8n
3. Przed stworzeniem workflowa wywołać get_sdk_reference aby poznać SDK
4. Przed zapisem kodu użyć search_nodes i get_node_types dla parametrów
5. Zawsze walidować kod przez validate_workflow przed create_workflow_from_code
6. URL i token MCP: zmienne środowiskowe N8N_MCP_URL i N8N_MCP_TOKEN

Dokumentacja: https://docs.n8n.io/advanced-ai/mcp/accessing-n8n-mcp-server/
```

Projekt konfigurujący połączenie między klientem MCP (OpenCode / DeepSeek) a instancją n8n przez protokół MCP (Model Context Protocol) z transportem HTTP.

Zasady dla agenta AI znajdują się w `AGENTS.md` (automatycznie wczytywany przez OpenCode).

## Dokumentacja

- [Oficjalna dokumentacja n8n MCP Server](https://docs.n8n.io/advanced-ai/mcp/accessing-n8n-mcp-server/)
- [Blog n8n — Build and Update Workflows with n8n's MCP Server](https://blog.n8n.io/n8n-mcp-server/)

## Konfiguracja połączenia

Połączenie MCP jest zdefiniowane w `opencode.json`. OpenCode wczytuje go automatycznie przy starcie w tym katalogu.

### Pliki konfiguracyjne

| Plik | Wersjonowany | Zawartość |
|---|---|---|
| `opencode.json` | ✅ tak | Definicja MCP servera (typ, URL przez `{file:}`, nagłówki) |
| `.n8n/url` | ❌ nie (gitignored) | Adres URL serwera MCP n8n |
| `.n8n/token` | ❌ nie (gitignored) | Token autoryzacyjny Bearer |
| `.env` | ❌ nie (gitignored) | Kopia zapasowa URL + token w formacie zmiennych |

OpenCode używa składni `{file:ścieżka}` do odczytu wrażliwych danych bezpośrednio z plików — nie wymaga to ustawiania zmiennych środowiskowych. Wystarczy utworzyć pliki `.n8n/url` i `.n8n/token` z odpowiednimi wartościami.

## Subagent dokumentacji `@dok`

Po utworzeniu lub modyfikacji workflowa, zaktualizuj dokumentację za pomocą dedykowanego subagenta:

```
@dok zaktualizuj dokumentację po zmianach w workflowie <nazwa>
```

Subagent `@dok` (czyt. *dok*) automatycznie:
1. Czyta kod źródłowy workflowa (`workflows/<nazwa>/workflow.ts`)
2. Aktualizuje rejestr w `TEMPLATES.md`
3. Tworzy/aktualizuje `workflows/<nazwa>/LEARNING.md` (architektura, węzły, parametry)
4. Dodaje wpisy do `AGENTS.md` (jeśli napotkano problemy i znaleziono rozwiązania)

**Przykładowy przepływ pracy:**
```
Ty: "Stwórz workflow X, który robi Y"
→ Build (domyślny agent) tworzy, waliduje i deployuje workflow

Ty: "@dok zaktualizuj dokumentację"
→ Dok subagent aktualizuje TEMPLATES.md, LEARNING.md, AGENTS.md
```

## Narzędzia MCP (25 tooli)

| Narzędzie | Opis |
|---|---|
| **search_workflows** | Szuka workflowów z opcjonalnymi filtrami. Zwraca podgląd każdego workflowu. |
| **execute_workflow** | Uruchamia workflow po ID w trybie manual lub production. Zwraca ID wykonania natychmiast. |
| **get_execution** | Pobiera szczegóły wykonania po ID workflow i ID egzekucji. Domyślnie zwraca tylko metadane. |
| **get_workflow_details** | Zwraca szczegółowe informacje o workflowie, w tym strukturę nodów i triggery. |
| **publish_workflow** | Publikuje (aktywuje) workflow do wykonań produkcyjnych. Tworzy wersję aktywną z obecnego draftu. |
| **unpublish_workflow** | Dezaktywuje workflow, zatrzymując jego wykonywanie produkcyjne. |
| **prepare_test_pin_data** | Generuje schematy JSON dla danych testowych workflowa. Zwraca oczekiwane struktury wyjściowe dla nodów wymagających pin dane. |
| **test_workflow** | Testuje workflow z użyciem pin danych, omijając zewnętrzne serwisy. Nody trigger i credential-based są pinowane. |
| **search_data_tables** | Szuka tabel danych dostępnych dla bieżącego użytkownika. Użyj, aby znaleźć ID tabeli przed modyfikacją. |
| **create_data_table** | Tworzy nową tabelę danych z określonymi kolumnami w projekcie. Wymaga ID projektu. |
| **rename_data_table** | Zmienia nazwę istniejącej tabeli danych. |
| **add_data_table_column** | Dodaje nową kolumnę do istniejącej tabeli danych. Określa nazwę, typ i docelową tabelę. |
| **delete_data_table_column** | Trwale usuwa kolumnę i wszystkie jej dane z tabeli. |
| **rename_data_table_column** | Zmienia nazwę istniejącej kolumny w tabeli danych. |
| **add_data_table_rows** | Wstawia wiersze do tabeli danych. Każdy wiersz mapuje nazwy kolumn na wartości, max 1000 na wywołanie. |
| **search_nodes** | Szuka nodów n8n po nazwie serwisu, typie triggera lub funkcji. Zwraca ID i dyskryminatory. |
| **get_node_types** | Pobiera definicje TypeScript dla nodów n8n. Wywołaj przed pisaniem kodu workflow, aby poznać nazwy parametrów. |
| **get_suggested_nodes** | Zwraca rekomendacje nodów dla kategorii workflow. Podpowiada wzorce i wskazówki konfiguracyjne. |
| **validate_workflow** | Waliduje kod SDK n8n przed utworzeniem workflowu. Zwraca błędy lub sparsowany JSON workflowu. |
| **create_workflow_from_code** | Tworzy workflow w n8n z zwalidowanego kodu SDK. Zawsze najpierw użyj validate_workflow. |
| **search_projects** | Szuka projektów dostępnych dla użytkownika. Filtruje po nazwie lub typie (personal/team). |
| **search_folders** | Szuka folderów w ramach projektu. Najpierw użyj search_projects, aby znaleźć ID projektu. |
| **archive_workflow** | Archiwizuje workflow po ID. Usuwa go z listy aktywnych workflowów. |
| **update_workflow** | Aktualizuje istniejący workflow z zwalidowanego kodu SDK. Zawsze waliduj przed aktualizacją. |
| **get_sdk_reference** | Pobiera dokumentację referencyjną SDK n8n. Wywołaj najpierw, aby poznać wzorce i składnię. |
