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
import { Logger } from './logger';
import { DiffService } from './diff-service';
import { FileWriter } from './file-writer';
import { getNewDatasourceId } from './utils';

config();

const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));

const program = new Command();

program
  .name('port-github-migrator')
  .description('Migrate Port entities from GitHub App to GitHub Ocean')
  .version(packageJson.version);

// Global options
program
  .option('--client-id <id>', 'Port API Client ID', process.env.PORT_CLIENT_ID)
  .option('--client-secret <secret>', 'Port API Client Secret', process.env.PORT_CLIENT_SECRET)
  .option(
    '--old-installation-id <id>',
    'Old GitHub App Installation ID',
    process.env.OLD_INSTALLATION_ID
  )
  .option(
    '--new-installation-id <id>',
    'New GitHub Ocean Installation ID',
    process.env.NEW_INSTALLATION_ID
  )
  .option('--port-url <url>', 'Port API URL', process.env.PORT_API_URL || 'https://api.getport.io');

// Migrate command
program
  .command('migrate [blueprint]')
  .description('Migrate entities from a specific blueprint or all blueprints')
  .option('--all', 'Migrate all blueprints')
  .option('--dry-run', 'Show what would be migrated without making changes')
  .action(async (blueprint, options) => {
    await validateCredentials(program.opts());

    const config = createConfig(program.opts());

    try {
      // Suppress verbose output for integration version fetch
      const wasVerbose = Logger.verbose;
      Logger.setVerbose(false);

      const client = new PortApiClient(config.portApiUrl, config.clientId, config.clientSecret);
      const newDatasourceId = await getNewDatasourceId(client, config.newInstallationId);

      Logger.setVerbose(wasVerbose);

      const migrator = new PortMigrator(config);
      const migrateAll = options.all || !blueprint;
      const stats = await migrator.migrate(
        newDatasourceId,
        migrateAll ? undefined : blueprint,
        options.dryRun
      );
      process.exit(stats.failedBatches > 0 ? 1 : 0);
    } catch (error) {
      Logger.error(
        `❌ Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      process.exit(1);
    }
  });

// Get entities command
program
  .command('list-entities')
  .description('List all entities from the old installation')
  .option('--blueprint <blueprint>', 'Filter entities by blueprint')
  .option('--output <file>', 'Output file for results')
  .option('--verbose', 'Show verbose output, default: false')
  .action(async (options) => {
    Logger.setVerbose(options.verbose);
    await validateCredentials(program.opts());

    const config = createConfig(program.opts());
    const client = new PortApiClient(config.portApiUrl, config.clientId, config.clientSecret);

    try {
      const blueprintIds = await client.getBlueprintsByDataSource(config.oldInstallationId);

      if (blueprintIds.length === 0) {
        Logger.warn('No blueprints found');
        return;
      }

      const allEntities: any[] = [];

      for (const blueprintId of blueprintIds) {
        const entities = await client.searchOldEntitiesByBlueprint(
          blueprintId,
          config.oldInstallationId
        );
        allEntities.push(
          ...entities.map((e) => ({
            identifier: e.identifier,
            blueprint: blueprintId,
          }))
        );
      }

      // Save to file
      const outputFile = options.output || `entities-${Date.now()}.json`;
      const fileWriter = new FileWriter();
      fileWriter.writeJson(outputFile, {
        timestamp: new Date().toISOString(),
        totalEntities: allEntities.length,
        entities: allEntities,
      });
    } catch (error) {
      Logger.error(
        `❌ Failed to export entities: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      process.exit(1);
    }
  });

// List blueprints command
program
  .command('list-blueprints')
  .description('List all blueprints managed by the old installation')
  .option('--verbose', 'Show verbose output, default: false')
  .action(async (options) => {
    Logger.setVerbose(options.verbose);
    await validateCredentials(program.opts());

    const config = createConfig(program.opts());
    const client = new PortApiClient(config.portApiUrl, config.clientId, config.clientSecret);

    try {
      Logger.log('Fetching blueprints...');
      const blueprintIds = await client.getBlueprintsByDataSource(config.oldInstallationId);

      if (blueprintIds.length === 0) {
        Logger.warn('No blueprints found.');
        return;
      }

      Logger.log(`NAME                 `);
      Logger.log(`────────────────────────`);
      blueprintIds.forEach((id) => {
        Logger.log(`${id}`);
      });
    } catch (error) {
      Logger.error(`error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });

// Diff command
program
  .command('diff <sourceBlueprint> <targetBlueprint>')
  .description('Compare entities between source and target blueprints')
  .option('--output <file>', 'Export diff report to file')
  .option('--no-show-diffs', 'Hide detailed field-level diffs for changed entities')
  .option('--limit <n>', 'Limit shown changed entities (default: 10)', '10')
  .option('--verbose', 'Show verbose output, default: false')
  .action(async (sourceBlueprint, targetBlueprint, options) => {
    Logger.setVerbose(options.verbose);

    const target = targetBlueprint;

    try {
      await validateCredentials(program.opts());

      const config = createConfig(program.opts());

      if (!config.newInstallationId) {
        Logger.error('❌ Error: --new-installation-id is required for diff command');
        process.exit(1);
      }

      const client = new PortApiClient(config.portApiUrl, config.clientId, config.clientSecret);

      // Create diff service
      const diffService = new DiffService(client);

      // Run comparison
      const result = await diffService.compareBlueprint(
        sourceBlueprint,
        target,
        config.oldInstallationId,
        config.newInstallationId
      );

      // Print summary
      diffService.printSummary(result);

      // Show detailed diffs by default (unless --no-show-diffs)
      if (options.showDiffs && result.diff.changed.length > 0) {
        const limit = parseInt(options.limit, 10);
        diffService.printDetailedDiffs(result.diff.changed, limit);
      }

      // Export if requested
      if (options.output) {
        diffService.exportDiff(result, options.output);
      }

      process.exit(0);
    } catch (error) {
      Logger.error(`❌ Diff failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });

// Helper functions
async function validateCredentials(opts: any) {
  const required = ['clientId', 'clientSecret', 'oldInstallationId'];
  const missing = required.filter((key) => !opts[key.charAt(0).toLowerCase() + key.slice(1)]);

  if (missing.length > 0) {
    Logger.error(`❌ Missing required options: ${missing.join(', ')}`);
    process.exit(1);
  }
}

function createConfig(opts: any): MigrationConfig {
  return {
    portApiUrl: opts.portUrl,
    clientId: opts.clientId,
    clientSecret: opts.clientSecret,
    oldInstallationId: opts.oldInstallationId,
    newInstallationId: opts.newInstallationId,
  };
}

program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
