import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { spawnSync } from "node:child_process";
import * as path from "node:path";

/**
 * Execute rustdex command and return parsed JSON result
 */
function runRustDex(
  args: string[],
  cwd?: string
): { success: boolean; output: any; error?: string } {
  try {
    const result = spawnSync("rustdex", args, {
      encoding: "utf-8",
      cwd: cwd || process.cwd(),
      timeout: 120000, // 2 minutes for indexing operations
    });

    if (result.error) {
      return { success: false, output: null, error: result.error.message };
    }

    if (result.status !== 0) {
      return {
        success: false,
        output: null,
        error: result.stderr || `Exit code: ${result.status}`,
      };
    }

    // Try to parse as JSON, fallback to text
    let output: any;
    try {
      output = JSON.parse(result.stdout);
    } catch {
      output = result.stdout.trim();
    }

    return { success: true, output };
  } catch (e: any) {
    return { success: false, output: null, error: e.message };
  }
}

/**
 * Check if rustdex binary is available
 */
function isRustDexAvailable(): boolean {
  const cmd = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(cmd, ["rustdex"], { encoding: "utf-8" });
  return result.status === 0;
}

export default function (pi: ExtensionAPI) {
  // Check rustdex availability on startup
  pi.on("session_start", async (_event, ctx) => {
    if (!isRustDexAvailable()) {
      ctx.ui.notify(
        "RustDex not found. Install from https://github.com/burggraf/rustdex",
        "warning"
      );
    } else {
      ctx.ui.setStatus("pi-rustdex", "RustDex Ready");
    }
  });

  // Register: rustdex_index - Index a codebase
  pi.registerTool({
    name: "rustdex_index",
    label: "Index Codebase",
    description:
      "Index a codebase with RustDex for symbol search and semantic search. Creates a local SQLite database with symbol metadata and embeddings.",
    parameters: Type.Object({
      project_path: Type.String({
        description: "Absolute path to the project directory to index",
      }),
      name: Type.Optional(
        Type.String({
          description:
            "Name for the index (defaults to folder name if omitted)",
        })
      ),
    }),
    async execute(toolCallId, params: any, signal, onUpdate, ctx) {
      if (!isRustDexAvailable()) {
        throw new Error(
          "rustdex binary not found. Install from https://github.com/burggraf/rustdex"
        );
      }

      const args = ["index", params.project_path, "--json"];
      if (params.name) {
        args.push("--name", params.name);
      }

      onUpdate({
        content: [{ type: "text", text: `Indexing ${params.project_path}...` }],
      });

      const result = runRustDex(args);

      if (!result.success) {
        throw new Error(`Failed to index: ${result.error}`);
      }

      return {
        content: [
          {
            type: "text",
            text: `Successfully indexed ${params.project_path}.`,
          },
        ],
        details: result.output,
      };
    },
  });

  // Register: rustdex_search - Search for symbols
  pi.registerTool({
    name: "rustdex_search",
    label: "Search Symbols",
    description:
      "Search for functions, classes, or methods by exact name across an indexed repository.",
    parameters: Type.Object({
      query: Type.String({
        description: "Symbol name to search for (e.g., 'validate_user')",
      }),
      repo: Type.String({
        description: "Repository name (from rustdex_index)",
      }),
    }),
    async execute(toolCallId, params: any, signal, onUpdate, ctx) {
      if (!isRustDexAvailable()) {
        throw new Error("rustdex binary not found");
      }

      const args = ["search", params.query, "--repo", params.repo, "--json"];
      const result = runRustDex(args);

      if (!result.success) {
        throw new Error(`Search failed: ${result.error}`);
      }

      const results = Array.isArray(result.output) ? result.output : [];

      if (results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No symbols found matching "${params.query}" in ${params.repo}.`,
            },
          ],
          details: { results: [], query: params.query, repo: params.repo },
        };
      }

      // Format results for display
      const formatted = results
        .map(
          (r: any, i: number) =>
            `${i + 1}. **${r.name}** (${r.kind})\n   File: ${r.file}:${r.line}\n   Byte range: ${r.start_byte}-${r.end_byte}`
        )
        .join("\n\n");

      return {
        content: [
          {
            type: "text",
            text: `Found ${results.length} symbol(s) matching "${params.query}" in ${params.repo}:\n\n${formatted}`,
          },
        ],
        details: { results, query: params.query, repo: params.repo },
      };
    },
  });

  // Register: rustdex_semantic - Semantic search
  pi.registerTool({
    name: "rustdex_semantic",
    label: "Semantic Search",
    description:
      "Search code by natural language description using local BERT embeddings (e.g., 'how do we handle password hashing').",
    parameters: Type.Object({
      query: Type.String({
        description: "Natural language query (e.g., 'user authentication logic')",
      }),
      repo: Type.String({
        description: "Repository name (from rustdex_index)",
      }),
      limit: Type.Optional(
        Type.Number({
          default: 10,
          description: "Maximum number of results to return",
        })
      ),
    }),
    async execute(toolCallId, params: any, signal, onUpdate, ctx) {
      if (!isRustDexAvailable()) {
        throw new Error("rustdex binary not found");
      }

      const args = [
        "semantic",
        params.query,
        "--repo",
        params.repo,
        "--json",
      ];

      onUpdate({
        content: [
          {
            type: "text",
            text: `Running semantic search for "${params.query}"...`,
          },
        ],
      });

      const result = runRustDex(args);

      if (!result.success) {
        throw new Error(`Semantic search failed: ${result.error}`);
      }

      const results = Array.isArray(result.output) ? result.output : [];
      const limited = results.slice(0, params.limit || 10);

      if (limited.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No results found for "${params.query}" in ${params.repo}.`,
            },
          ],
          details: { results: [], query: params.query, repo: params.repo },
        };
      }

      // Format results with similarity scores
      const formatted = limited
        .map(
          (r: any, i: number) =>
            `${i + 1}. **${r.name}** (${r.kind}) - Score: ${(r.score * 100).toFixed(1)}%\n   File: ${r.file}:${r.line}\n   Byte range: ${r.start_byte}-${r.end_byte}`
        )
        .join("\n\n");

      return {
        content: [
          {
            type: "text",
            text: `Found ${limited.length} result(s) for "${params.query}" in ${params.repo}:\n\n${formatted}`,
          },
        ],
        details: {
          results: limited,
          query: params.query,
          repo: params.repo,
        },
      };
    },
  });

  // Register: rustdex_routes - Extract HTTP routes
  pi.registerTool({
    name: "rustdex_routes",
    label: "Extract API Routes",
    description:
      "Extract HTTP routes from web frameworks (Flask, FastAPI, Django, Express) in an indexed repository.",
    parameters: Type.Object({
      repo: Type.String({
        description: "Repository name (from rustdex_index)",
      }),
      method: Type.Optional(
        Type.String({
          description: "Filter by HTTP method (GET, POST, PUT, DELETE, etc.)",
        })
      ),
    }),
    async execute(toolCallId, params: any, signal, onUpdate, ctx) {
      if (!isRustDexAvailable()) {
        throw new Error("rustdex binary not found");
      }

      const args = ["routes", params.repo, "--json"];
      if (params.method) {
        args.push("--method", params.method.toUpperCase());
      }

      const result = runRustDex(args);

      if (!result.success) {
        throw new Error(`Route extraction failed: ${result.error}`);
      }

      const results = Array.isArray(result.output) ? result.output : [];

      if (results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No HTTP routes found in ${params.repo}${
                params.method ? ` for method ${params.method}` : ""
              }.`,
            },
          ],
          details: { routes: [], repo: params.repo },
        };
      }

      // Group by file for display
      const byFile: Record<string, any[]> = {};
      for (const r of results) {
        if (!byFile[r.file]) byFile[r.file] = [];
        byFile[r.file].push(r);
      }

      const formatted = Object.entries(byFile)
        .map(([file, routes]) => {
          const routeList = routes
            .map((r) => `  ${r.method} ${r.path} (line ${r.line})`)
            .join("\n");
          return `**${file}**:\n${routeList}`;
        })
        .join("\n\n");

      return {
        content: [
          {
            type: "text",
            text: `Found ${results.length} HTTP route(s) in ${params.repo}:\n\n${formatted}`,
          },
        ],
        details: { routes: results, repo: params.repo },
      };
    },
  });

  // Register: rustdex_list_repos - List indexed repositories
  pi.registerTool({
    name: "rustdex_list_repos",
    label: "List Indexed Repos",
    description:
      "List all repositories that have been indexed by RustDex.",
    parameters: Type.Object({}),
    async execute(toolCallId, params: any, signal, onUpdate, ctx) {
      if (!isRustDexAvailable()) {
        throw new Error("rustdex binary not found");
      }

      const result = runRustDex(["list-repos", "--json"]);

      if (!result.success) {
        throw new Error(`Failed to list repos: ${result.error}`);
      }

      const repos = Array.isArray(result.output) ? result.output : [];

      if (repos.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No indexed repositories found. Use rustdex_index to index a codebase.",
            },
          ],
          details: { repos: [] },
        };
      }

      const formatted = repos
        .map(
          (r: any, i: number) =>
            `${i + 1}. **${r.name}**\n   Path: ${r.path}\n   Indexed: ${r.indexed_at || "Unknown"}`
        )
        .join("\n\n");

      return {
        content: [
          {
            type: "text",
            text: `${repos.length} indexed repository(ies):\n\n${formatted}`,
          },
        ],
        details: { repos },
      };
    },
  });

  // Register: rustdex_read_symbol - Read symbol content by byte range
  pi.registerTool({
    name: "rustdex_read_symbol",
    label: "Read Symbol",
    description:
      "Read the actual source code of a symbol using its file path and byte range (from search results).",
    parameters: Type.Object({
      file: Type.String({
        description: "Absolute path to the source file",
      }),
      start_byte: Type.Number({
        description: "Start byte offset",
      }),
      end_byte: Type.Number({
        description: "End byte offset",
      }),
    }),
    async execute(toolCallId, params: any, signal, onUpdate, ctx) {
      const fs = await import("node:fs");

      if (!fs.existsSync(params.file)) {
        throw new Error(`File not found: ${params.file}`);
      }

      const content = fs.readFileSync(params.file, "utf-8");
      const slice = content.slice(params.start_byte, params.end_byte);

      // Get line numbers for context
      const linesBefore = content.slice(0, params.start_byte).split("\n");
      const startLine = linesBefore.length;

      return {
        content: [
          {
            type: "text",
            text: `**${params.file}:${startLine}**\n\n\`\`\`\n${slice}\n\`\`\``,
          },
        ],
        details: {
          file: params.file,
          start_byte: params.start_byte,
          end_byte: params.end_byte,
          start_line: startLine,
          content: slice,
        },
      };
    },
  });

  // Register command: /rustdex-status
  pi.registerCommand("rustdex-status", {
    description: "Check RustDex installation status",
    handler: async (args, ctx) => {
      if (isRustDexAvailable()) {
        const version = runRustDex(["--version"]);
        ctx.ui.notify(
          `RustDex is installed${
            version.success ? `: ${version.output}` : ""
          }`,
          "info"
        );
      } else {
        ctx.ui.notify(
          "RustDex not found. Install from https://github.com/burggraf/rustdex",
          "error"
        );
      }
    },
  });
}
