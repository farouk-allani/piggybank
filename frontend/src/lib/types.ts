import { Args, DeserializedResult, Serializable } from '@massalabs/massa-web3';

// Constants for token decimals
export const USDC_DECIMALS = 6;
export const WMAS_DECIMALS = 9;
export const WETH_DECIMALS = 18;
export const WBTC_DECIMALS = 8;

// TokenWithPercentage class for smart contract interaction
export class TokenWithPercentage implements Serializable<TokenWithPercentage> {
  constructor(public address: string = '', public percentage: bigint = 0n) { }

  serialize(): Uint8Array {
    const args = new Args()
      .addString(this.address)
      .addU64(this.percentage)
      .serialize();

    return new Uint8Array(args);
  }

  deserialize(
    data: Uint8Array,
    offset: number,
  ): DeserializedResult<TokenWithPercentage> {
    const args = new Args(data, offset);

    this.address = args.nextString();
    this.percentage = args.nextU64();

    return { instance: this, offset: args.getOffset() };
  }

  toString(): string {
    return `TokenWithPercentage { address: ${this.address}, percentage: ${this.percentage} }`;
  }
}

// Frontend types for form handling
export interface TokenSelection {
  address: string;
  symbol: string;
  name: string;
  logo: string;
  percentage: number;
  isSelected: boolean;
}

export interface VaultFormData {
  name: string;
  tokens: TokenSelection[];
}

export interface VaultInfo {
  address: string;
  name: string;
  tokens: TokenSelection[];
  createdAt: Date;
  totalDeposited: string;
}

// Token addresses
export const USDC_TOKEN_ADDRESS = 'AS12N76WPYB3QNYKGhV2jZuQs1djdhNJLQgnm7m52pHWecvvj1fCQ';
export const WMAS_TOKEN_ADDRESS = 'AS12FW5Rs5YN2zdpEnqwj4iHUUPt9R4Eqjq2qtpJFNKW3mn33RuLU';
export const WETH_TOKEN_ADDRESS = 'AS12rcqHGQ3bPPhnjBZsYiANv9TZxYp96M7r49iTMUrX8XCJQ8Wrk';
export const WBTC_TOKEN_ADDRESS = 'AS1ZXy3nvqXAMm2w6viAg7frte6cZfJM8hoMvWf4KoKDzvLzYKqE';

// Base token for deposits (USDC)
export const BASE_TOKEN_ADDRESS = USDC_TOKEN_ADDRESS;

// Predefined tokens for Massa network
export const AVAILABLE_TOKENS: Omit<TokenSelection, 'percentage' | 'isSelected'>[] = [
  {
    address: WMAS_TOKEN_ADDRESS,
    symbol: 'WMAS',
    name: 'Wrapped MAS',
    logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/23862.png'
  },
  {
    address: USDC_TOKEN_ADDRESS,
    symbol: 'USDC',
    name: 'USD Coin',
    logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png'
  },
  {
    address: WETH_TOKEN_ADDRESS,
    symbol: 'WETH',
    name: 'Wrapped Ethereum',
    logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png'
  },
  {
    address: WBTC_TOKEN_ADDRESS,
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png'
  }
];