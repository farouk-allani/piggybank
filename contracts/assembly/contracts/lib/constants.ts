import { u256 } from 'as-bignum/assembly';

export const SCALE_OFFSET = 128;
export const PRECISION: u256 = u256.fromU64(1 * 10 ** 18); // 1e18
export const BASIS_POINT_MAX = 10_000;
export const REAL_ID_SHIFT: i64 = 1 << 23;