/**
 * Type definitions for Port API responses and migration data structures
 */

export interface MigrationConfig {
  portApiUrl: string;
  clientId: string;
  clientSecret: string;
  oldInstallationId: string;
  newInstallationId: string;
}

export interface DataSource {
  blueprints: {
    updatedAt: string;
    identifier: string;
  }[];
  context: {
    installationId: string;
  };
}

export interface SearchResult {
  entities: Entity[];
  next?: string;
}

export interface Entity {
  identifier: string;
  blueprint: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BulkPatchRequest {
  entitiesIdentifiers: string[];
  datasource: string;
}

export interface MigrationStats {
  totalBlueprints: number;
  totalEntities: number;
  totalBatches: number;
  successfulBatches: number;
  failedBatches: number;
  errors: string[];
}
