/**
 * Main migration orchestrator - coordinates the migration process
 */

import { PortApiClient } from './port-client';
import { MigrationConfig, MigrationStats, Entity } from './types';
import * as readline from 'readline';

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
  private async waitForUserInput(prompt: string = 'Press ENTER to continue...'): Promise<void> {
    return new Promise((resolve) => {
      this.rl.question(`\n⏸️  ${prompt}`, () => {
        resolve();
      });
    });
  }

  /**
   * Execute the full migration process
   */
  async migrate(newDatasourceId: string, singleBlueprint?: string): Promise<MigrationStats> {
    try {
      console.log('\n🚀 Starting Port Entity Migration\n');
      console.log('Configuration:');
      console.log(`  📍 Port API URL: ${this.config.portApiUrl}`);
      console.log(`  🔑 Old Installation ID: ${this.config.oldInstallationId}`);
      console.log(`  🔄 New Installation ID: ${newDatasourceId}\n`);

      let blueprintsIdentifiers = await this.client.getBlueprintsByDataSource(
        this.config.oldInstallationId
      );
      this.stats.totalBlueprints = blueprintsIdentifiers.length;

      if (blueprintsIdentifiers.length === 0) {
        console.log('⚠️  No blueprints found for the specified installation');
        this.rl.close();
        return this.stats;
      }

      // Filter to single blueprint if specified
      if (singleBlueprint) {
        blueprintsIdentifiers = blueprintsIdentifiers.filter((bp) => bp === singleBlueprint);
        if (blueprintsIdentifiers.length === 0) {
          console.log(`⚠️  Blueprint not found: ${singleBlueprint}`);
          this.rl.close();
          return this.stats;
        }
      }

      // Show all blueprints before starting
      console.log('\n📋 BLUEPRINTS TO MIGRATE:\n');
      blueprintsIdentifiers.forEach((id, idx) => {
        console.log(`  ${idx + 1}. ${id}`);
      });
      console.log(`\n📊 Total: ${blueprintsIdentifiers.length} blueprints\n`);

      // Wait for user confirmation before starting
      await this.waitForUserInput('Ready to begin migration? Press ENTER to start...');

      // Step 3: For each blueprint, fetch entities and patch them
      for (let i = 0; i < blueprintsIdentifiers.length; i++) {
        const blueprintIdentifier = blueprintsIdentifiers[i];
        console.log(`\n${'='.repeat(60)}`);
        console.log(
          `📍 Blueprint ${i + 1}/${blueprintsIdentifiers.length}: ${blueprintIdentifier}`
        );
        console.log(`${'='.repeat(60)}\n`);

        // Search and migrate entities for this blueprint right before migrating
        await this.migrateBlueprint(
          blueprintIdentifier,
          this.config.oldInstallationId,
          newDatasourceId
        );

        // Wait between blueprints (except after the last one)
        if (i < blueprintsIdentifiers.length - 1) {
          await this.waitForUserInput(
            `Blueprint ${i + 1} complete. Press ENTER for next blueprint...`
          );
        }
      }

      // Print final report
      this.printMigrationReport();
      this.rl.close();
      return this.stats;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred during migration';
      console.error(`\n❌ Migration failed: ${errorMessage}\n`);
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
    console.log('\n📋 BLUEPRINTS TO MIGRATE:\n');
    console.log('The following blueprints will be processed:');
    console.log('');

    let totalEntities = 0;

    for (let i = 0; i < blueprintsIdentifiers.length; i++) {
      const blueprintIdentifier = blueprintsIdentifiers[i];
      try {
        const entities = await this.client.searchEntitiesByBlueprint(
          blueprintIdentifier,
          oldInstallationId
        );
        totalEntities += entities.length;
        console.log(`  ${i + 1}. ${blueprintIdentifier}`);
        console.log(`     └─ ${entities.length} entities to migrate`);
      } catch (error) {
        console.log(`  ${i + 1}. ${blueprintIdentifier}`);
        console.log(`     └─ (error fetching count)`);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   • Total Blueprints: ${blueprintsIdentifiers.length}`);
    console.log(`   • Total Entities: ${totalEntities}`);
    console.log(`${'─'.repeat(60)}`);
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
      console.log(`\n📋 Processing blueprint: ${blueprintIdentifier}`);
      console.log('─'.repeat(50));

      // Fetch all entities for this blueprint
      const entities = await this.client.searchEntitiesByBlueprint(
        blueprintIdentifier,
        oldInstallationId
      );
      this.stats.totalEntities += entities.length;

      if (entities.length === 0) {
        console.log('No entities found for this blueprint');
        return;
      }

      console.log(`\n📊 Found ${entities.length} entities to migrate`);

      // Wait for user confirmation before migrating
      await this.waitForUserInput(
        `Ready to migrate these ${entities.length} entities? Press ENTER to continue...`
      );

      // Patch entities in batches
      await this.patchEntitiesInBatches(blueprintIdentifier, entities, newDatasourceId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to migrate blueprint';
      this.stats.errors.push(`Blueprint ${blueprintIdentifier}: ${errorMessage}`);
      console.error(`❌ Error: ${errorMessage}`);
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
    console.log(`\n🔄 Patching ${entities.length} entities in batches of ${BATCH_SIZE}...\n`);

    const batches = this.createBatches(entities, BATCH_SIZE);
    this.stats.totalBatches += batches.length;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchNumber = i + 1;

      try {
        console.log(
          `  Batch ${batchNumber}/${batches.length}: Patching ${batch.length} entities...`
        );

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
        this.stats.errors.push(
          `Batch ${batchNumber} for blueprint ${blueprintIdentifier}: ${errorMessage}`
        );
        console.error(`  ❌ Batch ${batchNumber} failed: ${errorMessage}`);
      }
    }

    console.log(
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
    console.log('\n' + '═'.repeat(60));
    console.log('📊 MIGRATION SUMMARY REPORT');
    console.log('═'.repeat(60) + '\n');

    console.log('✅ Migration Statistics:');
    console.log(`  • Total Blueprints: ${this.stats.totalBlueprints}`);
    console.log(`  • Total Entities Migrated: ${this.stats.totalEntities}`);
    console.log(`  • Total Batches: ${this.stats.totalBatches}`);
    console.log(`  • Successful Batches: ${this.stats.successfulBatches}`);
    console.log(`  • Failed Batches: ${this.stats.failedBatches}`);

    if (this.stats.errors.length > 0) {
      console.log(`\n⚠️  Errors (${this.stats.errors.length}):`);
      this.stats.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    } else {
      console.log('\n✅ No errors encountered');
    }

    console.log('\n' + '═'.repeat(60) + '\n');

    const successRate =
      this.stats.totalBatches > 0
        ? ((this.stats.successfulBatches / this.stats.totalBatches) * 100).toFixed(2)
        : '0.00';

    console.log(
      this.stats.failedBatches === 0
        ? '🎉 Migration completed successfully!\n'
        : `⚠️  Migration completed with ${this.stats.failedBatches} failed batches (Success rate: ${successRate}%)\n`
    );
  }
}
