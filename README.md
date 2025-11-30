# Port GitHub App to GitHub Ocean Migration Tool

A CLI tool to safely migrate Port entities from the legacy GitHub App integration to the new GitHub Ocean integration.

## Overview

This tool helps you migrate entity ownership from the old GitHub App integration to the new GitHub Ocean integration in Port. It provides commands to compare entities and perform controlled, blueprint-by-blueprint migrations.

## Installation

### Quick Install (Recommended)

Download and install the binary for your platform:

```bash
curl -sL https://raw.githubusercontent.com/your-org/port-github-migration/main/install.sh | bash
```

This will automatically download the correct binary for your OS (macOS/Linux) and add it to your PATH.

### Manual Installation

1. Download the binary for your platform from [GitHub Releases](https://github.com/your-org/port-github-migration/releases)
2. Make it executable: `chmod +x port-github-migrator-*`
3. Move to your PATH: `sudo mv port-github-migrator-* /usr/local/bin/port-github-migrator`

### Verify Installation

```bash
port-github-migrator --version
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
  --client-id YOUR_ID \
  --client-secret YOUR_SECRET \
  --old-installation-id OLD_ID \
  --new-installation-id NEW_ID
```

Or use all flags without `.env`:

```bash
export PORT_CLIENT_ID=YOUR_ID
export PORT_CLIENT_SECRET=YOUR_SECRET
export OLD_INSTALLATION_ID=OLD_ID
export NEW_INSTALLATION_ID=NEW_ID

port-github-migrator migrate githubRepository
```

## Commands

### migrate

Migrate entities from a specific blueprint or all blueprints to the new integration.

```bash
port-github-migrator migrate [blueprint] [options]
```

**Options:**

- `--all` - Migrate all blueprints (default if no blueprint specified)
- `--dry-run` - Preview what would be migrated without making changes

**Examples:**

```bash
# Migrate a single blueprint
port-github-migrator migrate githubRepository

# Dry run to see what would happen
port-github-migrator migrate githubRepository --dry-run

# Migrate all blueprints
port-github-migrator migrate --all
```

### get-blueprints

List all blueprints managed by the old GitHub App integration.

```bash
port-github-migrator get-blueprints [options]
```

**Options:**

- `--verbose` - Show detailed output

### get-diff

Compare entities between source and target blueprints to identify differences.

```bash
port-github-migrator get-diff <sourceBlueprint> <targetBlueprint> [options]
```

**Options:**

- `--output <file>` - Export detailed diff report to JSON file
- `--show-diffs` - Display field-level differences for changed entities (default: enabled)
- `--limit <n>` - Limit shown changed entities (default: 10)
- `--verbose` - Show detailed output

**Examples:**

```bash
# Compare blueprints
port-github-migrator get-diff githubRepository githubRepository

# Export detailed report
port-github-migrator get-diff githubRepository githubRepository --output diff-report.json

# Show more changed entities
port-github-migrator get-diff githubRepository githubRepository --limit 50
```

## Migration Guide

See [MIGRATION.md](./MIGRATION.md) for detailed step-by-step instructions on migrating from GitHub App to GitHub Ocean.

## Troubleshooting

### Invalid Credentials

If you get "Authentication failed: Invalid credentials", verify:

- Your credentials are correct in Port
- Your API token hasn't expired
- You're using the correct Port API URL

### No Entities Found

If "No entities found to migrate" appears:

- Ensure the blueprint has entities created by the old GitHub App integration
- Verify the `OLD_INSTALLATION_ID` is correct

### Missing Blueprints

If blueprints don't appear in `get-blueprints`:

- Ensure the old GitHub App integration is still active in Port
- Verify the installation ID matches your GitHub App installation

## Support

For issues or questions, contact Port support or refer to the [Port documentation](https://docs.getport.io).
