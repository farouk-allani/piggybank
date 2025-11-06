import {
  Account,
  Args,
  BUILDNET_TOKENS,
  Mas,
  SmartContract,
  Web3Provider,
} from '@massalabs/massa-web3';
import { getScByteCode } from '../src/utils';
import { getPoolReserves, increaseAllownace } from './calls/basicPool';
import {
  createNewPoolWithLiquidity,
  getPool,
  getPools,
} from './calls/registry';

const account = await Account.fromEnv();
const provider = Web3Provider.buildnet(account);
const wmasAddress = BUILDNET_TOKENS.WMAS;
const USDCAddress = 'AS12N76WPYB3QNYKGhV2jZuQs1djdhNJLQgnm7m52pHWecvvj1fCQ';
const WETHAddress = 'AS12rcqHGQ3bPPhnjBZsYiANv9TZxYp96M7r49iTMUrX8XCJQ8Wrk';
const BTCAddress = 'AS1ZXy3nvqXAMm2w6viAg7frte6cZfJM8hoMvWf4KoKDzvLzYKqE';

// Create list of pools with liquidity
const registryAddress = 'AS12AhgNHNydcESphMopqWzcRbwZKfeGpvH17vh9xejnEySDWiagC';
const registryContract = new SmartContract(provider, registryAddress);

// fIRST usdc - wmas pool
async function createUSDCWMASPool() {
  const aTokenAddress = USDCAddress;
  const bTokenAddress = wmasAddress;
  const aAmount = 40;
  const bAmount = 10_000;
  const inputFeeRate = 0.3 * 10_000;

  //  Increase allownace for both tokens
  await increaseAllownace(
    aTokenAddress,
    registryContract.address,
    aAmount,
    provider,
  );

  await increaseAllownace(
    bTokenAddress,
    registryContract.address,
    bAmount,
    provider,
  );

  //  Create a new pool with liquidity
  await createNewPoolWithLiquidity(
    registryContract,
    aTokenAddress,
    bTokenAddress,
    aAmount,
    bAmount,
    0,
    0,
    inputFeeRate,
    false, // isNativeMas
    6, // usdc decimals
    9, // wmas decimals
  );

  const pool = await getPool(
    registryContract,
    aTokenAddress,
    bTokenAddress,
    inputFeeRate,
  );

  console.log('USDC-WMAS Pool Address:', pool.poolAddress);

  const poolContract = new SmartContract(provider, pool.poolAddress);

  //  get pool reserves
  const [aReserve, bReserve] = await getPoolReserves(poolContract);

  console.log('USDC-WMAS Pool Reserves:', {
    aReserve,
    bReserve,
  });
}

// Second WETH - wmas pool
async function createWETHWMASPool() {
  const aTokenAddress = WETHAddress;
  const bTokenAddress = wmasAddress;
  const aAmount = 1;
  const bAmount = 10_000;
  const inputFeeRate = 0.3 * 10_000;

  //  Increase allownace for both tokens
  await increaseAllownace(
    aTokenAddress,
    registryContract.address,
    aAmount,
    provider,
  );

  await increaseAllownace(
    bTokenAddress,
    registryContract.address,
    bAmount,
    provider,
  );

  //  Create a new pool with liquidity
  await createNewPoolWithLiquidity(
    registryContract,
    aTokenAddress,
    bTokenAddress,
    aAmount,
    bAmount,
    0,
    0,
    inputFeeRate,
    false, // isNativeMas
    18, // weth decimals
    9, // wmas decimals
  );

  const pool = await getPool(
    registryContract,
    aTokenAddress,
    bTokenAddress,
    inputFeeRate,
  );

  console.log('WETH-WMAS Pool Address:', pool.poolAddress);

  const poolContract = new SmartContract(provider, pool.poolAddress);

  //  get pool reserves
  const [aReserve, bReserve] = await getPoolReserves(poolContract);

  console.log('WETH-WMAS Pool Reserves:', {
    aReserve,
    bReserve,
  });
}

// Third btc - wmas pool
async function createBTCWMASPool() {
  const aTokenAddress = BTCAddress;
  const bTokenAddress = wmasAddress;
  const aAmount = 0.1;
  const bAmount = 30_000;
  const inputFeeRate = 0.3 * 10_000;

  //  Increase allownace for both tokens
  await increaseAllownace(
    aTokenAddress,
    registryContract.address,
    aAmount,
    provider,
  );

  await increaseAllownace(
    bTokenAddress,
    registryContract.address,
    bAmount,
    provider,
  );

  //  Create a new pool with liquidity
  await createNewPoolWithLiquidity(
    registryContract,
    aTokenAddress,
    bTokenAddress,
    aAmount,
    bAmount,
    0,
    0,
    inputFeeRate,
    false, // isNativeMas
    8, // btc decimals
    9, // wmas decimals
  );

  const pool = await getPool(
    registryContract,
    aTokenAddress,
    bTokenAddress,
    inputFeeRate,
  );

  console.log('BTC-WMAS Pool Address:', pool.poolAddress);

  const poolContract = new SmartContract(provider, pool.poolAddress);

  //  get pool reserves
  const [aReserve, bReserve] = await getPoolReserves(poolContract);

  console.log('BTC-WMAS Pool Reserves:', {
    aReserve,
    bReserve,
  });
}

const pools = await getPools(registryContract);

console.log('Existing pools before creation:', pools);

console.log('All pools created successfully');
