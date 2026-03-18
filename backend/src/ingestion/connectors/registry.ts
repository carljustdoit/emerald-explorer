import { DataConnector } from './types.js';

class ConnectorRegistry {
  private connectors: Map<string, DataConnector> = new Map();

  /**
   * Register a new data connector.
   */
  register(connector: DataConnector) {
    if (this.connectors.has(connector.name)) {
      console.warn(`[Registry] Connector ${connector.name} is already registered. Overwriting.`);
    }
    this.connectors.set(connector.name, connector);
  }

  /**
   * Retrieve all registered connectors.
   */
  getAllConnectors(): DataConnector[] {
    return Array.from(this.connectors.values());
  }

  /**
   * Retrieve all connectors that are currently enabled.
   */
  getEnabledConnectors(): DataConnector[] {
    return this.getAllConnectors().filter(c => c.enabled);
  }

  /**
   * Retrieve a specific connector by name.
   */
  getConnector(name: string): DataConnector | undefined {
    return this.connectors.get(name);
  }
}

export const connectorRegistry = new ConnectorRegistry();
