import {
  Args,
  Mas,
  OperationStatus,
  parseUnits,
  SmartContract,
  Web3Provider,
} from '@massalabs/massa-web3';
import { getScByteCode } from '../utils';

export async function deployLiqManager(
  provider: Web3Provider,
  poolAddress: string = 'AS112Wdy9pM4fvLNLHQXyf7uam9waMPdG5ekr4vxCyQHPkrMMPPY',
  routerAddress: string = 'AS1XqtvX3rz2RWbnqLfaYVKEjM3VS5pny9yKDdXcmJ5C1vrcLEFd',
  intervalsMs: number = 60000,
): Promise<SmartContract> {
  console.log('Deploying liq manager contract...');

  const byteCode = getScByteCode('build', 'liqManager.wasm');

  const constructorArgs = new Args()
    .addString(poolAddress)
    .addString(routerAddress)
    .addU64(BigInt(intervalsMs));

  const contract = await SmartContract.deploy(
    provider,
    byteCode,
    constructorArgs,
    {
      coins: Mas.fromString('0.3'),
    },
  );

  console.log('Liq Manager Contract deployed at:', contract.address);

  return contract;
}

export async function addLiquidity(
  liqManagerContract: SmartContract,
  binsRange: number,
  amountX: string,
  amountY: string,
  xDecimals: number = 9,
  yDecimals: number = 6,
) {
  console.log('Adding liquidity...');

  const args = new Args()
    .addU64(BigInt(binsRange))
    .addU256(parseUnits(amountX, xDecimals))
    .addU256(parseUnits(amountY, yDecimals))
    .serialize();

  const tx = await liqManagerContract.call('addLiquidity', args, {
    coins: Mas.fromString('0.01'),
  });

  const status = await tx.waitSpeculativeExecution();

  if (status === OperationStatus.SpeculativeSuccess) {
    console.log('Liquidity added successfully');
  } else {
    console.log('Status:', status);
    // Show speculative events for debugging
    const spec_events = await tx.getSpeculativeEvents();
    console.log('Speculative events:', spec_events);
    throw new Error('Failed to add liquidity');
  }
}
