# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Collaboration Rules

- **Challenge when needed**: Do not blindly follow instructions. If something seems incorrect, suboptimal, or could lead to problems, push back and explain your reasoning. The goal is the best outcome, not compliance.
- Ask clarifying questions when requirements are ambiguous
- Suggest alternatives when you see a better approach

## Project Overview

sqlite-cloud-backup is a lightweight NPM library for SQLite database synchronization to Google Drive. It provides push, pull, and bidirectional sync operations with SHA-256 checksum verification and atomic file operations.

## Build & Development Commands

```bash
npm run build          # Build with tsup (CommonJS + ESM + types)
npm run dev            # Watch mode development
npm run test           # Run tests once (vitest)
npm run test:watch     # Watch mode testing
npm run test:coverage  # Coverage report
npm run typecheck      # TypeScript type checking
npm run lint           # ESLint TypeScript files
npm run lint:fix       # Auto-fix linting issues
```

## Architecture

### Core Components

- **SqliteCloudBackup** (`src/index.ts`): Main entry class orchestrating sync operations, OAuth flow, and provider management
- **SyncEngine** (`src/core/sync-engine.ts`): Implements push/pull/bidirectional sync logic with timestamp comparison
- **DatabaseManager** (`src/core/db-manager.ts`): Handles SQLite file operations using better-sqlite3, atomic replacements, and local metadata storage

### Provider System

- **BaseProvider** (`src/providers/base-provider.ts`): Abstract interface for cloud storage providers
- **GoogleDriveProvider** (`src/providers/google-drive/google-drive-provider.ts`): Google Drive implementation using googleapis. Uses `drive.file` scope (only accesses files created by this app)
- **OAuthFlow** (`src/providers/google-drive/oauth-flow.ts`): OAuth 2.0 flow with local HTTP server callback on port 3000. 5-minute timeout
- **TokenStorage** (`src/providers/google-drive/token-storage.ts`): Persists tokens to `.sqlite-cloud-backup/tokens.json` in the same directory as the database

### Utilities

- **ChecksumUtil** (`src/utils/checksum.ts`): SHA-256 hashing for integrity verification
- **Logger** (`src/utils/logger.ts`): Configurable logging (debug/info/warn/error levels)
- **FileOperations** (`src/utils/file-operations.ts`): Atomic file writes using temp-file-then-rename pattern

## Key Patterns

- **Metadata Storage**: Local metadata at `.sqlite-cloud-backup/{dbName}/metadata.json` (relative to db), cloud metadata in `metadata.json` alongside database file in Drive
- **Cloud Folder Structure**: `.sqlite-cloud-backup/{dbName}/` folder in Google Drive root contains `current.db` and `metadata.json`
- **Sync Decision**: No cloud → push; checksums match → skip; local modified time > cloud `lastSyncTimestamp` → push, else pull
- **Atomic Writes**: All file replacements use temp file + rename for crash safety
- **Token Lifecycle**: Tokens auto-refresh via googleapis; stored persistently; cleared on logout

## TypeScript Configuration

- Strict mode enabled
- Target: ES2022
- Dual output: CommonJS (.js) and ESM (.mjs)
- Node >=18.0.0 required

## Testing

Tests use Vitest and are located in `tests/unit/`. Run a single test file:
```bash
npx vitest run tests/unit/checksum.test.ts
```

## Conventions

- Use Logger class instead of console.log
- All I/O operations must be async
- Prefix unused parameters with underscore (`_param`)
- Export types from `src/types/index.ts`
