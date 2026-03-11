# Pi RustDex Extension

A Pi extension that integrates [RustDex](https://github.com/burggraf/rustdex) - a high-performance, universal code indexer and semantic search tool - directly into your Pi agent workflow.

**What does this do?** RustDex creates a searchable index of your codebase, allowing Pi to find functions, classes, and API endpoints using plain English queries like *"show me where we handle user authentication"* instead of guessing file names.

---

## Features

- **🚀 Index Codebases**: Create searchable indexes of your projects with a single command
- **🔍 Symbol Search**: Find functions, classes, and methods by exact name across repos
- **🧠 Semantic Search**: Search code by natural language descriptions using local BERT embeddings
- **🌐 API Route Extraction**: Automatically identify HTTP endpoints in web frameworks
- **📁 Repository Management**: List and manage all your indexed repositories
- **📖 Symbol Reading**: Read exact symbol source code using byte ranges (token-efficient)
- **🔧 Backward Compatible**: Automatically detects CLI version and adapts to available features

---

## Getting Started (Step by Step)

### What You Need

Pi-RustDex requires **two** components:

1. **The RustDex binary** - The Rust-based indexer that runs on your machine
2. **This Pi extension** - The bridge that lets Pi talk to RustDex

---

### Step 1: Install the RustDex Binary

Download a pre-built binary from the [RustDex Releases](https://github.com/burggraf/rustdex/releases) page. The latest release (v0.2.0) includes the following binaries:

**macOS (Apple Silicon):**
```bash
curl -L -o rustdex.zip https://github.com/burggraf/rustdex/releases/download/v0.2.0/rustdex-v0.2.0-darwin-arm64.zip
unzip rustdex.zip
chmod +x rustdex
sudo mv rustdex /usr/local/bin/
rm rustdex.zip
```

**Linux (x86_64):**
```bash
curl -L -o rustdex.zip https://github.com/burggraf/rustdex/releases/download/v0.2.0/rustdex-v0.2.0-linux-amd64.zip
unzip rustdex.zip
chmod +x rustdex
sudo mv rustdex /usr/local/bin/
rm rustdex.zip
```

**Linux (ARM64):**
```bash
curl -L -o rustdex.zip https://github.com/burggraf/rustdex/releases/download/v0.2.0/rustdex-v0.2.0-linux-arm64.zip
unzip rustdex.zip
chmod +x rustdex
sudo mv rustdex /usr/local/bin/
rm rustdex.zip
```

**Windows (x86_64):**
```powershell
# Download and extract
curl -L -o rustdex.zip https://github.com/burggraf/rustdex/releases/download/v0.2.0/rustdex-v0.2.0-windows-amd64.zip
Expand-Archive -Path rustdex.zip -DestinationPath .
# Move to a directory in your PATH (e.g., C:\Windows\System32 or a custom location)
Move-Item -Path .\rustdex.exe -Destination C:\Windows\System32\
Remove-Item rustdex.zip
```

**Windows (ARM64):**
```powershell
curl -L -o rustdex.zip https://github.com/burggraf/rustdex/releases/download/v0.2.0/rustdex-v0.2.0-windows-arm64.zip
Expand-Archive -Path rustdex.zip -DestinationPath .
Move-Item -Path .\rustdex.exe -Destination C:\Windows\System32\
Remove-Item rustdex.zip
```

**Verify installation:**
```bash
rustdex --version
# Should output: rustdex 0.2.0

rustdex --help
```

> **Don't see your platform?** Build from source: https://github.com/burggraf/rustdex#installation

---

### Step 2: Install the Pi Extension

Inside any Pi session, run:

```bash
pi install npm:pi-rustdex
```

Or add to your project's `pi.json`:

```json
{
  "extensions": ["npm:pi-rustdex"]
}
```

**Verify the extension is loaded:**

Type this in Pi:
```
/rustdex-status
```

You should see: "RustDex is installed