import { connectorRegistry } from './registry.js';
import { SeattleSymphonyConnector } from './seattle_symphony.js';
import { UWArtsConnector } from './uw_arts.js';
import { SeattleOperaConnector } from './seattle_opera.js';
import { JazzAlleyConnector } from './jazz_alley.js';
import { StubHubConnector } from './stubhub.js';
import { FeverConnector } from './fever.js';
import { Events12Connector } from './events12.js';
import { NineteenHzConnector } from './19hz.js';
import { UWHuskiesConnector } from './uw_huskies.js';
import { TicketmasterConnector } from './ticketmaster.js';

// Instantiate and register all connectors
connectorRegistry.register(new SeattleSymphonyConnector());
connectorRegistry.register(new UWArtsConnector());
connectorRegistry.register(new SeattleOperaConnector());
connectorRegistry.register(new JazzAlleyConnector());
connectorRegistry.register(new StubHubConnector());
connectorRegistry.register(new FeverConnector());
connectorRegistry.register(new Events12Connector());
connectorRegistry.register(new NineteenHzConnector());
connectorRegistry.register(new UWHuskiesConnector());
connectorRegistry.register(new TicketmasterConnector());

// Re-export registry and types for convenience
export * from './types.js';
export * from './registry.js';
