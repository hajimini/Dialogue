/**
 * Memory Gateway Factory
 * 
 * Provides a singleton factory function to create and cache MemoryGateway instances.
 * Supports switching between different memory providers (Mem0, Letta) based on configuration.
 */

import type { MemoryGateway } from './gateway';
import { getMemoryGatewayConfig } from './config';
import { Mem0Adapter } from './adapters/mem0-adapter';

/**
 * Singleton cache for the gateway instance
 */
let gatewayInstance: MemoryGateway | null = null;

/**
 * Get or create a MemoryGateway instance
 * 
 * This function implements the singleton pattern - it creates the gateway instance
 * on first call and returns the cached instance on subsequent calls.
 * 
 * @returns {MemoryGateway} The memory gateway instance
 * @throws {Error} If the configured provider is not supported
 * 
 * @example
 * ```typescript
 * const gateway = getMemoryGateway();
 * await gateway.add({
 *   userId: 'user123',
 *   personaId: 'persona456',
 *   memoryType: 'user_fact',
 *   content: 'User likes cats',
 * });
 * ```
 */
export function getMemoryGateway(): MemoryGateway {
  // Return cached instance if available
  if (gatewayInstance) {
    return gatewayInstance;
  }
  
  // Read configuration
  const config = getMemoryGatewayConfig();
  
  // Switch based on provider
  if (config.provider === 'mem0') {
    // Instantiate Mem0Adapter with configuration
    gatewayInstance = new Mem0Adapter(config.mem0);
  } else if (config.provider === 'letta') {
    // Letta adapter is not yet implemented (Task 28)
    throw new Error(
      `Memory provider 'letta' is not yet supported. Please use 'mem0' or implement LettaAdapter (Task 28).`
    );
  } else {
    // Unknown provider
    throw new Error(
      `Unsupported memory provider: '${config.provider}'. Supported providers: 'mem0', 'letta'.`
    );
  }
  
  return gatewayInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 * 
 * @internal
 */
export function resetMemoryGateway(): void {
  gatewayInstance = null;
}
