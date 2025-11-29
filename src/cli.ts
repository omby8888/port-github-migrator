#!/usr/bin/env node

/**
 * Port GitHub Migration Tool - CLI Commands
 */

import { Command } from 'commander';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PortMigrator } from './migrator';
import { PortApiClient } from './port-client';
import { MigrationConfig } from './types';

config();

const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../package.json'), 'utf-8')
);

const program = new Command();

program
  .name('port-github-migrator')
  .description('Migrate Port entities from GitHub App to GitHub Ocean')
  .version(packageJson.version);

// Global options
program
  .option('--client-id <id>', 'Port API Client ID', process.env.PORT_CLIENT_ID)
  .option('--client-secret <secret>', 'Port API Client Secret', process.env.PORT_CLIENT_SECRET)
  .option('--old-id <id>', 'Old GitHub App Installation ID', process.env.OLD_INSTALLATION_ID)
  .option('--new-id <id>', 'New GitHub Ocean Installation ID', process.env.NEW_INSTALLATION_ID || 'github-ocean')
  .option('--port-url <url>', 'Port API URL', process.env.PORT_API_URL || 'https://api.getport.io')
  .option('--output <file>', 'Output file for results');

// Migrate command
program
  .command('migrate [blueprint]')
  .description('Migrate entities from a blueprint or all blueprints')
  .option('--dry-run', 'Show what would be migrated without making changes')
  .action(async (blueprint, options) => {
    await validateCredentials(program.opts());

    const migrateAll = !blueprint || blueprint === 'all';
    const config = createConfig(program.opts());

    const migrator = new PortMigrator(config);

    if (options.dryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be made\n');
    }

    try {
      const stats = await migrator.migrate(program.opts().newId, migrateAll ? undefined : blueprint);
      process.exit(stats.failedBatches > 0 ? 1 : 0);
    } catch (error) {
      console.error(`\n❌ Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
      process.exit(1);
    }
  });

// Get entities command
program
  .command('get-entities')
  .description('Export all entities from the old installation to a file')
  .action(async () => {
    await validateCredentials(program.opts());

    const config = createConfig(program.opts());
    const client = new PortApiClient(config.portApiUrl, config.clientId, config.clientSecret);

    try {
      console.log('🔐 Authenticating with Port API...');
      await client.authenticate();

      console.log('📋 Fetching blueprints...');
      const blueprintIds = await client.getBlueprintsByDataSource(config.oldInstallationId);

      if (blueprintIds.length === 0) {
        console.log('⚠️  No blueprints found');
        return;
      }

      console.log(`✅ Found ${blueprintIds.length} blueprints\n`);

      const allEntities: any[] = [];

      for (const blueprintId of blueprintIds) {
        console.log(`🔍 Fetching entities for blueprint: ${blueprintId}`);
        const entities = await client.searchEntitiesByBlueprint(blueprintId, config.oldInstallationId);
        allEntities.push(
          ...entities.map((e) => ({
            identifier: e.identifier,
            blueprint: blueprintId,
          }))
        );
        console.log(`   Found ${entities.length} entities`);
      }

      // Save to file
      const outputFile = program.opts().output || `entities-${Date.now()}.json`;
      const fs = require('fs');
      fs.writeFileSync(
        outputFile,
        JSON.stringify(
          {
            timestamp: new Date().toISOString(),
            totalEntities: allEntities.length,
            entities: allEntities,
          },
          null,
          2
        )
      );

      console.log(`\n✅ Exported ${allEntities.length} entities to: ${outputFile}`);
    } catch (error) {
      console.error(`\n❌ Failed to export entities: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
      process.exit(1);
    }
  });

// List blueprints command
program
  .command('list-blueprints')
  .description('List all blueprints managed by the old installation')
  .action(async () => {
    await validateCredentials(program.opts());

    const config = createConfig(program.opts());
    const client = new PortApiClient(config.portApiUrl, config.clientId, config.clientSecret);

    try {
      console.log('🔐 Authenticating with Port API...');
      await client.authenticate();

      console.log('📋 Fetching blueprints...\n');
      const blueprintIds = await client.getBlueprintsByDataSource(config.oldInstallationId);

      if (blueprintIds.length === 0) {
        console.log('⚠️  No blueprints found');
        return;
      }

      console.log(`✅ Found ${blueprintIds.length} blueprints:\n`);
      blueprintIds.forEach((id, idx) => {
        console.log(`  ${idx + 1}. ${id}`);
      });
    } catch (error) {
      console.error(`\n❌ Failed to list blueprints: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
      process.exit(1);
    }
  });

// Validate command
program
  .command('validate')
  .description('Validate credentials and connectivity')
  .action(async () => {
    await validateCredentials(program.opts());

    const config = createConfig(program.opts());
    const client = new PortApiClient(config.portApiUrl, config.clientId, config.clientSecret);

    try {
      console.log('🔐 Testing authentication...');
      await client.authenticate();
      console.log('✅ Authentication successful\n');

      console.log('📋 Fetching blueprints...');
      const blueprints = await client.getBlueprintsByDataSource(config.oldInstallationId);
      console.log(`✅ Found ${blueprints.length} blueprints\n`);

      console.log('✅ All validations passed!');
    } catch (error) {
      console.error(`\n❌ Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
      process.exit(1);
    }
  });

// Helper functions
async function validateCredentials(opts: any) {
  const required = ['clientId', 'clientSecret', 'oldId'];
  const missing = required.filter((key) => !opts[key.charAt(0).toLowerCase() + key.slice(1)]);

  if (missing.length > 0) {
    console.error(`❌ Missing required options: ${missing.join(', ')}`);
    console.error('\nUse --help for more information');
    process.exit(1);
  }
}

function createConfig(opts: any): MigrationConfig {
  return {
    portApiUrl: opts.portUrl,
    clientId: opts.clientId,
    clientSecret: opts.clientSecret,
    oldInstallationId: opts.oldId,
    newInstallationId: opts.newId,
  };
}

program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
