import {
  Account,
  Args,
  bytesToStr,
  Mas,
  OperationStatus,
  parseMas,
  parseUnits,
  Provider,
  SmartContract,
  U64,
  Web3Provider,
} from '@massalabs/massa-web3';
import { TokenWithPercentage } from './structs/TokenWithPercentage';
import { getScByteCode } from '../utils';

export async function createSplitterVault(
  factoryContract: SmartContract,
  tokensWithPercentage: TokenWithPercentage[],
) {
  console.log('Creating splitter vault...');

  const initCoins = '0.1'; // Initial coins to send to the splitter vault

  const args = new Args()
    .addSerializableObjectArray(tokensWithPercentage)
    .addU64(parseMas(initCoins))
    .serialize();

  const operation = await factoryContract.call('createSplitterVault', args, {
    coins: parseMas('5'),
  });
  console.log(`Operation ID: ${operation.id}`);
  console.log('Waiting for the operation to be executed...');

  // Wait for the operation to be executed
  const status = await operation.waitSpeculativeExecution();

  if (status === OperationStatus.SpeculativeSuccess) {
    console.log('Splitter vault created successfully');
  } else {
    console.log('Status:', status);
    // Show speculativ events for debugging
    const spec_events = await operation.getSpeculativeEvents();
    console.log('Speculative events:', spec_events);
    throw new Error('Failed to create new splitter vault');
  }
}

export async function getUserSplitterVaults(
  provider: Web3Provider,
  userAddress: string,
  factoryContract: SmartContract,
): Promise<string[]> {
  const keys = await provider.getStorageKeys(
    factoryContract.address,
    'SPL:' + userAddress + ':',
    false,
  );

  const splitterVaults = [];

  for (const key of keys) {
    console.log('Raw key:', key);
    const deserializedKey = bytesToStr(key);
    console.log('Deserialized key:', deserializedKey);
    // The key format is "SPL:<user_address>:<vault_address>"
    // We can split the string by ':' and take the last part as the vault address
    const parts = deserializedKey.split(':');
    if (parts.length === 3) {
      const vaultAddress = parts[2];
      splitterVaults.push(vaultAddress);
    } else {
      console.warn(`Unexpected key format: ${deserializedKey}`);
    }
  }

  console.log(
    `Found ${splitterVaults.length} splitter vault(s) for user ${userAddress}`,
  );

  return splitterVaults;
}

export async function createAndDepositSplitterVault(
  factoryContract: SmartContract,
  tokensWithPercentage: TokenWithPercentage[],
  amount: string,
) {
  console.log('Creating splitter vault...');

  const initCoins = '0.1'; // Initial coins to send to the splitter vault
  const depositCoins = '0.1'; // Coins to send for the deposit transaction
  const coinsToUse = '0.02'; // Amount of coins to use for each swap

  const args = new Args()
    .addSerializableObjectArray(tokensWithPercentage)
    .addU64(parseMas(initCoins))
    .addU64(parseMas(depositCoins))
    .addU256(parseUnits(amount, 6)) // Assuming amount is in USDC with 6 decimals
    .addU64(parseMas(coinsToUse)) // coinsToUse
    .addU64(U64.MAX) // A far future timestamp for testing purposes
    .serialize();

  const coins = parseMas('5');

  const operation = await factoryContract.call(
    'createAndDepositSplitterVault',
    args,
    {
      coins,
    },
  );
  console.log(`Operation ID: ${operation.id}`);
  console.log('Waiting for the operation to be executed...');

  // Wait for the operation to be executed
  const status = await operation.waitSpeculativeExecution();

  if (status === OperationStatus.SpeculativeSuccess) {
    console.log('Splitter vault created successfully');
  } else {
    console.log('Status:', status);
    // Show speculativ events for debugging
    const spec_events = await operation.getSpeculativeEvents();
    console.log('Speculative events:', spec_events);
    throw new Error('Failed to create new splitter vault');
  }
}

export async function deployFactory(
  provider: Web3Provider,
): Promise<SmartContract> {
  console.log('Deploying factory contract...');

  const eaglefiRouterAddress =
    'AS1Kf2KVdYghv9PeVcgQKVBpuVAqdvfwwMbGuffByxJbSMLqLvVo';

  const byteCode = getScByteCode('build', 'factory.wasm');
  const splitterByteCode = getScByteCode('build', 'splitter.wasm');

  // First, deploy the splitter template contract

  const tokensWithPercentage: TokenWithPercentage[] = []; // No initial tokens with percentage

  const splitterArgs = new Args()
    .addSerializableObjectArray(tokensWithPercentage)
    .addString(provider.address)
    .addString(eaglefiRouterAddress);

  const splitterContract = await SmartContract.deploy(
    provider,
    splitterByteCode,
    splitterArgs,
    {
      coins: Mas.fromString('0.1'), // Initial coins to store in the contract
    },
  );

  console.log(
    'Splitter Template Contract deployed at:',
    splitterContract.address,
  );

  const constructorArgs = new Args()
    .addString(eaglefiRouterAddress)
    .addString(splitterContract.address); // Splitter Template Address

  const contract = await SmartContract.deploy(
    provider,
    byteCode,
    constructorArgs,
    {
      coins: Mas.fromString('0.1'),
    },
  );

  console.log('Factory Contract deployed at:', contract.address);

  return contract;
}
