/**
 * Port API Client - handles authentication and API communication with Port
 */

import axios from 'axios';
import type { AxiosResponse } from 'axios';
import { Entity, SearchResult, DataSource, BulkPatchRequest } from './types';
import { Logger } from './logger';

export class PortApiClient {
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;
  private _token: string = '';
  private _tokenExpiration: Date = new Date();

  constructor(baseUrl: string, clientId: string, clientSecret: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  private async authenticate(): Promise<void> {
    try {
      Logger.info('🔐 Authenticating with Port API...');

      const response = await axios.post(`${this.baseUrl}/v1/auth/access_token`, {
        clientId: this.clientId,
        clientSecret: this.clientSecret,
      });

      this._token = response.data.accessToken;
      this._tokenExpiration = new Date(Date.now() + response.data.expiresIn * 1000);
      Logger.info('✅ Authentication successful');
    } catch (error) {
      throw new Error(`Authentication failed: ${this.getErrorMessage(error)}`);
    }
  }

  async getToken(): Promise<string> {
    const now = new Date().getTime();
    const ttl = this._tokenExpiration.getTime() - now;
    const threeMinutes = 3 * 60 * 1000;

    if (!this._token || ttl < threeMinutes) {
      await this.authenticate();
    }
    return this._token;
  }

  /**
   * Fetch all blueprints affected by a specific data source (installation)
   */
  async getIntegrationVersion(installationId: string): Promise<string> {
    try {
      Logger.log(`🔍 Fetching integration version for: ${installationId}`);

      const response = await axios.get(`${this.baseUrl}/v1/integration/${installationId}`, {
        headers: {
          Authorization: `Bearer ${await this.getToken()}`,
        },
      });

      const version = response.data.integration?.version;
      if (!version) {
        throw new Error('Integration version not found in response');
      }

      Logger.log(`✅ Integration version: ${version}`);
      return version;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new Error('Integration not found');
      }
      throw new Error(
        `Failed to fetch integration version: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async getBlueprintsByDataSource(installationId: string): Promise<string[]> {
    try {
      Logger.info(`📋 Fetching blueprints for installation: ${installationId}`);

      // Query the datasources API to get related blueprints
      const response = await axios.get(`${this.baseUrl}/v1/data-sources`, {
        headers: {
          Authorization: `Bearer ${await this.getToken()}`,
        },
      });

      const dataSources: DataSource[] = (response.data.dataSources || []).filter(
        (ds: DataSource) => ds.context?.installationId === installationId
      );

      if (dataSources.length === 0) {
        throw new Error(`No data sources found for installation: ${installationId}`);
      }

      Logger.info(`Found ${dataSources.length} data sources for installation`);

      // Get blueprints that use these data sources
      const blueprintsIdentifiers: Map<string, string> = new Map();
      dataSources
        .flatMap((ds) => ds.blueprints)
        .forEach((bp) => {
          blueprintsIdentifiers.set(bp.identifier, bp.identifier);
        });
      Logger.info(`✅ Found ${blueprintsIdentifiers.size} affected blueprints`);

      return Array.from(blueprintsIdentifiers.values());
    } catch (error) {
      throw new Error(`Failed to fetch blueprints by data source: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * Search for all entities of a specific blueprint
   */
  private async searchEntitiesByBlueprint(
    blueprintIdentifier: string,
    query: object = {}
  ): Promise<Entity[]> {
    try {
      const allEntities: Entity[] = [];
      let pageIndex = 0;
      let next: string | undefined = undefined;
      const limit = 200;

      while (true) {
        const response: AxiosResponse<SearchResult> = await axios.post(
          `${this.baseUrl}/v1/blueprints/${blueprintIdentifier}/entities/search`,
          {
            limit,
            ...(pageIndex > 0 ? { from: next } : {}),
            query,
          },
          {
            headers: {
              Authorization: `Bearer ${await this.getToken()}`,
            },
          }
        );

        const entities: Entity[] = response.data.entities;
        allEntities.push(...entities);

        next = response.data.next;
        if (!next) {
          break;
        }

        pageIndex++;
      }

      return allEntities;
    } catch (error) {
      throw new Error(
        `Failed to search entities for blueprint ${blueprintIdentifier}: ${this.getErrorMessage(error)}`
      );
    }
  }

  async searchOldEntitiesByBlueprint(
    blueprintIdentifier: string,
    oldInstallationId: string
  ): Promise<Entity[]> {
    return this.searchEntitiesByBlueprint(blueprintIdentifier, {
      combinator: 'and',
      rules: [
        {
          property: '$datasource',
          operator: 'contains',
          value: 'port/github/v1.0.0',
        },
        {
          property: '$datasource',
          operator: 'contains',
          value: oldInstallationId,
        },
      ],
    });
  }

  async searchNewEntitiesByBlueprint(
    blueprintIdentifier: string,
    newInstallationId: string
  ): Promise<Entity[]> {
    return this.searchEntitiesByBlueprint(blueprintIdentifier, {
      combinator: 'and',
      rules: [
        {
          property: '$datasource',
          operator: 'contains',
          value: 'port-ocean/github-ocean',
        },
        {
          property: '$datasource',
          operator: 'contains',
          value: `${newInstallationId}/exporter`,
        },
      ],
    });
  }

  /**
   * Patch entities' datasource in bulk
   */
  async patchEntitiesDatasourceBulk(
    blueprintIdentifier: string,
    entitiesIdentifiers: string[],
    newDatasource: string
  ): Promise<void> {
    if (entitiesIdentifiers.length === 0) {
      Logger.info('⏭️  Skipping batch - no entities to patch');
      return;
    }

    try {
      const payload: BulkPatchRequest = {
        entitiesIdentifiers,
        datasource: newDatasource,
      };

      await axios.patch(
        `${this.baseUrl}/v1/blueprints/${blueprintIdentifier}/datasource/bulk`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${await this.getToken()}`,
          },
        }
      );

      Logger.success(
        `✅ Successfully patched ${entitiesIdentifiers.length} entities to datasource: ${newDatasource}`
      );
    } catch (error) {
      throw new Error(
        `Failed to patch entities for blueprint ${blueprintIdentifier}: ${this.getErrorMessage(error)}`
      );
    }
  }

  /**
   * Helper method to extract error messages
   */
  private getErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
      return error.response?.data?.message || error.message;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}
