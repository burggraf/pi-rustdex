/**
 * RustDex utility functions for the pi-rustdex extension
 */

import { spawnSync } from "node:child_process";

export interface RustDexResult {
  success: boolean;
  output: any;
  error?: string;
}

export interface SymbolResult {
  name: string;
  kind: string;
  file: string;
  line: number;
  start_byte: number;
  end_byte: number;
}

export interface SemanticResult extends SymbolResult {
  score: number;
}

export interface RouteResult {
  method: string;
  path: string;
  file: string;
  line: number;
  handler?: string;
}

export interface RepoInfo {
  name: string;
  path: string;
  indexed_at?: string;
  symbol_count?: number;
}

// Cache for version check
let versionCache: string | null | undefined = undefined;
let supportsJsonFlags: { [key: string]: boolean } = {};

/**
 * Check if rustdex binary is available in PATH
 */
export function isRustDexAvailable(): boolean {
  const result = spawnSync("which", ["rustdex"], { encoding: "utf-8" });
  return result.status === 0;
}

/**
 * Get the path to the rustdex binary
 */
function getRustDexPath(): string {
  // Check if we're in development mode with a local build
  const localBuild = `${process.env.HOME}/dev/rustdex/target/release/rustdex`;
  const fs = require("fs");
  if (fs.existsSync(localBuild)) {
    return localBuild;
  }
  return "rustdex";
}

/**
 * Execute a rustdex command and return the result
 */
export function runRustDex(
  args: string[],
  cwd?: string,
  timeout: number = 120000
): RustDexResult {
  try {
    const binaryPath = getRustDexPath();
    const result = spawnSync(binaryPath, args, {
      encoding: "utf-8",
      cwd: cwd || process.cwd(),
      timeout,
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

    // Try to parse as JSON first
    let output: any;
    const stdout = result.stdout.trim();
    if (stdout) {
      try {
        output = JSON.parse(stdout);
      } catch {
        output = stdout;
      }
    } else {
      output = null;
    }

    return { success: true, output };
  } catch (e: any) {
    return { success: false, output: null, error: e.message };
  }
}

/**
 * Check if a specific command supports the --json flag
 */
function commandSupportsJson(command: string): boolean {
  if (supportsJsonFlags[command] !== undefined) {
    return supportsJsonFlags[command];
  }

  // Check version to determine if --json is supported
  const version = getRustDexVersion();
  if (!version) {
    supportsJsonFlags[command] = false;
    return false;
  }

  // Parse version (format: "rustdex 0.2.0" or just "0.2.0")
  const versionMatch = version.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!versionMatch) {
    supportsJsonFlags[command] = false;
    return false;
  }

  const major = parseInt(versionMatch[1]);
  const minor = parseInt(versionMatch[2]);

  // --json support for index and list-repos was added in 0.2.0
  // search, semantic, routes had --json support earlier
  if (command === "index" || command === "list-repos") {
    supportsJsonFlags[command] = major > 0 || (major === 0 && minor >= 2);
  } else {
    supportsJsonFlags[command] = true;
  }

  return supportsJsonFlags[command];
}

/**
 * Get rustdex version
 */
export function getRustDexVersion(): string | null {
  if (versionCache !== undefined) {
    return versionCache;
  }

  const binaryPath = getRustDexPath();
  const result = spawnSync(binaryPath, ["--version"], {
    encoding: "utf-8",
    timeout: 5000,
  });

  if (result.status === 0 && result.stdout) {
    versionCache = result.stdout.trim();
    return versionCache;
  }

  versionCache = null;
  return null;
}

/**
 * Parse repo list from text format (fallback for older versions)
 * Format: "name - path (indexed: Some(timestamp))"
 */
function parseRepoListText(text: string): RepoInfo[] {
  const repos: RepoInfo[] = [];
  const lines = text.split("\n").filter((line) => line.trim());

  for (const line of lines) {
    // Match format: "name - path (indexed: Some(2026-03-11T16:32:36))"
    const match = line.match(/^(.+?)\s+-\s+(.+?)\s+\(indexed:\s+(.*)\)$/);
    if (match) {
      const name = match[1].trim();
      const path = match[2].trim();
      const indexedStr = match[3].trim();

      // Parse the indexed timestamp (handle Some(...) or None)
      let indexed_at: string | undefined;
      const someMatch = indexedStr.match(/Some\((.+?)\)/);
      if (someMatch) {
        indexed_at = someMatch[1];
      }

      repos.push({ name, path, indexed_at });
    }
  }

  return repos;
}

/**
 * Parse index output from text format (fallback for older versions)
 * Format: "Finished indexing repo: name"
 */
function parseIndexOutput(text: string, projectPath: string, name?: string): RepoInfo {
  const repoName = name || projectPath.split("/").pop() || "unknown";
  const match = text.match(/Finished indexing repo:\s*(.+)/);
  const finalName = match ? match[1].trim() : repoName;

  return {
    name: finalName,
    path: projectPath,
  };
}

/**
 * Index a codebase
 */
export function indexCodebase(
  projectPath: string,
  name?: string
): RustDexResult {
  const useJson = commandSupportsJson("index");
  const args = ["index", projectPath];
  if (useJson) {
    args.push("--json");
  }
  if (name) {
    args.push("--name", name);
  }

  const result = runRustDex(args, undefined, 300000);

  // If JSON failed or not supported, try to parse text output
  if (result.success && !useJson && typeof result.output === "string") {
    result.output = parseIndexOutput(result.output, projectPath, name);
  }

  return result;
}

/**
 * Search for symbols
 */
export function searchSymbols(
  query: string,
  repo: string,
  kind?: string,
  limit: number = 20
): SymbolResult[] {
  const args = ["search", query, "--repo", repo, "--json"];
  if (kind) {
    args.push("--kind", kind);
  }
  if (limit !== 20) {
    args.push("--limit", limit.toString());
  }

  const result = runRustDex(args);
  if (result.success && Array.isArray(result.output)) {
    return result.output;
  }
  return [];
}

/**
 * Semantic search
 */
export function semanticSearch(
  query: string,
  repo: string,
  limit: number = 10
): SemanticResult[] {
  const args = ["semantic", query, "--repo", repo, "--json"];
  if (limit !== 10) {
    args.push("--limit", limit.toString());
  }

  const result = runRustDex(args);
  if (result.success && Array.isArray(result.output)) {
    return result.output;
  }
  return [];
}

/**
 * Extract HTTP routes
 */
export function extractRoutes(
  repo: string,
  method?: string,
  path?: string,
  limit: number = 50
): RouteResult[] {
  const args = ["routes", repo, "--json"];
  if (method) {
    args.push("--method", method.toUpperCase());
  }
  if (path) {
    args.push("--path", path);
  }
  if (limit !== 50) {
    args.push("--limit", limit.toString());
  }

  const result = runRustDex(args);
  if (result.success && Array.isArray(result.output)) {
    return result.output;
  }
  return [];
}

/**
 * List indexed repositories
 */
export function listRepos(): RepoInfo[] {
  const useJson = commandSupportsJson("list-repos");
  const args = useJson ? ["list-repos", "--json"] : ["list-repos"];

  const result = runRustDex(args);

  if (!result.success) {
    return [];
  }

  // If JSON output
  if (useJson && Array.isArray(result.output)) {
    // Transform the output to match our RepoInfo interface
    return result.output.map((repo: any) => ({
      name: repo.name,
      path: repo.root_path || repo.path,
      indexed_at: repo.last_indexed,
      symbol_count: repo.symbol_count,
    }));
  }

  // Fallback: parse text output
  if (typeof result.output === "string") {
    return parseRepoListText(result.output);
  }

  return [];
}

/**
 * Clear the version cache (useful for testing)
 */
export function clearVersionCache(): void {
  versionCache = undefined;
  supportsJsonFlags = {};
}
