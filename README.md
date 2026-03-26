# Pi RustDex Extension

A Pi extension that teaches the agent to use [RustDex](https://github.com/burggraf/rustdex): a fast local code index for symbol lookup, semantic search, route extraction, and token-efficient source reads.

The practical point is simple: instead of the model blindly grepping its way through a repo like a raccoon in a server room, RustDex gives it a proper index and a sane workflow.

> **Prompt integration note:** As of Pi v0.59.0+, custom tools only appear in the default `Available tools` system-prompt section when they provide `promptSnippet`. This extension now defines both `promptSnippet` and `promptGuidelines` so the RustDex tools are not merely available, but actively advertised to the model.

## What this gives Pi

- Exact symbol lookup across indexed repositories
- Semantic code search from natural-language questions
- HTTP route extraction for supported web frameworks
- Token-efficient symbol reads using byte ranges instead of full-file reads
- Repo discovery via a list of indexed repositories
- Automatic indexing of the current project when a Pi session starts
- Background watch mode so the index stays fresh while you work

## Default model workflow

This is the workflow the extension now nudges the model toward:

1. If the repo name is unknown, call `rustdex_list_repos`.
2. If the target repo has not been indexed, call `rustdex_index` with an absolute path.
3. If the user knows an exact identifier, call `rustdex_search`.
4. If the user describes behavior or intent, call `rustdex_semantic`.
5. If the user wants API surface or endpoint discovery, call `rustdex_routes`.
6. After search results come back, call `rustdex_read_symbol` with the returned byte range to read the exact symbol body efficiently.

That combo is what makes the tools genuinely useful instead of decorative.

## Tools

### `rustdex_index`

Indexes a local codebase so the other RustDex tools can operate.

Use when:
- the project has not been indexed yet
- the user wants RustDex-powered search over a local repo
- you need semantic search, symbol search, or route extraction for a repo that is not ready yet

Key parameter:
- `project_path`: absolute path to the project directory

### `rustdex_list_repos`

Lists repositories already indexed by RustDex.

Use when:
- you need a valid `repo` value for another RustDex tool
- the user asks about multiple indexed repositories
- the indexed repo name is unclear

### `rustdex_search`

Finds functions, classes, or methods by exact name.

Use when:
- the user gives you a concrete identifier like `validate_user`, `AuthService`, or `handleRetry`
- you want exact symbol matches instead of fuzzy behavior matches

Best follow-up:
- pass the returned `file`, `start_byte`, and `end_byte` into `rustdex_read_symbol`

### `rustdex_semantic`

Searches code by meaning using natural-language embeddings.

Use when:
- the user asks questions like “where do we handle auth?”
- the task is about behavior, architecture, or intent rather than an exact name
- you want a shortlist of relevant code without guessing filenames first

Best follow-up:
- inspect the strongest hits with `rustdex_read_symbol`

### `rustdex_routes`

Extracts HTTP routes from supported frameworks.

Use when:
- the user asks for the API surface of a service
- you need to find where an endpoint is handled
- you want to map routes faster than ad-hoc text search

### `rustdex_read_symbol`

Reads the exact source for a symbol using byte ranges returned by RustDex search tools.

Use when:
- you already have a RustDex result and want the exact symbol body
- you want a token-efficient read instead of opening the whole file
- you are chaining from `rustdex_search` or `rustdex_semantic`

## Install

### Recommended

```bash
pi install npm:pi-rustdex
```

That installs the Pi extension. The package also checks for the RustDex binary during install.

After installation, verify it in Pi with:

```text
/rustdex-status
```

## How startup indexing works

When a Pi session starts in a project with this extension enabled:

- the extension checks whether the `rustdex` binary is available
- it indexes the current working directory
- it shows indexing progress in the status bar
- if indexing succeeds, it starts `rustdex watch` in the background

This means the current repo is usually ready before the model needs to search it.

## Example prompts where RustDex should win

- “Where do we validate OAuth callbacks in this repo?”
- “Show me the retry logic for failed webhooks.”
- “Find the `AuthService` class.”
- “What routes does this FastAPI app expose?”
- “Read the implementation of the symbol you just found.”

In those cases, the ideal sequence is usually RustDex first, broad file reads second.

## Manual RustDex binary management

If you need to install the binary yourself:

```bash
npm install -g rustdex
```

Check the version with:

```bash
rustdex --version
```

## Project configuration

You can enable the extension in a project through `pi.json`:

```json
{
  "extensions": ["npm:pi-rustdex"]
}
```

## API reference

For per-tool parameters, return shapes, and examples, see [docs/api-reference.md](docs/api-reference.md).

## Contributor note

If you maintain this extension, keep `promptSnippet` and `promptGuidelines` on the registered tools unless you are deliberately changing model behavior.

Why this matters:
- `promptSnippet` is what gets a custom tool into Pi’s default `Available tools` prompt section
- `promptGuidelines` is what nudges the model toward the intended RustDex workflow once the tool is active

If you remove those fields, the tools still exist, but the model gets less steering and is less likely to reach for them by default.

## Acknowledgment

RustDex is a Rust reimplementation inspired by [SymDex](https://github.com/husnainpk/SymDex). SymDex proved the shape of the idea; RustDex makes it fast, local, and cross-platform.