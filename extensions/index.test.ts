import { describe, expect, it } from "vitest";
import extension from "./index";

type RegisteredTool = {
  name: string;
  promptSnippet?: string;
  promptGuidelines?: string[];
};

function loadRegisteredTools(): RegisteredTool[] {
  const tools: RegisteredTool[] = [];

  const pi = {
    on() {},
    registerTool(tool: RegisteredTool) {
      tools.push(tool);
    },
    registerCommand() {},
  };

  extension(pi as any);

  return tools;
}

describe("pi-rustdex tool prompt metadata", () => {
  it("registers promptSnippet for every RustDex tool", () => {
    const tools = loadRegisteredTools();

    expect(tools).toHaveLength(6);
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "rustdex_index",
      "rustdex_list_repos",
      "rustdex_read_symbol",
      "rustdex_routes",
      "rustdex_search",
      "rustdex_semantic",
    ]);

    for (const tool of tools) {
      expect(tool.promptSnippet, `${tool.name} is missing promptSnippet`).toBeTruthy();
    }
  });

  it("registers promptGuidelines for every RustDex tool", () => {
    const tools = loadRegisteredTools();

    for (const tool of tools) {
      expect(tool.promptGuidelines, `${tool.name} is missing promptGuidelines`).toBeTruthy();
      expect(tool.promptGuidelines?.length, `${tool.name} should have at least one prompt guideline`).toBeGreaterThan(0);
    }
  });

  it("teaches the intended RustDex workflow", () => {
    const tools = loadRegisteredTools();
    const byName = new Map(tools.map((tool) => [tool.name, tool]));

    expect(byName.get("rustdex_index")?.promptGuidelines).toContain(
      "Use rustdex_index before other RustDex tools when the repository has not been indexed yet."
    );
    expect(byName.get("rustdex_list_repos")?.promptGuidelines).toContain(
      "Use rustdex_list_repos when you need a repo name for another RustDex tool and the indexed repositories are unknown."
    );
    expect(byName.get("rustdex_search")?.promptGuidelines).toContain(
      "After rustdex_search returns byte ranges, use rustdex_read_symbol to read the matched symbol body efficiently."
    );
    expect(byName.get("rustdex_semantic")?.promptGuidelines).toContain(
      "After rustdex_semantic returns promising hits, use rustdex_read_symbol to inspect the exact source for the best matches."
    );
  });
});
