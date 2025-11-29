# Port GitHub App to GitHub Ocean Migration Tool

A comprehensive migration tool to migrate Port entities from the old GitHub App integration to the new GitHub Ocean integration. This tool handles entity ownership transfer by updating the `datasource` property of all affected entities.

## Overview

The migration process follows these steps:

1. **Fetch Affected Blueprints**: Query the Port datasources API to identify all blueprints associated with the old GitHub App installation
2. **Search Entities**: For each blueprint, use the Port search API to retrieve all entities
3. **Bulk Update Datasource**: Patch all entities in batches of 100 to update their datasource ownership to the new GitHub Ocean integration

## Features

- ✅ **Batch Processing**: Efficiently processes entities in configurable batches (default: 100)
- ✅ **Error Handling**: Comprehensive error handling with detailed error reporting
- ✅ **Progress Tracking**: Real-time progress updates and migration statistics
- ✅ **Configurable**: Support for environment variables and command-line arguments
- ✅ **Type-Safe**: Full TypeScript support for reliability
- ✅ **Detailed Reporting**: Migration summary with success/failure statistics

## Installation

```bash
# Clone or navigate to the project directory
cd github-ocean-migration

# Install dependencies
npm install
```

## Configuration

### Via Command Line Arguments

```bash
npx ts-node src/index.ts \
  --client-id YOUR_CLIENT_ID \
  --client-secret YOUR_CLIENT_SECRET \
  --installation-id OLD_INSTALLATION_ID \
  --new-datasource-id github-ocean \
  --port-url https://api.getport.io
```

### Via Environment Variables

Create a `.env` file:

```env
PORT_API_URL=https://api.getport.io
PORT_CLIENT_ID=your-client-id
PORT_CLIENT_SECRET=your-client-secret
```

Then run:

```bash
npx ts-node src/index.ts \
  --installation-id OLD_INSTALLATION_ID \
  --new-datasource-id github-ocean
```

### Argument Reference

| Argument | Short | Required | Description |
|----------|-------|----------|-------------|
| `--client-id` | `-cid` | Yes | Port API Client ID |
| `--client-secret` | `-cs` | Yes | Port API Client Secret |
| `--installation-id` | `-iid` | Yes | Old GitHub App Installation ID |
| `--port-url` | `-url` | No | Port API URL (default: https://api.getport.io) |
| `--new-datasource-id` | `-nds` | No | New GitHub Ocean datasource ID (default: github-ocean) |
| `--help` | `-h` | No | Show help message |

## Usage Examples

### Basic Usage

```bash
npx ts-node src/index.ts \
  --client-id abc123 \
  --client-secret secret456 \
  --installation-id old-github-app-123 \
  --new-datasource-id github-ocean
```

### Using Compiled JavaScript

```bash
# Build the project
npm run build

# Run the migration
npm run migrate -- \
  --client-id abc123 \
  --client-secret secret456 \
  --installation-id old-github-app-123 \
  --new-datasource-id github-ocean
```

### With Environment Variables

```bash
# Create .env file
PORT_CLIENT_ID=abc123
PORT_CLIENT_SECRET=secret456

# Run migration
npx ts-node src/index.ts \
  --installation-id old-github-app-123 \
  --new-datasource-id github-ocean
```

## How It Works

### Step 1: Fetch Affected Blueprints

The tool queries the Port API to fetch all blueprints that have data sources associated with the old GitHub App installation:

```
GET /v1/datasources?installationId={installationId}
```

### Step 2: Search for Entities

For each blueprint, the tool searches for all associated entities:

```
POST /v1/entities/search
Query: { filter: { blueprintId: "{blueprintId}" } }
Params: include=["identifier"], exclude_calculation_properties=true
```

### Step 3: Bulk Update Datasource

Entities are patched in batches to update their datasource:

```
PATCH /v1/blueprints/{blueprintId}/datasource/bulk
{
  "entitiesIdentifiers": ["entity1", "entity2", ...],
  "datasource": "github-ocean"
}
```

## Output Example

```
🚀 Starting Port Entity Migration

Configuration:
  📍 Port API URL: https://api.getport.io
  🔑 Old Installation ID: old-github-app-123
  🔄 New Datasource ID: github-ocean

🔐 Authenticating with Port API...
✅ Authentication successful

📊 Step 1: Fetching affected blueprints

📋 Fetching blueprints for installation: old-github-app-123
Found 2 data sources for installation
✅ Found 3 affected blueprints

📋 Processing blueprint: Service
──────────────────────────────────
🔍 Searching entities for blueprint: Service
✅ Found 45 entities for blueprint

🔄 Patching 45 entities in batches of 100...

  Batch 1/1: Patching 45 entities...
  ✅ Successfully patched 45 entities to datasource: github-ocean

═══════════════════════════════════════════════════════════════════════════
📊 MIGRATION SUMMARY REPORT
═══════════════════════════════════════════════════════════════════════════

✅ Migration Statistics:
  • Total Blueprints: 3
  • Total Entities Migrated: 128
  • Total Batches: 2
  • Successful Batches: 2
  • Failed Batches: 0

✅ No errors encountered

═══════════════════════════════════════════════════════════════════════════

🎉 Migration completed successfully!
```

## API Reference

### PortApiClient

Main client for interacting with the Port API.

#### Constructor

```typescript
new PortApiClient(baseUrl: string, clientId: string, clientSecret: string)
```

#### Methods

- `authenticate(): Promise<void>` - Authenticate with Port API
- `getBlueprintsByDataSource(installationId: string): Promise<BlueprintInfo[]>` - Fetch blueprints for a data source
- `searchEntitiesByBlueprint(blueprintIdentifier: string): Promise<Entity[]>` - Search entities for a blueprint
- `patchEntitiesDatasourceBulk(blueprintIdentifier: string, entitiesIdentifiers: string[], newDatasource: string): Promise<void>` - Patch entities in bulk

### PortMigrator

Orchestrates the migration process.

#### Constructor

```typescript
new PortMigrator(config: MigrationConfig)
```

#### Methods

- `migrate(newDatasourceId: string): Promise<MigrationStats>` - Execute the full migration

## Error Handling

The tool provides comprehensive error handling:

- **Authentication Errors**: Failed API credentials or session issues
- **Network Errors**: Connection timeouts or unreachable endpoints
- **Validation Errors**: Invalid parameters or missing required fields
- **Batch Errors**: Individual batch failures don't stop the entire migration
- **API Errors**: Detailed error messages from the Port API

All errors are collected and reported in the final migration summary.

## Troubleshooting

### Authentication Failed

```
❌ Authentication failed: Unauthorized
```

- Verify your `clientId` and `clientSecret` are correct
- Check that your Port workspace allows API access

### No Blueprints Found

```
⚠️ No blueprints found for the specified installation
```

- Verify the `installationId` is correct
- Ensure the old GitHub App integration has associated blueprints

### Batch Failures

If some batches fail:

1. Check the error details in the migration report
2. Verify the entity identifiers are correct
3. Ensure the new datasource exists and is accessible

### Network Timeout

```
❌ Request timeout
```

- Increase the timeout value in `port-client.ts`
- Check your internet connection
- Verify the Port API URL is accessible

## Development

### Building

```bash
npm run build
```

### Development Mode

```bash
npm run dev -- --client-id ... --client-secret ... --installation-id ...
```

### Linting

```bash
npm run lint
```

## Type Definitions

The tool includes comprehensive TypeScript type definitions:

- `MigrationConfig` - Configuration parameters
- `BlueprintInfo` - Blueprint metadata
- `Entity` - Entity information
- `DataSource` - Data source metadata
- `MigrationStats` - Migration statistics and results

## Performance Considerations

- **Batch Size**: Default is 100 entities per batch. Adjust in `src/migrator.ts` if needed
- **Concurrent Requests**: Batches are processed sequentially to avoid API rate limiting
- **API Timeouts**: Default timeout is 30 seconds per request

## Security

- **Credentials**: Never commit `.env` files with real credentials
- **API Keys**: Treat `clientId` and `clientSecret` as secrets
- **HTTPS**: Ensure you're using HTTPS for all API communications

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review the migration logs for detailed error messages
3. Verify your Port API credentials and permissions
4. Ensure all entity identifiers are valid

## License

MIT

