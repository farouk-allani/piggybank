import { PersistentMap } from '@massalabs/massa-as-sdk/assembly/collections';

// Persistent Map to store each token pool adddress
export const tokenPool = new PersistentMap<String, String>('tokenPool');

export const WMAS_TOKEN_ADDRESS =
  'AS12FW5Rs5YN2zdpEnqwj4iHUUPt9R4Eqjq2qtpJFNKW3mn33RuLU';
export const USDC_TOKEN_ADDRESS =
  'AS12N76WPYB3QNYKGhV2jZuQs1djdhNJLQgnm7m52pHWecvvj1fCQ';
export const WETH_TOKEN_ADDRESS =
  'AS12rcqHGQ3bPPhnjBZsYiANv9TZxYp96M7r49iTMUrX8XCJQ8Wrk';
export const BTC_TOKEN_ADDRESS =
  'AS1ZXy3nvqXAMm2w6viAg7frte6cZfJM8hoMvWf4KoKDzvLzYKqE';

export const BASE_TOKEN_ADDRESS = USDC_TOKEN_ADDRESS;