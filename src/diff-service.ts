/**
 * Service for comparing entities between source and target datasources
 */

import { PortApiClient } from './port-client';
import { Logger } from './logger';
import { FileWriter } from './file-writer';

export interface DiffResult {
  blueprint: string;
  source: {
    datasource: string;
    count: number;
    identifiers: string[];
  };
  target: {
    datasource: string;
    count: number;
    identifiers: string[];
  };
  diff: {
    identical: number; // In both with same data
    notMigrated: string[]; // In source but not in target
    changed: Array<{
      identifier: string;
      source: any;
      target: any;
    }>; // Entities that exist in both but with different data
    orphaned: string[]; // In target but not in source
  };
}

export class DiffService {
  private fileWriter: FileWriter;
  private readonly EXCLUDED_PROPS = new Set([
    'blueprint',
    'createdAt',
    'updatedAt',
    'createdBy',
    'updatedBy',
  ]);

  constructor(private client: PortApiClient) {
    this.fileWriter = new FileWriter();
  }

  private filterExcludedProps(obj: any): any {
    const filtered: any = {};
    Object.keys(obj).forEach((key) => {
      if (!this.EXCLUDED_PROPS.has(key)) {
        filtered[key] = obj[key];
      }
    });
    return filtered;
  }

  private getPropertyDiffs(
    source: any,
    target: any,
    prefix: string = ''
  ): Array<{ key: string; oldValue: any; newValue: any }> {
    const diffs: Array<{ key: string; oldValue: any; newValue: any }> = [];

    const sourceKeys = new Set(Object.keys(source));
    const targetKeys = new Set(Object.keys(target));
    const allKeys = new Set([...sourceKeys, ...targetKeys]);

    allKeys.forEach((key) => {
      if (this.EXCLUDED_PROPS.has(key)) return;

      const sourceValue = source[key];
      const targetValue = target[key];
      const fullKey = prefix ? `${prefix}.${key}` : key;

      // Deep comparison for objects
      if (
        typeof sourceValue === 'object' &&
        sourceValue !== null &&
        typeof targetValue === 'object' &&
        targetValue !== null
      ) {
        const nestedDiffs = this.getPropertyDiffs(sourceValue, targetValue || {}, fullKey);
        diffs.push(...nestedDiffs);
      } else if (JSON.stringify(sourceValue) !== JSON.stringify(targetValue)) {
        diffs.push({ key: fullKey, oldValue: sourceValue, newValue: targetValue });
      }
    });

    return diffs;
  }

  async compareBlueprint(
    sourceBlueprint: string,
    targetBlueprint: string,
    oldInstallationId: string,
    newInstallationId: string
  ): Promise<DiffResult> {
    // Fetch source entities
    const sourceEntities = await this.client.searchOldEntitiesByBlueprint(
      sourceBlueprint,
      oldInstallationId
    );

    // Fetch target entities
    const targetEntities = await this.client.searchNewEntitiesByBlueprint(
      targetBlueprint,
      newInstallationId
    );

    // Calculate diff
    const sourceMap = new Map(sourceEntities.map((e) => [e.identifier, e]));
    const targetMap = new Map(targetEntities.map((e) => [e.identifier, e]));

    const notMigrated = Array.from(sourceEntities).filter((e) => !targetMap.has(e.identifier));
    const orphaned = Array.from(targetEntities).filter((e) => !sourceMap.has(e.identifier));

    // Find changed entities (exist in both but with different data)
    const changed = Array.from(sourceMap.keys())
      .filter((id) => targetMap.has(id))
      .filter((id) => {
        const sourceFiltered = this.filterExcludedProps(sourceMap.get(id)!);
        const targetFiltered = this.filterExcludedProps(targetMap.get(id)!);
        return JSON.stringify(sourceFiltered) !== JSON.stringify(targetFiltered);
      })
      .map((id) => ({
        identifier: id,
        source: sourceMap.get(id)!,
        target: targetMap.get(id)!,
      }));

    // Identical = in both with same data (excluding metadata properties)
    const identical = Array.from(sourceMap.keys()).filter((id) => {
      if (!targetMap.has(id)) return false;
      const sourceFiltered = this.filterExcludedProps(sourceMap.get(id)!);
      const targetFiltered = this.filterExcludedProps(targetMap.get(id)!);
      return JSON.stringify(sourceFiltered) === JSON.stringify(targetFiltered);
    }).length;

    return {
      blueprint: sourceBlueprint,
      source: {
        datasource: oldInstallationId,
        count: sourceEntities.length,
        identifiers: sourceEntities.map((e) => e.identifier),
      },
      target: {
        datasource: newInstallationId,
        count: targetEntities.length,
        identifiers: targetEntities.map((e) => e.identifier),
      },
      diff: {
        identical,
        notMigrated: notMigrated.map((e) => e.identifier),
        changed,
        orphaned: orphaned.map((e) => e.identifier),
      },
    };
  }

  exportDiff(result: DiffResult, outputFile: string): string {
    const report = {
      blueprint: result.blueprint,
      timestamp: new Date().toISOString(),
      source: {
        datasource: result.source.datasource,
        count: result.source.count,
      },
      target: {
        datasource: result.target.datasource,
        count: result.target.count,
      },
      summary: {
        identical: result.diff.identical,
        notMigrated: result.diff.notMigrated.length,
        changed: result.diff.changed.length,
        orphaned: result.diff.orphaned.length,
      },
      details: {
        notMigrated: result.diff.notMigrated,
        changed: result.diff.changed,
        orphaned: result.diff.orphaned,
      },
    };

    return this.fileWriter.writeJson(outputFile, report);
  }

  printSummary(result: DiffResult): void {
    Logger.log(`\n📊 ${result.blueprint}`);
    Logger.log(`   Old: ${result.source.count} | New: ${result.target.count}`);
    Logger.log(`   ✅ ${result.diff.identical} identical`);
    if (result.diff.notMigrated.length > 0)
      Logger.log(`   ⚠️  ${result.diff.notMigrated.length} not migrated`);
    if (result.diff.changed.length > 0) Logger.log(`   📝 ${result.diff.changed.length} changed`);
    if (result.diff.orphaned.length > 0)
      Logger.log(`   ❌ ${result.diff.orphaned.length} orphaned`);
    Logger.log('');
  }

  printDetailedDiffs(
    changed: Array<{ identifier: string; source: any; target: any }>,
    limit: number = 10
  ): void {
    const total = changed.length;
    const shown = Math.min(limit, total);
    const truncated = total > limit;

    Logger.log(`\n📋 Changed Entities (showing ${shown}/${total}):\n`);

    changed.slice(0, limit).forEach((item, index) => {
      Logger.log(`${index + 1}. ${item.identifier}`);

      const sourceFiltered = this.filterExcludedProps(item.source);
      const targetFiltered = this.filterExcludedProps(item.target);

      const diffs = this.getPropertyDiffs(sourceFiltered, targetFiltered);

      diffs.forEach((diff) => {
        Logger.log(`   - ${diff.key}: ${JSON.stringify(diff.oldValue)}`);
        Logger.log(`   + ${diff.key}: ${JSON.stringify(diff.newValue)}`);
      });

      Logger.log('');
    });

    if (truncated) {
      Logger.log(
        `⚠️  ${total - limit} more entities with changes. Use --output to export full report or --limit to show more.`
      );
    }
  }
}
