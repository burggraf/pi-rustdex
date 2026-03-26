# Pi RustDex API Reference

This document covers the LLM-callable tools exposed by the Pi RustDex extension, what each tool is for, and how they should be combined.

## Recommended usage pattern

Use the tools in this order when possible:

1. Call `rustdex_list_repos` if you do not know the indexed repo name.
2. Call `rustdex_index` if the target repo is not indexed yet.
3. Call one of:
   - `rustdex_search` for exact symbol names
   - `rustdex_semantic` for behavior, intent, or architecture questions
   - `rustdex_routes` for HTTP endpoint discovery
4. Call `rustdex_read_symbol` on promising results to inspect exact source with minimal tokens.

## Tool selection cheat sheet

| Task | Best tool |
|------|-----------|
| Find `AuthService` or `handleLogin` by name | `rustdex_search` |
| Find where auth, retry logic, or password hashing is handled | `rustdex_semantic` |
| List API endpoints or route handlers | `rustdex_routes` |
| Get an indexed repo name to use elsewhere | `rustdex_list_repos` |
| Prepare a new repo for RustDex search | `rustdex_index` |
| Read the exact source returned by a RustDex hit | `rustdex_read_symbol` |

## Tools

### `rustdex_index`

Indexes a codebase for symbol search, semantic search, and route extraction.

Use when:
- the repo has not been indexed yet
- the user wants RustDex-powered search over a local project
- you need to prepare a repo before using any other RustDex tool

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project_path` | string | Yes | Absolute path to the project directory to index |
| `name` | string | No | Optional repo name to store in RustDex |

#### Example

```json
{
  "project_path": "/workspace/my-app",
  "name": "my-app"
}
```

#### Returns

```ts
{
  content: [{ type: "text", text: string }],
  details: unknown
}
```

### `rustdex_list_repos`

Lists all repositories already indexed by RustDex.

Use when:
- you need to discover a valid `repo` name for later calls
- the user asks which repos are available
- a downstream RustDex call needs a `repo` and you do not know it yet

#### Parameters

None.

#### Returns

```ts
{
  content: [{ type: "text", text: string }],
  details: {
    repos: Array<{
      name: string;
      path: string;
      indexed_at?: string;
    }>;
  };
}
```

### `rustdex_search`

Searches indexed repositories by exact symbol name.

Use when:
- the user already knows the identifier
- you want precise matches for functions, methods, or classes
- semantic matching would be too fuzzy

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Exact symbol name to find |
| `repo` | string | Yes | Indexed repo name |

#### Example

```json
{
  "query": "handleRetry",
  "repo": "my-app"
}
```

#### Returns

```ts
{
  content: [{ type: "text", text: string }],
  details: {
    results: Array<{
      name: string;
      kind: string;
      file: string;
      line: number;
      start_byte: number;
      end_byte: number;
    }>;
    query: string;
    repo: string;
  };
}
```

#### Typical follow-up

Pass a result directly into `rustdex_read_symbol`:

```json
{
  "file": "/workspace/my-app/src/auth.ts",
  "start_byte": 1204,
  "end_byte": 1848
}
```

### `rustdex_semantic`

Searches indexed code by meaning using natural-language embeddings.

Use when:
- the user asks about behavior instead of exact names
- you are mapping implementation areas like auth, caching, retries, or validation
- you want likely relevant code without guessing filenames

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Natural-language search query |
| `repo` | string | Yes | Indexed repo name |
| `limit` | number | No | Maximum number of results to return |

#### Example

```json
{
  "query": "where do we validate password reset tokens",
  "repo": "my-app",
  "limit": 5
}
```

#### Returns

```ts
{
  content: [{ type: "text", text: string }],
  details: {
    results: Array<{
      name: string;
      kind: string;
      file: string;
      line: number;
      start_byte: number;
      end_byte: number;
      score: number;
    }>;
    query: string;
    repo: string;
  };
}
```

#### Typical follow-up

Inspect the strongest matches with `rustdex_read_symbol` rather than reading full files immediately.

### `rustdex_routes`

Extracts HTTP routes from supported web frameworks in an indexed repository.

Use when:
- the user asks for the API surface of a service
- you need route discovery faster than text search
- you want to find where a specific endpoint is handled

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `repo` | string | Yes | Indexed repo name |
| `method` | string | No | Optional HTTP method filter |

#### Example

```json
{
  "repo": "my-app",
  "method": "POST"
}
```

#### Returns

```ts
{
  content: [{ type: "text", text: string }],
  details: {
    routes: Array<{
      method: string;
      path: string;
      file: string;
      line: number;
      handler?: string;
    }>;
    repo: string;
  };
}
```

### `rustdex_read_symbol`

Reads the exact source code for a symbol using the byte range from a RustDex result.

Use when:
- you already have a search result from `rustdex_search` or `rustdex_semantic`
- you want the symbol body, not the whole file
- you want to minimize token usage when drilling into code

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file` | string | Yes | Absolute file path |
| `start_byte` | number | Yes | Start byte offset |
| `end_byte` | number | Yes | End byte offset |

#### Example

```json
{
  "file": "/workspace/my-app/src/auth.ts",
  "start_byte": 1204,
  "end_byte": 1848
}
```

#### Returns

```ts
{
  content: [{ type: "text", text: string }],
  details: {
    file: string;
    start_byte: number;
    end_byte: number;
    start_line: number;
    content: string;
  };
}
```

## Command

### `/rustdex-status`

Checks whether the `rustdex` binary is installed and available to the extension.

#### Usage

```text
/rustdex-status
```

## Model behavior guidance

These tools are most valuable when the model uses them proactively.

Good default instincts:
- use `rustdex_search` for exact identifiers
- use `rustdex_semantic` for conceptual questions
- use `rustdex_routes` for endpoint discovery
- use `rustdex_read_symbol` after search hits for efficient inspection
- use `rustdex_list_repos` when `repo` is unknown
- use `rustdex_index` when the repo is not ready yet

Bad default instincts:
- reading large files first when a symbol-range read would do
- using semantic search for exact identifiers
- guessing repo names instead of listing them
- doing ad-hoc route grep before trying `rustdex_routes`

## Example workflows

### Exact symbol workflow

1. `rustdex_search({ query: "AuthService", repo: "my-app" })`
2. `rustdex_read_symbol(...)` on the best result

### Behavior workflow

1. `rustdex_semantic({ query: "where do we handle retry backoff", repo: "my-app", limit: 5 })`
2. `rustdex_read_symbol(...)` on the top hits

### API discovery workflow

1. `rustdex_routes({ repo: "my-app" })`
2. Read the referenced files or symbols for the routes you care about

### Cold-start workflow

1. `rustdex_list_repos()`
2. If missing, `rustdex_index({ project_path: "/workspace/my-app" })`
3. Continue with search or route extraction