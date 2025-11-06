import {
  Address,
  Context,
  createEvent,
  createSC,
  fileToByteArray,
  generateEvent,
  getBytecodeOf,
  Storage,
} from '@massalabs/massa-as-sdk';
import { Args, boolToByte, stringToBytes } from '@massalabs/as-types';
import { _setOwner } from './lib/ownership-internal';
import { ReentrancyGuard } from './lib/ReentrancyGuard';
import { TokenWithPercentage } from './structs/token';
import { wrapMasToWMAS } from './lib/wrapping';
import {
  BASE_TOKEN_ADDRESS,
  BTC_TOKEN_ADDRESS,
  USDC_TOKEN_ADDRESS,
  WETH_TOKEN_ADDRESS,
  WMAS_TOKEN_ADDRESS,
} from './storage';
import { ISplitter } from './interfaces/ISplitter';
import { u256 } from 'as-bignum/assembly';
import { PersistentMap } from '@massalabs/massa-as-sdk/assembly/collections';
import { onlyOwner } from './lib/ownership';
import { generateSplitterUserKey } from './lib/utils';
import { IMRC20 } from './interfaces/IMRC20';
import { getBalanceEntryCost } from '@massalabs/sc-standards/assembly/contracts/MRC20/MRC20-external';

// Mapping from token address to its corresponding eaglefi pool address
const tokensPoolsMap = new PersistentMap<string, string>('tpools');
// Storage key for eaglefi swap router address
const EAGLE_SWAP_ROUTER_ADDRESS = 'ESAPR';
const SPLITTER_TEMPLATE_ADDRESS_KEY = 'STVA';

/**
 * This function is meant to be called only one time: when the contract is deployed.
 *
 * @param binaryArgs - Arguments serialized with Args
 * - swapRouterAddress: string - The address of the eaglefi swap router
 * - splitterTemplateAddress: string - The address of the splitter template contract
 */
export function constructor(binaryArgs: StaticArray<u8>): void {
  // This line is important. It ensures that this function can't be called in the future.
  // If you remove this check, someone could call your constructor function and reset your smart contract.
  assert(Context.isDeployingContract());

  const args = new Args(binaryArgs);

  const swapRouterAddress = args
    .nextString()
    .expect('swap router address expected');

  const splitterTemplateAddress = args
    .nextString()
    .expect('splitter template address expected');

  // Set the eaglefi swap router address
  Storage.set(EAGLE_SWAP_ROUTER_ADDRESS, swapRouterAddress);

  // Set the splitter template address
  Storage.set(SPLITTER_TEMPLATE_ADDRESS_KEY, splitterTemplateAddress);

  // Set default tokens pools of eaglefi
  tokensPoolsMap.set(
    USDC_TOKEN_ADDRESS,
    'AS1p6ULD2dWxJ7G1U3D3dX95jHwgfXieRnLFRNRr4Hfq7XvA1qZf', // USDC/WMAS pool
  );

  tokensPoolsMap.set(
    WETH_TOKEN_ADDRESS,
    'AS184uE7Eq11Sg3KeQBD7jV9DkC75T3U5P6UEU1WEEZ7FHiesjsh', // WETH/WMAS pool
  );

  tokensPoolsMap.set(
    BTC_TOKEN_ADDRESS,
    'AS12FBMuayzXnd4NymGbwCYi4YRZiVJsjek3R8ppS2SSGLBMQv4FK', // BTC/WMAS pool
  );

  // Set the contract owner
  _setOwner(Context.caller().toString());

  // Initialize the reentrancy guard
  ReentrancyGuard.__ReentrancyGuard_init();
}

/**
 * Create a splitter vault that will split the deposited amount between the provided tokens according to their percentage.
 * @param binaryArgs - Arguments serialized with Args
 * - tokensWithPercentage: TokenWithPercentage[]
 */
export function createSplitterVault(binaryArgs: StaticArray<u8>): void {
  ReentrancyGuard.nonReentrant();

  const args = new Args(binaryArgs);

  const tokensWithPercentage = args
    .nextSerializableObjectArray<TokenWithPercentage>()
    .expect('tokens with percentage expected');

  const initCoins = args.nextU64().expect('Splitter initial coins expected');

  const caller = Context.caller();

  // Get the splitter template address from storage and its bytecode
  const splitterTemplateAddress = Storage.get(SPLITTER_TEMPLATE_ADDRESS_KEY);

  assert(splitterTemplateAddress.length > 0, 'SPLITTER_TEMPLATE_NOT_SET');

  const splitterVaultByteCode: StaticArray<u8> = getBytecodeOf(
    new Address(splitterTemplateAddress),
  );

  const vaultAddress = createSC(splitterVaultByteCode);

  // Call the constructor of the splitter contract
  const splitterContract = new ISplitter(vaultAddress);

  // Get the eaglefi router address from storage
  const eaglefiRouterAddress = new Address(
    Storage.get(EAGLE_SWAP_ROUTER_ADDRESS),
  );

  // Initialize the splitter contract
  splitterContract.init(
    tokensWithPercentage,
    caller,
    eaglefiRouterAddress,
    initCoins,
  );

  // Store the unique key for the user and the vault
  const userVaultKey = generateSplitterUserKey(
    caller.toString(),
    vaultAddress.toString(),
  );
  Storage.set(userVaultKey, '1');

  // Emit an event with the address of the newly created splitter vault
  generateEvent(
    createEvent('CREATE_SPLITTER_VAULT', [
      vaultAddress.toString(),
      caller.toString(),
    ]),
  );

  ReentrancyGuard.endNonReentrant();
}

export function createAndDepositSplitterVault(
  binaryArgs: StaticArray<u8>,
): void {
  ReentrancyGuard.nonReentrant();

  const args = new Args(binaryArgs);

  const tokensWithPercentage = args
    .nextSerializableObjectArray<TokenWithPercentage>()
    .expect('tokens with percentage expected');

  const initCoins = args.nextU64().expect('Splitter initial coins expected');

  const depositCoins = args.nextU64().expect('Deposit coins expected');

  const depositAmount = args.nextU256().expect('Deposit amount expected');

  const coinsToUse = args.nextU64().expect('coinsToUse expected');

  const deadline = args.nextU64().expect('deadline expected');

  const caller = Context.caller();

  // Get the splitter template address from storage and its bytecode
  const splitterTemplateAddress = Storage.get(SPLITTER_TEMPLATE_ADDRESS_KEY);

  assert(splitterTemplateAddress.length > 0, 'SPLITTER_TEMPLATE_NOT_SET');

  const splitterVaultByteCode: StaticArray<u8> = getBytecodeOf(
    new Address(splitterTemplateAddress),
  );

  const vaultAddress = createSC(splitterVaultByteCode);

  // Call the constructor of the splitter contract
  const splitterContract = new ISplitter(vaultAddress);

  // Get the eaglefi router address from storage
  const eaglefiRouterAddress = new Address(
    Storage.get(EAGLE_SWAP_ROUTER_ADDRESS),
  );

  // Initialize the splitter contract
  splitterContract.init(
    tokensWithPercentage,
    caller,
    eaglefiRouterAddress,
    initCoins,
  );

  // Store the unique key for the user and the vault
  const userVaultKey = generateSplitterUserKey(
    caller.toString(),
    vaultAddress.toString(),
  );
  Storage.set(userVaultKey, '1');

  // Start the deposit process
  const baseToken = new IMRC20(new Address(BASE_TOKEN_ADDRESS));

  // Transfer the tokens from the sender to this vault contract
  baseToken.transferFrom(
    Context.caller(),
    vaultAddress,
    depositAmount,
    getBalanceEntryCost(BASE_TOKEN_ADDRESS, vaultAddress.toString()),
  );

  // Call the deposit function of the splitter contract
  splitterContract.deposit(depositAmount, coinsToUse, deadline, depositCoins);

  // Emit an event with the address of the newly created splitter vault
  generateEvent(
    createEvent('CREATE_AND_DEPOSIT_SPLITTER_VAULT', [
      vaultAddress.toString(),
      caller.toString(),
      depositAmount.toString(),
    ]),
  );

  ReentrancyGuard.endNonReentrant();
}

export function getTokenPoolAddress(
  binaryArgs: StaticArray<u8>,
): StaticArray<u8> {
  const args = new Args(binaryArgs);

  const tokenAddress = args.nextString().expect('token address expected');

  const pool = tokensPoolsMap.get(tokenAddress, null);
  return pool ? stringToBytes(pool) : stringToBytes('');
}

export function setTokenPoolAddress(binaryArgs: StaticArray<u8>): void {
  // Only the owner can set the token pool address
  onlyOwner();

  const args = new Args(binaryArgs);

  const tokenAddress = args.nextString().expect('token address expected');
  const poolAddress = args.nextString().expect('pool address expected');

  tokensPoolsMap.set(tokenAddress, poolAddress);

  generateEvent(
    'Token pool address set: ' +
      tokenAddress +
      ' -> ' +
      poolAddress +
      ' by ' +
      Context.caller().toString(),
  );
}

export function setEagleSwapRouterAddress(binaryArgs: StaticArray<u8>): void {
  // Only the owner can set the eaglefi swap router address
  onlyOwner();

  const args = new Args(binaryArgs);

  const routerAddress = args.nextString().expect('router address expected');

  Storage.set(EAGLE_SWAP_ROUTER_ADDRESS, routerAddress);

  generateEvent(
    'EagleFi Swap Router address set to: ' +
      routerAddress +
      ' by ' +
      Context.caller().toString(),
  );
}

export function getEagleSwapRouterAddress(): StaticArray<u8> {
  const address = Storage.get(EAGLE_SWAP_ROUTER_ADDRESS);
  assert(address != null, 'SWAP_ROUTER_NOT_SET');
  return stringToBytes(address);
}

export function setSplitterTemplateAddress(binaryArgs: StaticArray<u8>): void {
  // Only the owner can set the splitter template address
  onlyOwner();

  const args = new Args(binaryArgs);

  const templateAddress = args.nextString().expect('template address expected');

  Storage.set(SPLITTER_TEMPLATE_ADDRESS_KEY, templateAddress);

  generateEvent(
    createEvent('SPLITTER_TEMPLATE_ADDRESS_SET', [
      templateAddress,
      Context.caller().toString(),
    ]),
  );
}

export function getSplitterTemplateAddress(): StaticArray<u8> {
  const address = Storage.get(SPLITTER_TEMPLATE_ADDRESS_KEY);
  assert(address != null, 'SPLITTER_TEMPLATE_NOT_SET');
  return stringToBytes(address);
}
