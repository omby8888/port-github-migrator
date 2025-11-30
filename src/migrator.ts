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
   * Pause and wait for user confirmation
   */
  private async waitForUserInput(prompt: string = 'Continue? [y/N] '): Promise<void> {
    return new Promise((resolve) => {
      this.rl.question(prompt, () => {
        resolve();
      });
    });
  }

  /**
   * Execute the full migration process
   */
  async migrate(newDatasourceId: string, singleBlueprint?: string): Promise<MigrationStats> {
    try {
      Logger.info('Fetching blueprints...');

      let blueprintsIdentifiers = await this.client.getBlueprintsByDataSource(
        this.config.oldInstallationId
      );
      this.stats.totalBlueprints = blueprintsIdentifiers.length;

      if (blueprintsIdentifiers.length === 0) {
        Logger.warn('⚠️  No blueprints found for the specified installation');
        this.rl.close();
        return this.stats;
      }

      // Filter to single blueprint if specified
      if (singleBlueprint) {
        blueprintsIdentifiers = blueprintsIdentifiers.filter((bp) => bp === singleBlueprint);
        if (blueprintsIdentifiers.length === 0) {
          Logger.warn(`⚠️  Blueprint not found: ${singleBlueprint}`);
          this.rl.close();
          return this.stats;
        }
      }

      // Show all blueprints before starting
      Logger.log('\nBlueprintsToMigrate:');
      blueprintsIdentifiers.forEach((id) => {
        Logger.log(`  - ${id}`);
      });

      // Wait for user confirmation before starting
      await this.waitForUserInput(`\nMigrate ${blueprintsIdentifiers.length} blueprint(s)? [y/N] `);

      // Step 3: For each blueprint, fetch entities and patch them
      for (let i = 0; i < blueprintsIdentifiers.length; i++) {
        const blueprintIdentifier = blueprintsIdentifiers[i];
        Logger.log(
          `\n[${i + 1}/${blueprintsIdentifiers.length}] Migrating ${blueprintIdentifier}...`
        );

        // Search and migrate entities for this blueprint right before migrating
        await this.migrateBlueprint(
          blueprintIdentifier,
          this.config.oldInstallationId,
          newDatasourceId
        );

        // Wait between blueprints (except after the last one)
        if (i < blueprintsIdentifiers.length - 1) {
          await this.waitForUserInput(`Continue? [y/N] `);
        }
      }

      // Print final report
      this.printMigrationReport();
      this.rl.close();
      return this.stats;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred during migration';
      Logger.error(`\n❌ Migration failed: ${errorMessage}\n`);
      this.stats.errors.push(errorMessage);
      this.rl.close();
      throw error;
    }
  }

  /**
   * Display overview of all blueprints before migration
   */
  private async displayBlueprintsOverview(
    blueprintsIdentifiers: string[],
    oldInstallationId: string
  ): Promise<void> {
    Logger.log('\n📋 BLUEPRINTS TO MIGRATE:\n');
    Logger.log('The following blueprints will be processed:');
    Logger.log('');

    let totalEntities = 0;

    for (let i = 0; i < blueprintsIdentifiers.length; i++) {
      const blueprintIdentifier = blueprintsIdentifiers[i];
      try {
        const entities = await this.client.searchOldEntitiesByBlueprint(
          blueprintIdentifier,
          oldInstallationId
        );
        totalEntities += entities.length;
        Logger.log(`  ${i + 1}. ${blueprintIdentifier}`);
        Logger.log(`     └─ ${entities.length} entities to migrate`);
      } catch (error) {
        Logger.log(`  ${i + 1}. ${blueprintIdentifier}`);
        Logger.log(`     └─ (error fetching count)`);
      }
    }

    Logger.log(`\n📊 Summary:`);
    Logger.log(`   • Total Blueprints: ${blueprintsIdentifiers.length}`);
    Logger.log(`   • Total Entities: ${totalEntities}`);
    Logger.log(`${'─'.repeat(60)}`);
  }

  /**
   * Migrate entities for a single blueprint
   */
  private async migrateBlueprint(
    blueprintIdentifier: string,
    oldInstallationId: string,
    newDatasourceId: string
  ): Promise<void> {
    try {
      // Fetch all entities for this blueprint
      const entities = await this.client.searchOldEntitiesByBlueprint(
        blueprintIdentifier,
        oldInstallationId
      );
      this.stats.totalEntities += entities.length;

      if (entities.length === 0) {
        Logger.log('  0 entities');
        return;
      }

      Logger.log(`  Found ${entities.length} entities`);

      // Wait for user confirmation before migrating
      await this.waitForUserInput(`  Proceed? [y/N] `);

      // Patch entities in batches
      await this.patchEntitiesInBatches(blueprintIdentifier, entities, newDatasourceId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to migrate blueprint';
      this.stats.errors.push(`Blueprint ${blueprintIdentifier}: ${errorMessage}`);
      Logger.error(`error: ${errorMessage}`);
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
        Logger.error(`  ❌ Batch ${i} failed: ${errorMessage}`);
      }
    }
    Logger.success(
      `✅ Completed patching for blueprint ${blueprintIdentifier}: ${this.stats.successfulBatches}/${batches.length} batches successful`
    );
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
    Logger.log('');
    Logger.log(`Blueprints migrated: ${this.stats.totalBlueprints}`);
    Logger.log(`Entities migrated: ${this.stats.totalEntities}`);
    Logger.log(`Batches: ${this.stats.successfulBatches}/${this.stats.totalBatches} successful`);

    if (this.stats.errors.length > 0) {
      Logger.log(`\nErrors:`);
      this.stats.errors.forEach((error) => {
        Logger.error(`  ${error}`);
      });
    }
    Logger.log('');

    const successRate =
      this.stats.totalBatches > 0
        ? ((this.stats.successfulBatches / this.stats.totalBatches) * 100).toFixed(2)
        : '0.00';

    Logger.log(
      this.stats.failedBatches === 0
        ? '🎉 Migration completed successfully!\n'
        : `Migration completed with ${this.stats.failedBatches} failed batches (Success rate: ${successRate}%)\n`
    );
  }
}
