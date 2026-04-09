# Changelog

## 0.4.4 - 2026-04-09

### Fixed
- **Windows compatibility**: `isRustDexAvailable()` now uses `where` on Windows instead of the Unix-only `which` command
- **Windows compatibility**: `getRustDexPath()` falls back to `USERPROFILE` env var on Windows instead of relying solely on `HOME`
- Fixes installation detection on Windows (#1)

## 0.4.3 - 2026-03-21

### Changed
- Version synced with rustdex v0.4.3

### Note
- RustDex 0.4.3 adds `.rustdexignore` support, `--ignore` CLI flag, and automatic `.gitignore` integration
- To update rustdex to the latest version: `npm install -g rustdex@latest`

## 0.4.1 - 2026-03-12

### Added
- Automatic RustDex installation via npm postinstall script
- When users install `pi-rustdex`, RustDex is now automatically installed if not already present

### Changed
- Updated installation documentation to highlight npm as the recommended installation method
- Version synced with rustdex v0.4.1

### Fixed
- Updated installation examples to reference rustdex v0.4.1

## 0.2.0 - 2026-03-10

### Initial Release
- RustDex integration for Pi agent workflow
- Symbol search by exact name
- Semantic search using natural language queries
- HTTP route extraction
- Repository management
- Symbol reading with byte ranges
- Backward compatible version detection