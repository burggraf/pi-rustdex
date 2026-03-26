import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Type } from "@mariozechner/pi-ai";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import * as path from "node:path";
import { createInterface } from "node:readline";

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

/** Apply orange truecolor to text for status bar */
function orange(text: string): string {
  return `\x1b[38;2;255;165;0m${text}\x1b[0m`;
}

export default function (pi: ExtensionAPI) {
  let watchProcess: ChildProcess | null = null;
  let indexProcess: ChildProcess | null = null;
  let isShuttingDown = false;

  /**
   * Spawn `rustdex index` asynchronously, streaming per-file progress
   * to the status bar. Returns a promise that resolves when indexing completes.
   */
  function runAsyncIndex(
    projectPath: string,
    ctx: ExtensionContext
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const args = ["index", projectPath];
      const proc = spawn("rustdex", args, {
        cwd: projectPath,
        stdio: ["ignore", "pipe", "pipe"],
      });
      indexProcess = proc;

      const rl = createInterface({ input: proc.stdout! });

      rl.on("line", (line: string) => {
        // Match "Indexing <file>..." lines
        const match = line.match(/^Indexing\s+(.+)\.\.\.$/);
        if (match) {
          const filePath = match[1];
          const basename = path.basename(filePath);
          ctx.ui.setStatus("pi-rustdex", orange(`Analyzing ${basename}...`));
        }
      });

      let stderrChunks: string[] = [];
      proc.stderr?.on("data", (data: Buffer) => {
        stderrChunks.push(data.toString());
      });

      proc.on("close", (code: number | null) => {
        indexProcess = null;
        if (code === 0) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: stderrChunks.join("") || `Exit code: ${code}` });
        }
      });

      proc.on("error", (err: Error) => {
        indexProcess = null;
        resolve({ success: false, error: err.message });
      });
    });
  }

  /**
   * Spawn `rustdex watch` as a long-running background process.
   * The returned ChildProcess is stored for cleanup on shutdown.
   */
  function spawnWatcher(projectPath: string): ChildProcess {
    const proc = spawn("rustdex", ["watch", projectPath], {
      cwd: projectPath,
      stdio: "ignore",
    });

    proc.on("error", () => {
      // Watcher failed to start or crashed — not critical
      if (watchProcess === proc) watchProcess = null;
    });

    proc.on("exit", () => {
      if (watchProcess === proc) watchProcess = null;
    });

    return proc;
  }

  /** Kill a child process gracefully (SIGTERM, then SIGKILL fallback) */
  function killProcess(proc: ChildProcess | null): void {
    if (!proc || proc.killed || proc.exitCode !== null) return;
    proc.kill("SIGTERM");
    // Force-kill after 2 seconds if still alive
    const forceKill = setTimeout(() => {
      if (!proc.killed && proc.exitCode === null) {
        proc.kill("SIGKILL");
      }
    }, 2000);
    forceKill.unref();
  }

  // Auto-index CWD on startup, then spawn watcher
  pi.on("session_start", async (_event, ctx) => {
    if (!isRustDexAvailable()) {
      ctx.ui.notify(
        "RustDex not found. Install from https://github.com/burggraf/rustdex",
        "warning"
      );
      return;
    }

    const projectPath = ctx.cwd;
    const theme = ctx.ui.theme;

    killProcess(watchProcess);
    watchProcess = null;

    // Show initial indexing status
    ctx.ui.setStatus("pi-rustdex", orange("Analyzing project..."));

    // Run index asynchronously with per-file progress
    const result = await runAsyncIndex(projectPath, ctx);

    if (isShuttingDown) return;

    if (result.success) {
      ctx.ui.setStatus("pi-rustdex", theme.fg("success", "RustDex Ready"));

      // Start the file watcher in the background
      watchProcess = spawnWatcher(projectPath);
    } else {
      ctx.ui.setStatus("pi-rustdex", theme.fg("warning", "RustDex Index Failed"));
      ctx.ui.notify(`RustDex indexing failed: ${result.error}`, "warning");
    }
  });

  // Clean up background processes on shutdown
  pi.on("session_shutdown", async (_event, _ctx) => {
    isShuttingDown = true;
    killProcess(watchProcess);
    killProcess(indexProcess);
    watchProcess = null;
    indexProcess = null;
  });

  // Register: rustdex_index - Index a codebase
  pi.registerTool({
    name: "rustdex_index",
    label: "Index Codebase",
    description:
      "Build a RustDex index for a local codebase so later RustDex queries can answer symbol, semantic, route, and source lookup requests directly instead of falling back to bash, grep, or manual file scanning.",
    promptSnippet:
      "Index this repository first when RustDex-powered code search is needed; this is the required setup step that enables richer results than bash search tools.",
    promptGuidelines: [
      "Use rustdex_index first when the repository is not yet indexed and the user wants code intelligence rather than raw shell output.",
      "Prefer rustdex_index over ad hoc bash preparation steps because it unlocks structured symbol search, semantic search, route extraction, and byte-range source reads for all later queries.",
      "Call rustdex_index before rustdex_search, rustdex_semantic, or rustdex_routes whenever the repo is new, moved, or likely out of date.",
      "Pass an absolute project path so the index is created for the correct local repository.",
    ],
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

      onUpdate?.({
        content: [{ type: "text", text: `Indexing ${params.project_path}...` }],
        details: {},
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
      "Find exact symbol definitions in an indexed repository by name, returning structured matches with file, line, kind, and byte ranges more reliably than grep, rg, or guessing through bash output.",
    promptSnippet:
      "Use this for exact identifier lookup when you know the function, class, method, or symbol name and want precise results instead of raw text matches.",
    promptGuidelines: [
      "Use rustdex_search when the user already knows the exact symbol name or is asking where a named function, class, or method is defined.",
      "Prefer rustdex_search over bash text search because it returns real symbol matches with kind, line, and byte ranges instead of ambiguous string hits in comments, tests, or unrelated files.",
      "Prefer rustdex_search over rustdex_semantic for exact identifiers such as validateUser, PaymentService, or handleRequest.",
      "After rustdex_search returns matches, use rustdex_read_symbol to inspect the specific symbol body without opening the whole file.",
    ],
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
      "Search an indexed repository by behavior, intent, or architecture using natural language so you can locate relevant code even when you do not know symbol names, file names, or exact text to grep for.",
    promptSnippet:
      "Use this when the request is phrased as what the code does rather than what the code is named; this should be the primary alternative to bash or rg for behavior-level discovery.",
    promptGuidelines: [
      "Use rustdex_semantic when the user describes behavior, workflows, responsibilities, or architecture instead of giving an exact identifier.",
      "Prefer rustdex_semantic over bash search for prompts like 'where do we handle auth', 'how is retry logic implemented', 'what validates passwords', or 'where is invoice generation done'.",
      "Use rustdex_semantic when exact text search would be weak because the implementation may use different names than the user's wording.",
      "After rustdex_semantic returns promising hits, use rustdex_read_symbol to inspect the best matches directly.",
    ],
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

      onUpdate?.({
        content: [
          {
            type: "text",
            text: `Running semantic search for "${params.query}"...`,
          },
        ],
        details: {},
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
      "Extract framework-defined HTTP routes from an indexed repository so endpoint discovery is based on parsed route metadata rather than fragile grep patterns over decorators, routers, or string literals.",
    promptSnippet:
      "Use this as the primary tool for API surface discovery or endpoint-to-handler lookup instead of bash text search through routing files.",
    promptGuidelines: [
      "Use rustdex_routes when the user wants the API surface area, route inventory, or the handler location for a specific HTTP endpoint.",
      "Prefer rustdex_routes over bash or rg when the task is 'show me the routes', 'where is POST /login handled', or 'list all GET endpoints', because route declarations vary by framework and are easy to miss with raw text search.",
      "Use the optional method filter when the user asks for a specific HTTP verb such as GET, POST, PUT, PATCH, or DELETE.",
      "If a returned route needs closer inspection, follow up by reading the referenced file or symbol.",
    ],
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
      "List every repository already indexed by RustDex so the agent can choose a valid repo target for other RustDex tools instead of guessing names or probing with shell commands.",
    promptSnippet:
      "Use this first when the correct RustDex repo name is unknown; it is the authoritative source for available indexes.",
    promptGuidelines: [
      "Use rustdex_list_repos when another RustDex tool needs a repo name and the available indexes are unknown or ambiguous.",
      "Prefer rustdex_list_repos over bash filesystem checks because RustDex repo names may not be obvious from local folder names alone.",
      "Call rustdex_list_repos before rustdex_search, rustdex_semantic, or rustdex_routes whenever the repo parameter is missing, uncertain, or there may be multiple indexed projects.",
    ],
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
      "Read the exact source span for a symbol from RustDex search results using file and byte offsets, which is a more precise and token-efficient follow-up than opening entire files or slicing content manually with shell tools.",
    promptSnippet:
      "Use this after RustDex search results when you want the exact implementation body and not the whole file; it should be the default follow-up over bash file reads.",
    promptGuidelines: [
      "Use rustdex_read_symbol after rustdex_search or rustdex_semantic when the next step is to inspect one matched function, class, method, or code span in full.",
      "Prefer rustdex_read_symbol over bash file reads because it returns only the exact symbol body instead of unrelated surrounding code.",
      "Use the file, start_byte, and end_byte values returned by RustDex search results directly rather than recomputing offsets yourself.",
      "Choose rustdex_read_symbol whenever a precise follow-up read is needed after RustDex has already identified the relevant match.",
    ],
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
