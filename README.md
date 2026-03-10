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

---

## Getting Started (Step by Step)

### What You Need

Pi-RustDex requires **two** components:

1. **The RustDex binary** - The Rust-based indexer that runs on your machine
2. **This Pi extension** - The bridge that lets Pi talk to RustDex

---

### Step 1: Install the RustDex Binary

Download a pre-built binary from the [RustDex Releases](https://github.com/burggraf/rustdex/releases) page:

**macOS (Apple Silicon):**
```bash
curl -L -o rustdex https://github.com/burggraf/rustdex/releases/latest/download/rustdex-darwin-arm64
chmod +x rustdex
sudo mv rustdex /usr/local/bin/
```

**macOS (Intel):**
```bash
curl -L -o rustdex https://github.com/burggraf/rustdex/releases/latest/download/rustdex-darwin-amd64
chmod +x rustdex
sudo mv rustdex /usr/local/bin/
```

**Linux (x86_64):**
```bash
curl -L -o rustdex https://github.com/burggraf/rustdex/releases/latest/download/rustdex-linux-amd64
chmod +x rustdex
sudo mv rustdex /usr/local/bin/
```

**Verify installation:**
```bash
rustdex --version
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

You should see: "RustDex is installed" ✅

---

### Step 3: Index Your First Project

Now let's index a codebase so Pi can search it. You can index any project on your machine.

**Example: Indexing a React project**

Type in Pi:
```
Please index my project at /Users/me/my-react-app with the name "myapp"
```

Pi will respond with something like:
> Successfully indexed /Users/me/my-react-app. The index "myapp" is now ready for searching.

**What just happened?**
- RustDex scanned all your source files
- Created a local database at `~/.rustdex/myapp.db`
- Generated vector embeddings for semantic search
- Registered the project in `~/.rustdex/registry.db`

**Index multiple projects:**
```
Index /Users/me/work/api-server as "api"
Index /Users/me/personal/blog as "blog"
```

---

### Step 4: Search Your Code with Natural Language

Now the fun part! You can ask Pi to find code using plain English.

#### Example 1: Finding Authentication Code

**You type:**
```
Search myapp for "how do we handle user login"
```

**Pi might respond:**
> Found 5 results for "how do we handle user login" in myapp:
> 
> 1. **authenticateUser** (function) - Score: 94.2%
>    File: /Users/me/my-react-app/src/auth.js:45
>    Byte range: 1234-1890
> 
> 2. **LoginForm** (class) - Score: 87.5%
>    File: /Users/me/my-react-app/src/components/LoginForm.jsx:12
>    Byte range: 456-1200
> 
> ...

**You follow up:**
```
Show me the source code for authenticateUser
```

**Pi responds with the actual code:**
> ```javascript
> async function authenticateUser(email, password) {
>   const hashed = await bcrypt.hash(password, SALT_ROUNDS);
>   const user = await db.users.findOne({ email, password: hashed });
>   if (!user) throw new Error('Invalid credentials');
>   return generateToken(user);
> }
> ```

#### Example 2: Finding API Endpoints

**You type:**
```
Show me all the POST routes in myapp
```

**Pi responds:**
> Found 3 POST routes in myapp:
> 
> **/Users/me/my-react-app/src/api.js**:
>   POST /api/users (line 23)
>   POST /api/login (line 45)
>   POST /api/posts (line 67)

#### Example 3: Semantic Search

**You type:**
```
Search myapp for "password reset email functionality"
```

**Pi finds relevant code even if function names don't match:**
> Found 4 results for "password reset email functionality" in myapp:
> 
> 1. **sendResetEmail** (function) - Score: 96.8%
>    File: /Users/me/my-react-app/src/email.js:89
> 
> 2. **generateResetToken** (function) - Score: 91.2%
>    File: /Users/me/my-react-app/src/auth.js:156
>
> 3. **ResetPasswordPage** (component) - Score: 88.4%
>    File: /Users/me/my-react-app/src/pages/ResetPassword.jsx:14

#### Example 4: Exact Symbol Search

**You type:**
```
Find the function called validateToken in myapp
```

**Pi responds:**
> Found 2 symbol(s) matching "validateToken" in myapp:
> 
> 1. **validateToken** (function)
>    File: /Users/me/my-react-app/src/auth.js:45
>    Byte range: 1234-1567
>
> 2. **validateToken** (function)
>    File: /Users/me/my-react-app/src/middleware/jwt.js:12
>    Byte range: 890-1100

---

### Step 5: Managing Your Indexes

**List all indexed projects:**
```
What repos do I have indexed?
```

**Pi responds:**
> 3 indexed repositories:
> 
> 1. **myapp**
>    Path: /Users/me/my-react-app
>    Indexed: 2024-03-10T14:30:00
>
> 2. **api**
>    Path: /Users/me/work/api-server
>    Indexed: 2024-03-09T10:15:00
>
> 3. **blog**
>    Path: /Users/me/personal/blog
>    Indexed: 2024-03-08T16:45:00

---

## Quick Reference

### Available Tools

| Tool | Description | Example Query |
|------|-------------|---------------|
| `rustdex_index` | Index a codebase | `Index /path/to/project as 'myproject'` |
| `rustdex_search` | Find symbols by exact name | `Find the function validateUser in myproject` |
| `rustdex_semantic` | Natural language code search | `Search myproject for 'how we handle errors'` |
| `rustdex_routes` | Extract HTTP routes from web frameworks | `Show me all API routes in myproject` |
| `rustdex_list_repos` | List all indexed repositories | `What repos do I have indexed?` |
| `rustdex_read_symbol` | Read source code by byte range | `Show me the source for validateUser` |

### Available Commands

| Command | Description |
|---------|-------------|
| `/rustdex-status` | Check if RustDex binary is installed and accessible |

---

## Example Conversation Flows

### Flow 1: Exploring a New Codebase

> **You:** Index /Users/me/work/legacy-api as "legacy"
>
> **Pi:** ✅ Successfully indexed legacy-api.
>
> **You:** Show me all the POST routes in legacy
>
> **Pi:** [Lists 12 POST routes across various files]
>
> **You:** Search legacy for "user authentication middleware"
>
> **Pi:** [Finds authMiddleware function with 92% relevance]
>
> **You:** Show me the source code for authMiddleware
>
> **Pi:** [Displays the full function source]

### Flow 2: Finding and Fixing a Bug

> **You:** Search blog for "image upload handling"
>
> **Pi:** [Found processImageUpload function]
>
> **You:** Show me the source
>
> **Pi:** [Displays code showing the bug]
>
> **You:** [Edit the file to fix the bug]

### Flow 3: Understanding Code Structure

> **You:** What repos do I have indexed?
>
> **Pi:** [Lists 5 projects]
>
> **You:** Search api for "database connection pooling"
>
> **Pi:** [Finds connection pool configuration]
>
> **You:** Search api for "all exported functions in the db module"
>
> **Pi:** [Lists relevant functions]

---

## Supported Languages

RustDex can index and search code written in:

| Language | File Extensions |
|----------|-----------------|
| C | `.c`, `.h` |
| C++ | `.cpp`, `.cc`, `.cxx`, `.hpp` |
| Elixir | `.ex`, `.exs` |
| Go | `.go` |
| Java | `.java` |
| JavaScript | `.js`, `.jsx`, `.mjs` |
| PHP | `.php` |
| Python | `.py` |
| Ruby | `.rb` |
| Rust | `.rs` |
| TypeScript | `.ts`, `.tsx` |
| Vue | `.vue` |

---

## Storage Location

All data is stored locally in `~/.rustdex/`:

| File | Purpose |
|------|---------|
| `registry.db` | Tracks all indexed projects and their paths |
| `<repo_name>.db` | Search index and embeddings for each project |

> 🔒 **Privacy:** No code leaves your machine. Everything is 100% local.

---

## Troubleshooting

### "RustDex not found" error

Make sure the `rustdex` binary is in your PATH:

```bash
which rustdex
# Should output: /usr/local/bin/rustdex

# If not found, reinstall:
sudo mv rustdex /usr/local/bin/
```

### Extension not loading

Check if the extension is installed:

```bash
pi list-extensions
```

If not listed, reinstall:

```bash
pi install npm:pi-rustdex
```

### Indexing takes a long time

Large codebases may take several minutes to index. This is normal — RustDex is analyzing every file and generating ML embeddings locally.

---

## Why Use RustDex with Pi?

| Benefit | Description |
|---------|-------------|
| 🎯 **Token Efficient** | Pi reads only the relevant bytes using precise byte ranges, not entire files |
| 🔒 **100% Private** | No code leaves your machine; no API keys needed |
| ⚡ **Fast** | High-performance Rust implementation with Tree-sitter parsing |
| 🧠 **Semantic Search** | Find code by describing what it does, not guessing file names |
| 📚 **Large Codebases** | Find relevant code in seconds instead of minutes |

---

## License

MIT License — see [LICENSE](LICENSE) for details.

## Repository

<https://github.com/burggraf/pi-rustdex>
