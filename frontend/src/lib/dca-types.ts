// DCA Contract Address on Buildnet (DUSA Protocol)
export const DCA_CONTRACT_ADDRESS = 'AS12Sm9oqH2C26fx7v8ZYCwyKs9LmrmRGX2WRJT3aK7KnYtrMhq8n';

// Token addresses for validation
export const WMAS_ADDRESS = 'AS12FW5Rs5YN2zdpEnqwj4iHUUPt9R4Eqjq2qtpJFNKW3mn33RuLU';
export const USDC_ADDRESS = 'AS12N76WPYB3QNYKGhV2jZuQs1djdhNJLQgnm7m52pHWecvvj1fCQ';

// DCA Status
export enum DCAStatus {
  ACTIVE = 'Active',
  PAUSED = 'Paused',
  COMPLETED = 'Completed',
  STOPPED = 'Stopped'
}

// DCA Interface
export interface DCA {
  id: number;
  amountEachDCA: bigint;
  interval: number; // in SECONDS (not milliseconds!)
  nbOfDCA: number;
  tokenPath: string[];
  threshold: number;
  moreGas: boolean;
  startTime: number; // timestamp in milliseconds
  endTime: number; // timestamp in milliseconds
  executedCount: number;
  deferredCallId: string;
}

// DCA Display Interface for UI
export interface DCADisplay extends DCA {
  status: DCAStatus;
  fromToken: string;
  toToken: string;
  amountEachDCAFormatted: string;
  intervalFormatted: string;
  progress: number; // percentage
  estimatedNextExecution?: number; // timestamp
}

// Interval presets for UI (in seconds)
export const DCA_INTERVALS = [
  { label: 'Every Hour', value: 3600 },
  { label: 'Every 6 Hours', value: 21600 },
  { label: 'Every 12 Hours', value: 43200 },
  { label: 'Daily', value: 86400 },
  { label: 'Every 3 Days', value: 259200 },
  { label: 'Weekly', value: 604800 },
  { label: 'Every 2 Weeks', value: 1209600 },
  { label: 'Monthly', value: 2592000 }
];

// Token paths for DCA (from USDC to other tokens)
export const DCA_TOKEN_PATHS = [
  {
    from: 'USDC',
    to: 'WMAS',
    path: [
      'AS12N76WPYB3QNYKGhV2jZuQs1djdhNJLQgnm7m52pHWecvvj1fCQ', // USDC
      'AS12FW5Rs5YN2zdpEnqwj4iHUUPt9R4Eqjq2qtpJFNKW3mn33RuLU'  // WMAS
    ]
  },
  {
    from: 'USDC',
    to: 'WETH',
    path: [
      'AS12N76WPYB3QNYKGhV2jZuQs1djdhNJLQgnm7m52pHWecvvj1fCQ', // USDC
      'AS12rcqHGQ3bPPhnjBZsYiANv9TZxYp96M7r49iTMUrX8XCJQ8Wrk'  // WETH
    ]
  },
  {
    from: 'WMAS',
    to: 'USDC',
    path: [
      'AS12FW5Rs5YN2zdpEnqwj4iHUUPt9R4Eqjq2qtpJFNKW3mn33RuLU',  // WMAS
      'AS12N76WPYB3QNYKGhV2jZuQs1djdhNJLQgnm7m52pHWecvvj1fCQ'  // USDC
    ]
  },
  {
    from: 'WMAS',
    to: 'WETH',
    path: [
      'AS12FW5Rs5YN2zdpEnqwj4iHUUPt9R4Eqjq2qtpJFNKW3mn33RuLU',  // WMAS
      'AS12rcqHGQ3bPPhnjBZsYiANv9TZxYp96M7r49iTMUrX8XCJQ8Wrk'  // WETH
    ]
  }
];

// Helper function to get token symbol from address
export function getTokenSymbol(address: string): string {
  const tokenMap: { [key: string]: string } = {
    'AS12N76WPYB3QNYKGhV2jZuQs1djdhNJLQgnm7m52pHWecvvj1fCQ': 'USDC',
    'AS12FW5Rs5YN2zdpEnqwj4iHUUPt9R4Eqjq2qtpJFNKW3mn33RuLU': 'WMAS',
    'AS12rcqHGQ3bPPhnjBZsYiANv9TZxYp96M7r49iTMUrX8XCJQ8Wrk': 'WETH',
    'AS1ZXy3nvqXAMm2w6viAg7frte6cZfJM8hoMvWf4KoKDzvLzYKqE': 'WBTC'
  };
  return tokenMap[address] || 'UNKNOWN';
}

// Helper function to format interval (expects seconds)
export function formatInterval(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w`;
  return `${Math.floor(seconds / 2592000)}mo`;
}

// Validation functions based on DUSA Protocol requirements

/**
 * Validates a token path for DCA according to DUSA requirements:
 * - Maximum 4 tokens in path
 * - Must include either WMAS or USDC
 * @throws Error if validation fails
 */
export function validateTokenPath(tokenPath: string[]): void {
  if (tokenPath.length > 4) {
    throw new Error('Token path cannot exceed 4 tokens');
  }

  const hasWMASorUSDC = tokenPath.some(token =>
    token === WMAS_ADDRESS || token === USDC_ADDRESS
  );

  if (!hasWMASorUSDC) {
    throw new Error('Token path must include WMAS or USDC for proper liquidity');
  }
}

/**
 * Validates DCA interval according to DUSA requirements:
 * - Minimum: 1 hour (3600 seconds = 3,600,000 milliseconds)
 * - Maximum: 2 months (5184000 seconds = 5,184,000,000 milliseconds)
 * Note: This function takes seconds as input (for UI convenience)
 * but DUSA contract expects milliseconds
 * @throws Error if validation fails
 */
export function validateInterval(intervalSeconds: number): void {
  const MIN_INTERVAL = 3600; // 1 hour in seconds
  const MAX_INTERVAL = 5184000; // 2 months in seconds

  if (intervalSeconds < MIN_INTERVAL) {
    throw new Error('Interval must be at least 1 hour (DUSA contract requirement)');
  }

  if (intervalSeconds > MAX_INTERVAL) {
    throw new Error('Interval cannot exceed 2 months');
  }
}

/**
 * Validates slippage tolerance according to DUSA requirements:
 * - Must be greater than 1%
 * @throws Error if validation fails
 */
export function validateSlippage(slippagePercent: number): void {
  if (slippagePercent <= 1) {
    throw new Error('Slippage tolerance must be greater than 1%');
  }
}

// Helper function to calculate DCA status
export function calculateDCAStatus(dca: DCA): DCAStatus {
  const now = Date.now();

  if (dca.executedCount >= dca.nbOfDCA) {
    return DCAStatus.COMPLETED;
  }

  if (!dca.deferredCallId || dca.deferredCallId === '') {
    return DCAStatus.STOPPED;
  }

  if (dca.startTime > now) {
    return DCAStatus.PAUSED;
  }

  return DCAStatus.ACTIVE;
}

// Helper function to calculate progress
export function calculateProgress(dca: DCA): number {
  if (dca.nbOfDCA === 0) return 0;
  return Math.floor((dca.executedCount / dca.nbOfDCA) * 100);
}

// Helper function to estimate next execution
export function estimateNextExecution(dca: DCA): number | undefined {
  if (dca.executedCount >= dca.nbOfDCA) return undefined;

  const now = Date.now();
  const lastExecution = dca.startTime + (dca.executedCount * dca.interval * 1000); // Convert seconds to ms
  const nextExecution = lastExecution + (dca.interval * 1000);

  return nextExecution > now ? nextExecution : now + (dca.interval * 1000);
}
