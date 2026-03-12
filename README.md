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

## Getting Started

### Quick Install (Recommended)

**Just run this single command - it installs everything you need:**

```bash
pi install npm:pi-rustdex
```

That's it! The RustDex binary will be **automatically installed** (if not already present) during the installation process. You can verify everything is working by typing `/rustdex-status` in any Pi session.

---

### How It Works

When you run `pi install npm:pi-rustdex`:

1. **The Pi extension is installed** - This gives Pi access to RustDex tools
2. **The RustDex binary is automatically checked** - If it's not installed, it will be installed via npm
3. **You're ready to go** - No additional steps required!

---

### Manual RustDex Binary Management

The automatic installation should handle everything, but if you need to manage the RustDex binary manually, here are the commands:

**Install RustDex binary manually:**
```bash
npm install -g rustdex
```

**Uninstall RustDex binary:**
```bash
npm uninstall -g rustdex
```

**Check RustDex version:**
```bash
rustdex --version
# Should output: rustdex 0.4.1 or later
```

The npm package automatically detects your platform and downloads the appropriate binary:
- macOS (ARM64/x64)
- Linux (ARM64/AMD64)
- Windows (ARM64/AMD64)

---

### Manual Binary Download (Alternative)

If you prefer to download the binary directly (without npm), you can get it from the [RustDex Releases](https://github.com/burggraf/rustdex/releases) page. The latest release includes binaries for all platforms.

**macOS (Apple Silicon):**
```bash
curl -L -o rustdex.zip https://github.com/burggraf/rustdex/releases/download/v0.4.1/rustdex-v0.4.1-darwin-arm64.zip
unzip rustdex.zip
chmod +x rustdex
sudo mv rustdex /usr/local/bin/
rm rustdex.zip
```

**Linux (x86_64):**
```bash
curl -L -o rustdex.zip https://github.com/burggraf/rustdex/releases/download/v0.4.1/rustdex-v0.4.1-linux-amd64.zip
unzip rustdex.zip
chmod +x rustdex
sudo mv rustdex /usr/local/bin/
rm rustdex.zip
```

**Windows (x86_64):**
```powershell
curl -L -o rustdex.zip https://github.com/burggraf/rustdex/releases/download/v0.4.1/rustdex-v0.4.1-windows-amd64.zip
Expand-Archive -Path rustdex.zip -DestinationPath .
Move-Item -Path .\rustdex.exe -Destination C:\Windows\System32\
Remove-Item rustdex.zip
```

> **Don't see your platform?** Build from source: https://github.com/burggraf/rustdex#installation

---

### Alternative Installation Methods

**Add to your project's `pi.json`:**

```json
{
  "extensions": ["npm:pi-rustdex"]
}
```

This will load the extension automatically when you start Pi in that project directory.

---

### Verify Installation

Once installed, verify everything is working by typing this in any Pi session:

```
/rustdex-status
```

You should see a notification confirming that RustDex is installed and ready to use.