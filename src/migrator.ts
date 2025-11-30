/**
 * Main migration orchestrator - coordinates the migration process
 */

import { PortApiClient } from './port-client';
import { MigrationConfig, MigrationStats, Entity } from './types';
import * as readline from 'readline';
import { Logger } from './logger';

const BATCH_SIZE = 100;

export class PortMigrator {
  private client: PortApiClient;
  private config: MigrationConfig;
  private stats: MigrationStats;
  private rl: readline.Interface;

  constructor(config: MigrationConfig) {
    this.config = config;
    this.client = new PortApiClient(config.portApiUrl, config.clientId, config.clientSecret);
    this.stats = {
      totalBlueprints: 0,
      totalEntities: 0,
      totalBatches: 0,
      successfulBatches: 0,
      failedBatches: 0,
      errors: [],
    };
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  /**
   * Wait for strict confirmation (require "yes")
   */
  private async waitForStrictConfirmation(prompt: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.rl.question(prompt, (answer) => {
        resolve(answer.toLowerCase() === 'yes');
      });
    });
  }

  /**
   * Execute the full migration process
   */
  async migrate(
    newDatasourceId: string,
    blueprint?: string,
    dryRun?: boolean
  ): Promise<MigrationStats> {
    try {
      // If blueprint not specified, migrate all
      let blueprintsToMigrate: string[];
      if (!blueprint) {
        blueprintsToMigrate = await this.client.getBlueprintsByDataSource(
          this.config.oldInstallationId
        );
        if (blueprintsToMigrate.length === 0) {
          Logger.warn('⚠️  No blueprints found for the specified installation');
          this.rl.close();
          return this.stats;
        }
      } else {
        blueprintsToMigrate = [blueprint];
      }

      this.stats.totalBlueprints = blueprintsToMigrate.length;

      // Fetch and cache entities for all blueprints
      const entitiesByBlueprint = new Map<string, Entity[]>();
      let totalEntitiesToMigrate = 0;

      for (const bp of blueprintsToMigrate) {
        try {
          const entities = await this.client.searchOldEntitiesByBlueprint(
            bp,
            this.config.oldInstallationId
          );
          entitiesByBlueprint.set(bp, entities);
          totalEntitiesToMigrate += entities.length;
        } catch (error) {
          // Continue if one blueprint fails to fetch
          entitiesByBlueprint.set(bp, []);
        }
      }

      // Exit if no entities to migrate
      if (totalEntitiesToMigrate === 0) {
        Logger.warn('⚠️  No entities found to migrate');
        this.rl.close();
        return this.stats;
      }

      // Show entity count and warning
      Logger.log('\n' + '━'.repeat(70));
      Logger.log(`📊 Migration Summary: ${totalEntitiesToMigrate} entities will be affected`);
      Logger.log('━'.repeat(70));
      Logger.log('');
      Logger.log('⚠️  WARNING: This action cannot be undone!');
      Logger.log('You are about to change the datasource ownership of entities.');
      Logger.log('This will reassign them from the old GitHub App to the new Ocean integration.');
      Logger.log('');
      Logger.log('✅ Recommendations:');
      Logger.log('   1. Run diff command FIRST to verify the changes:');
      Logger.log(`      port-github-migrator diff <blueprint> <blueprint>`);
      Logger.log('   2. Test with --dry-run flag to see what would be migrated:');
      Logger.log(`      migrate ${blueprint || '--all'} --dry-run`);
      Logger.log('');
      Logger.log(`Blueprints to migrate: ${blueprintsToMigrate.join(', ')}`);
      Logger.log('━'.repeat(70) + '\n');

      // Wait for strict confirmation before starting
      const confirmed = await this.waitForStrictConfirmation(
        `Proceed with migration? Type 'yes' to confirm: `
      );
      if (!confirmed) {
        Logger.log('❌ Migration cancelled by user');
        this.rl.close();
        return this.stats;
      }

      // Migrate each blueprint
      Logger.log('');
      for (let i = 0; i < blueprintsToMigrate.length; i++) {
        const bp = blueprintsToMigrate[i];
        if (i > 0) Logger.log('');
        Logger.log(`[${i + 1}/${blueprintsToMigrate.length}] Migrating ${bp}...`);
        const entities = entitiesByBlueprint.get(bp) || [];
        await this.migrateBlueprint(bp, entities, newDatasourceId, dryRun);
      }

      // Print final report
      this.printMigrationReport();
      this.rl.close();
      return this.stats;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred during migration';
      Logger.error(`❌ Migration failed: ${errorMessage}`);
      this.stats.errors.push(errorMessage);
      this.rl.close();
      throw error;
    }
  }

  /**
   * Migrate entities for a single blueprint
   */
  private async migrateBlueprint(
    blueprintIdentifier: string,
    entities: Entity[],
    newDatasourceId: string,
    dryRun?: boolean
  ): Promise<void> {
    try {
      this.stats.totalEntities += entities.length;

      if (entities.length === 0) {
        Logger.log(`  ✅ 0 entities to migrate`);
        return;
      }

      Logger.log(`  📊 ${entities.length} entities will be migrated`);

      if (!dryRun) {
        // Patch entities in batches
        await this.patchEntitiesInBatches(blueprintIdentifier, entities, newDatasourceId);
      } else {
        Logger.log(`  (dry-run mode - no changes made)`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to migrate blueprint';
      this.stats.errors.push(`Blueprint ${blueprintIdentifier}: ${errorMessage}`);
      Logger.error(`❌ ${errorMessage}`);
    }
  }

  /**
   * Patch entities in batches
   */
  private async patchEntitiesInBatches(
    blueprintIdentifier: string,
    entities: Entity[],
    newDatasourceId: string
  ): Promise<void> {
    const batches = this.createBatches(entities, BATCH_SIZE);
    this.stats.totalBatches += batches.length;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      try {
        const entityIdentifiers = batch.map((entity) => entity.identifier);
        await this.client.patchEntitiesDatasourceBulk(
          blueprintIdentifier,
          entityIdentifiers,
          newDatasourceId
        );

        this.stats.successfulBatches++;
      } catch (error) {
        this.stats.failedBatches++;
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error during batch patch';
        this.stats.errors.push(`Batch ${i} for blueprint ${blueprintIdentifier}: ${errorMessage}`);
        Logger.error(`❌ Batch failed: ${errorMessage}`);
      }
    }
  }

  /**
   * Split entities into batches
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Print migration summary report
   */
  private printMigrationReport(): void {
    if (this.stats.failedBatches === 0) {
      Logger.success(`\n✅ Migration completed successfully`);
      Logger.log(`   • ${this.stats.totalEntities} entities migrated\n`);
    } else {
      Logger.error(`\n❌ Migration completed with errors`);
      Logger.log(`   • ${this.stats.totalEntities} entities attempted`);
      Logger.log(`   • ${this.stats.failedBatches} batches failed\n`);
      if (this.stats.errors.length > 0) {
        this.stats.errors.forEach((error) => {
          Logger.error(`   ${error}`);
        });
      }
    }
  }
}
