# Port GitHub App to GitHub Ocean Migration Tool

A fast, single-file CLI tool written in Go to safely migrate Port entities from the legacy GitHub App integration to the new GitHub Ocean integration.

## Features

- ✨ **Tiny binaries** - ~8-12MB single executable (no dependencies needed)
- 🚀 **Fast startup** - Go binary vs Node.js
- 🔒 **Safe migration** - Dry-run mode and diffing before migration
- 📊 **Entity comparison** - See differences between old and new datasources
- 🎯 **Blueprint-by-blueprint** - Migrate one blueprint at a time or all at once

## Installation

### Quick Install (Recommended)

One-line installation that automatically downloads the correct binary for your platform:

```bash
curl -sL https://raw.githubusercontent.com/omby8888/port-github-migrator/main/install.sh | bash
```

The script will:
- Detect your OS and architecture (macOS, Linux, Windows)
- Download the appropriate binary from GitHub Releases
- Verify the binary works
- Install to `/usr/local/bin/port-github-migrator`

### Verify Installation

```bash
port-github-migrator --version
```

### Manual Installation

If you prefer manual installation:

1. Go to [GitHub Releases](https://github.com/omby8888/port-github-migrator/releases)
2. Download the binary for your platform (e.g., `port-github-migrator-macos-arm64`)
3. Make it executable and move to your PATH:
   ```bash
   chmod +x port-github-migrator-macos-arm64
   sudo mv port-github-migrator-macos-arm64 /usr/local/bin/port-github-migrator
   ```

## Configuration

### Environment Variables

Create a `.env` file with your Port API credentials:

```env
PORT_API_URL=https://api.getport.io
PORT_CLIENT_ID=your_client_id
PORT_CLIENT_SECRET=your_client_secret
OLD_INSTALLATION_ID=your_old_github_app_installation_id
NEW_INSTALLATION_ID=your_new_ocean_installation_id
```

Alternatively, pass these as CLI flags:

```bash
port-github-migrator migrate githubRepository \
  --client-id your_id \
  --client-secret your_secret \
  --old-installation-id 97280772 \
  --new-installation-id 12345678
```

## Usage

### Get Blueprints

List all blueprints managed by the old GitHub App installation:

```bash
port-github-migrator get-blueprints
```

### Compare Entities (Diff)

Compare entities between the old and new installations:

```bash
port-github-migrator get-diff githubRepository githubRepository-new \
  --show-diffs \
  --limit 10
```

### Migrate Entities

Migrate entities from old to new installation:

```bash
# Migrate single blueprint
port-github-migrator migrate githubRepository

# Migrate all blueprints
port-github-migrator migrate all

# Dry-run (see what would be migrated)
port-github-migrator migrate githubRepository --dry-run
```

## Development

### Prerequisites

- Go 1.21+

### Build

```bash
# Build for current platform
make build

# Run the binary
./bin/port-github-migrator --help
```

### Build for All Platforms

```bash
make build-release
ls -lh bin/
```

This will create binaries for:
- Linux x64
- macOS x64
- macOS arm64
- Windows x64

### Code Quality

```bash
# Format code
make fmt

# Lint code
make vet

# Run tests
make test
```

## Binary Sizes

| Platform | Size |
|----------|------|
| Linux x64 | ~10MB |
| macOS x64 | ~11MB |
| macOS arm64 | ~10MB |
| Windows x64 | ~11MB |

All are single-file executables with zero external dependencies!

## Commands Reference

```
USAGE:
  port-github-migrator [flags] [command]

GLOBAL FLAGS:
  --port-url string                Port API URL (default: https://api.getport.io)
  --client-id string              Port API Client ID
  --client-secret string          Port API Client Secret
  --old-installation-id string    Old GitHub App Installation ID
  --new-installation-id string    New GitHub Ocean Installation ID
  --verbose                       Enable verbose logging
  -h, --help                      Show this help message

COMMANDS:
  migrate       Migrate entities from a specific blueprint or all blueprints
  get-blueprints Get all blueprints managed by the old installation
  get-diff      Compare entities between source and target blueprints
```

## Migration Workflow

1. **Backup** - Ensure you have backups of your Port configuration
2. **Prepare** - Install the new GitHub Ocean integration
3. **Preview** - Use `get-diff` to compare entities
4. **Dry-run** - Use `--dry-run` flag to see what will be migrated
5. **Migrate** - Run migration for each blueprint or all at once
6. **Verify** - Check Port UI to confirm migration succeeded

## Troubleshooting

### Binary won't run on macOS

If you see "cannot be opened because the developer cannot be verified":

```bash
sudo xattr -rd com.apple.quarantine /usr/local/bin/port-github-migrator
```

### Missing credentials

Make sure your `.env` file exists in the current directory or set environment variables:

```bash
export PORT_CLIENT_ID=your_id
export PORT_CLIENT_SECRET=your_secret
export OLD_INSTALLATION_ID=123
export NEW_INSTALLATION_ID=456
port-github-migrator migrate all
```

## License

MIT

## Support

For issues or questions, please open an issue on [GitHub](https://github.com/omby8888/port-github-migrator/issues).
