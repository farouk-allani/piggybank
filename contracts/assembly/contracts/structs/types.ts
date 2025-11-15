import { u256 } from 'as-bignum/assembly';

export class TokensAmount {
  constructor(public readonly amountX: u256, public readonly amountY: u256) {}
}
