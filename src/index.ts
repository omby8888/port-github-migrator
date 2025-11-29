#!/usr/bin/env node

/**
 * CLI entry point for the Port GitHub Migration tool
 */

import { config } from 'dotenv';
import { PortMigrator } from './migrator';
import { MigrationConfig } from './types';

// Load environment variables
config();

/**
 * Parse command line arguments
 */
function parseArgs(): {
  portApiUrl: string;
  clientId: string;
  clientSecret: string;
  oldInstallationId: string;
  newInstallationId: string;
} {
  const args = process.argv.slice(2);
  const parsedConfig: any = {};

  // Parse named arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--client-id' || arg === '-c') {
      parsedConfig.clientId = args[i + 1];
      i++;
    } else if (arg === '--client-secret' || arg === '-s') {
      parsedConfig.clientSecret = args[i + 1];
      i++;
    } else if (arg === '--old-installation-id' || arg === '-i') {
      parsedConfig.oldInstallationId = args[i + 1];
      i++;
    } else if (arg === '--new-installation-id' || arg === '-n') {
      parsedConfig.newInstallationId = args[i + 1];
      i++;
    } else if (arg === '--port-url' || arg === '-u') {
      parsedConfig.portApiUrl = args[i + 1];
      i++;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  // Validate required arguments
  const required = ['clientId', 'clientSecret', 'oldInstallationId', 'newInstallationId'];
  const missing = required.filter((key) => !parsedConfig[key]);

  if (missing.length > 0) {
    console.error(`❌ Missing required arguments: ${missing.join(', ')}`);
    printHelp();
    process.exit(1);
  }

  return parsedConfig;
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
╔══════════════════════════════════════════════════════════════════════════╗
║          Port GitHub App to GitHub Ocean Migration Tool                 ║
╚══════════════════════════════════════════════════════════════════════════╝

USAGE:
  port-migrate [options]  (if installed globally)
  npx port-github-migration [options]

REQUIRED OPTIONS:
  -c, --client-id <id>              Port API Client ID
  -s, --client-secret <secret>      Port API Client Secret
  -i, --old-installation-id <id>    Old GitHub App Installation ID
  -n, --new-installation-id <id>    New GitHub Ocean Installation ID

OPTIONAL OPTIONS:
  -u, --port-url <url>              Port API URL (default: https://api.getport.io)
  -h, --help                        Show this help message

ENVIRONMENT VARIABLES:
  PORT_API_URL                      Port API URL
  PORT_CLIENT_ID                    Port API Client ID
  PORT_CLIENT_SECRET                Port API Client Secret
  OLD_INSTALLATION_ID               Old GitHub App Installation ID
  NEW_INSTALLATION_ID               New GitHub Ocean Installation ID

EXAMPLES:

Basic usage with flags:
  port-migrate -c your-client-id -s your-secret -i old-app-id

With custom installation ID:
  port-migrate -c your-client-id -s your-secret -i old-app-id -n my-installation

Using environment variables:
  export PORT_CLIENT_ID=your-client-id
  export PORT_CLIENT_SECRET=your-client-secret
  port-migrate -i old-app-id -n github-ocean

Mixed (env vars + flags):
  export PORT_API_URL=https://custom.port.io
  port-migrate -c your-client-id -s your-secret -i old-app-id -n github-ocean
  `);
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  try {
    const args = parseArgs();

    // Create migration config
    const config: MigrationConfig = {
      portApiUrl: args.portApiUrl,
      clientId: args.clientId,
      clientSecret: args.clientSecret,
      oldInstallationId: args.oldInstallationId,
      newInstallationId: args.newInstallationId,
    };

    // Create migrator instance
    const migrator = new PortMigrator(config);

    // Use provided datasource ID or fetch it
    const newInstallationId = args.newInstallationId || 'github-ocean';

    // Execute migration
    const stats = await migrator.migrate(newInstallationId);

    // Exit with appropriate code
    process.exit(stats.failedBatches > 0 ? 1 : 0);
  } catch (error) {
    console.error('Fatal error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run main function
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
