# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-01-16

### Added
- Initial release of sqlite-cloud-backup
- Core push/pull/sync operations
- Google Drive provider integration
- SHA-256 checksum verification
- Automatic sync direction detection
- TypeScript support with full type definitions
- Basic logging with configurable log levels
- Comprehensive documentation and examples
- OAuth 2.0 authentication support
- Atomic file operations for data safety

### Features
- `pushToCloud()` - Upload local database to cloud
- `pullFromCloud()` - Download database from cloud
- `sync()` - Smart bidirectional synchronization
- `shutdown()` - Clean resource cleanup

### Documentation
- Complete README with quick start guide
- Google Drive credentials setup guide
- API reference documentation
- Example usage for Electron, React Native, and CLI tools
- Helper script for obtaining Google Drive refresh tokens

### Testing
- Unit tests for checksum utilities
- Unit tests for logger
- 100% test pass rate
- TypeScript strict mode compliance

## [Unreleased]

### Planned for v0.2
- Advanced conflict resolution strategies
- Automatic backup before sync
- Retry logic with exponential backoff
- Event system for sync progress tracking

### Planned for v0.3
- Auto-sync with background scheduler
- Sync history tracking
- Rollback capability
- Optional AES-256 encryption

### Planned for v1.0
- Dropbox provider
- AWS S3 provider
- CLI tool
- Complete integration test suite
- Production-ready release

[0.1.0]: https://github.com/1291pravin/sqlite-cloud-backup/releases/tag/v0.1.0
