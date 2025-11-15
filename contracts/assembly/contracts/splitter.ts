// The entry file of your WebAssembly module.
import {
  Address,
  balance,
  Context,
  createEvent,
  deferredCallCancel,
  deferredCallExists,
  deferredCallQuote,
  deferredCallRegister,
  findCheapestSlot,
  generateEvent,
  Storage,
} from '@massalabs/massa-as-sdk';
import {
  Args,
  boolToByte,
  bytesToString,
  bytesToU256,
  bytesToU64,
  byteToBool,
  SafeMath,
  stringToBytes,
  u256ToBytes,
  u64ToBytes,
} from '@massalabs/as-types';
import { TokenWithPercentage } from './structs/token';
import { _setOwner } from './lib/ownership-internal';
import { ReentrancyGuard } from './lib/ReentrancyGuard';
import { wrapMasToWMAS } from './lib/wrapping';
import { BASE_TOKEN_ADDRESS, WMAS_TOKEN_ADDRESS } from './lib/storage';
import { IMRC20 } from './interfaces/IMRC20';
import { getBalanceEntryCost } from '@massalabs/sc-standards/assembly/contracts/MRC20/MRC20-external';
import { deserializeStringArray, serializeStringArray } from './lib/utils';
import { u256 } from 'as-bignum/assembly';
import { SafeMath256 } from './lib/safeMath';
import { PersistentMap } from './lib/PersistentMap';
import { IFactory } from './interfaces/IFactory';
import { IEagleSwapRouter } from './interfaces/IEagleSwapRouter';
import { SwapPath } from './structs/eaglefi/swapPath';
import { onlyOwner } from './lib/ownership';

const FACTORY_ADDRESS_KEY = 'factoryAddress';
const CURRENT_CALL_ID_KEY = 'ccid';
const SRC_WALLET_KEY = 'swl';
const PERIOD_FREQUENCY_KEY: StaticArray<u8> = stringToBytes('pfq');
const AMOUNT_EACH_PERIOD_KEY: StaticArray<u8> = stringToBytes('aep');
const AUTO_DEPOSIT_TOTAL_COINS_KEY: StaticArray<u8> = stringToBytes('adtc');
const AUTO_DEPOSIT_COINS_KEY: StaticArray<u8> = stringToBytes('adc');
const tokensPercentagesMap = new PersistentMap<string, u64>('tpm');
const allTokensAddressesKey: StaticArray<u8> =
  stringToBytes('allTokensAddresses');
const createdAtKey: StaticArray<u8> = stringToBytes('createdAt');
const autoDepositEnabledKey: StaticArray<u8> = stringToBytes('adek');
const vaultNameKey: StaticArray<u8> = stringToBytes('vaultName');

/**
 * This function is meant to be called only one time: when the contract is deployed.
 *
 * @param binaryArgs - Arguments serialized with Args
 */
export function constructor(binaryArgs: StaticArray<u8>): void {
  // This line is important. It ensures that this function can't be called in the future.
  // If you remove this check, someone could call your constructor function and reset your smart contract.
  assert(Context.isDeployingContract());

  const args = new Args(binaryArgs);

  const tokenWithPercentage = args
    .nextSerializableObjectArray<TokenWithPercentage>()
    .expect('token with percentage expected');

  const vaultCreatorAddress = args
    .nextString()
    .expect('vault creator address expected');

  const eaglefiRouterAddress = args
    .nextString()
    .expect('eaglefi router address expected');

  const vaultName = args
    .nextString()
    .expect('vault name expected');

  const allTokensAddresses = new Array<string>();

  // Store the tokens and their percentages in the persistent map
  for (let i = 0; i < tokenWithPercentage.length; i++) {
    const token = tokenWithPercentage[i];
    tokensPercentagesMap.set(token.address.toString(), token.percentage);
    allTokensAddresses.push(token.address.toString());
  }

  // Store all token addresses in the storage
  Storage.set(allTokensAddressesKey, serializeStringArray(allTokensAddresses));

  // Set the contract owner to the vault creator address
  _setOwner(vaultCreatorAddress);

  const caller = Context.caller();

  // Store the factory address
  Storage.set(FACTORY_ADDRESS_KEY, caller.toString());

  // Store the creation timestamp
  Storage.set(createdAtKey, u64ToBytes(Context.timestamp()));

  // Store the vault name
  Storage.set(vaultNameKey, stringToBytes(vaultName));

  // INcrease Max allownace of WMAS for the eaglefi router
  const baseToken = new IMRC20(new Address(BASE_TOKEN_ADDRESS));

  baseToken.increaseAllowance(
    new Address(eaglefiRouterAddress),
    u256.fromU64(u64.MAX_VALUE),
    getBalanceEntryCost(BASE_TOKEN_ADDRESS, Context.callee().toString()),
  );

  // Initialize auto deposit as disabled by default
  Storage.set(autoDepositEnabledKey, boolToByte(false));

  // Initialize the reentrancy guard
  ReentrancyGuard.__ReentrancyGuard_init();
}

/**
 * Deposit function to split the incoming BASE_TOKEN according to the predefined percentages.
 * @param binaryArgs - Arguments serialized with Args
 * The arguments should include:
 * - amount: u256 - The amount of BASE_TOKEN to be deposited.
 * - coinsToUse: u64 - The amount of coins to be used for the swap transactions.
 * - deadline: u64 - The deadline timestamp for the swap transactions.
 */
export function deposit(binaryArgs: StaticArray<u8>): void {
  ReentrancyGuard.nonReentrant();

  const args = new Args(binaryArgs);

  const amount = args.nextU256().expect('amount expected');
  const coinsToUse = args.nextU64().expect('coinsToUse expected');
  const deadline = args.nextU64().expect('deadline expected');

  const baseToken = new IMRC20(new Address(BASE_TOKEN_ADDRESS));

  const calleeAddress = Context.callee();
  const callerAddress = Context.caller();

  const factoryAddress = Storage.get(FACTORY_ADDRESS_KEY);

  const isFromFactory = callerAddress.toString() == factoryAddress;

  const isCallerCallee = callerAddress == calleeAddress;

  const autoDepositEnabled = byteToBool(Storage.get(autoDepositEnabledKey));

  // Generate an event for the deposit triggered
  // if (autoDepositEnabled && isCallerCallee) {
  //   // If the caller is the contract itself, it means it's an auto deposit, in this case we need to get the amountEachPeriod from the storage
  //   generateEvent(
  //     createEvent('AUTO_DEPOSIT_TRIGGERED', [
  //       callerAddress.toString(),
  //       amount.toString(),
  //       deadline.toString(),
  //     ]),
  //   );
  // }

  // Do the transfer only if the call is not from the factory (createAndDepositSplitterVault)
  if (!isFromFactory) {
    let fromAddress: Address;

    if (isCallerCallee) {
      // If the caller is the contract itself, it means it's an auto deposit, in this case we need to get the src wallet from the storage
      const srcWallet = Storage.get(SRC_WALLET_KEY);

      assert(srcWallet.length > 0, 'SRC_WALLET_NOT_SET');

      fromAddress = new Address(srcWallet);
    } else {
      fromAddress = callerAddress;
    }

    // Transfer the tokens from the fromAddress to this contract
    baseToken.transferFrom(
      fromAddress,
      calleeAddress,
      amount,
      getBalanceEntryCost(BASE_TOKEN_ADDRESS, calleeAddress.toString()),
    );
  }

  // Distribute the  USDC amount to the tokens according to their percentages

  // Get all tokens and their corresponding percentages from the persistent map
  const tokens: string[] = deserializeStringArray(
    Storage.get(allTokensAddressesKey),
  );

  const factory = new IFactory(new Address(factoryAddress));
  const eagleSwapRouterAddress = factory.getEagleSwapRouterAddress();

  assert(eagleSwapRouterAddress.length > 0, 'SWAP_ROUTER_NOT_SET');

  const eagleSwapRouter = new IEagleSwapRouter(
    new Address(eagleSwapRouterAddress),
  );

  for (let i = 0; i < tokens.length; i++) {
    const tokenAddress = tokens[i];

    if (tokenAddress == BASE_TOKEN_ADDRESS) {
      // If the token is BASE_TOKEN, just Keep their percentage in the vault, do nothing
      continue;
    }

    assert(
      tokensPercentagesMap.contains(tokenAddress),
      'TOKEN_PERC_NOT_FOUND: ' + tokenAddress,
    );
    const percentage = tokensPercentagesMap.get(tokenAddress, 0);

    // Calculate the amount to send to each token based on its percentage
    // tokenAmount  = amount * percentage / 100
    const tokenAmount = SafeMath256.div(
      SafeMath256.mul(amount, u256.fromU64(percentage)),
      u256.fromU64(100),
    );

    let swapRoute: SwapPath[];

    const basepoolAddress = factory.getTokenPoolAddress(BASE_TOKEN_ADDRESS);

    assert(basepoolAddress.length > 0, 'BASE_POOL_NOT_FOUND');

    // if token Address is wmas, swap with one route only, else two routes (WMAS as intermediary) BASE -> WMAS -> TOKEN
    if (tokenAddress == WMAS_TOKEN_ADDRESS) {
      // The actual swap on eaglefi DEX
      const swapPath = new SwapPath(
        new Address(basepoolAddress),
        new Address(BASE_TOKEN_ADDRESS),
        new Address(tokenAddress),
        calleeAddress,
        tokenAmount,
        u256.One, // amountOutMin set to 1 for simplicity, should be handled properly in a real scenario
        true,
      );

      swapRoute = [swapPath];
    } else {
      const poolAddress = factory.getTokenPoolAddress(tokenAddress);

      assert(poolAddress.length > 0, 'POOL_NOT_FOUND_FOR_' + tokenAddress);

      const swapPath1 = new SwapPath(
        new Address(basepoolAddress),
        new Address(BASE_TOKEN_ADDRESS),
        new Address(WMAS_TOKEN_ADDRESS),
        new Address(poolAddress),
        tokenAmount,
        u256.One, // amountOutMin set to 1 for simplicity, should be handled properly in a real scenario
        true,
      );

      const swapPath2 = new SwapPath(
        new Address(poolAddress),
        new Address(WMAS_TOKEN_ADDRESS),
        new Address(tokenAddress),
        calleeAddress,
        u256.Zero, // amountIn will be determined by the previous swap
        u256.One, // amountOutMin set to 1 for simplicity, should be handled properly in a real scenario
        false,
      );

      swapRoute = [swapPath1, swapPath2];
    }

    const customDeadline = u64.MAX_VALUE;

    const amountOut: u256 = eagleSwapRouter.swap(
      swapRoute,
      coinsToUse,
      customDeadline,
      coinsToUse * swapRoute.length,
    );

    assert(amountOut > u256.Zero, 'SWAP_FAILED_FOR_' + tokenAddress);
  }

  if (!isFromFactory) {
    // Emit an event indicating the deposit was successful only if the call is not from the factory
    generateEvent(
      createEvent('DEOSIT', [
        callerAddress.toString(),
        amount.toString(),
        deadline.toString(),
      ]),
    );
  }

  // Schedule the next auto deposit if enabled and if the call is from the contract itself
  if (autoDepositEnabled && isCallerCallee) {
    _scheduleNextAutoDeposit();
  }

  // End Reentrancy Guard
  ReentrancyGuard.endNonReentrant();
}

/**
 * Withdraw function to transfer tokens from the vault to a specified address.
 * @param binaryArgs - Arguments serialized with Args
 * The arguments should include:
 * - tokenAddress: string - The address of the token to be withdrawn.
 * - amount: u256 - The amount of the token to be withdrawn.
 * - toAddress: string - The address to which the tokens will be sent.
 */
export function withdraw(binaryArgs: StaticArray<u8>): void {
  ReentrancyGuard.nonReentrant();

  onlyOwner();

  const args = new Args(binaryArgs);

  const tokenAddress = args.nextString().expect('token address expected');
  const amount = args.nextU256().expect('amount expected');
  const toAddress = args.nextString().expect('to address expected');

  // Only the owner of the vault can withdraw

  const token = new IMRC20(new Address(tokenAddress));

  // Transfer the tokens to the specified address
  token.transfer(
    new Address(toAddress),
    amount,
    getBalanceEntryCost(tokenAddress, Context.callee().toString()),
  );

  // Emit an event indicating the withdrawal was successful
  generateEvent(
    createEvent('WITHDRAW', [
      toAddress,
      tokenAddress,
      amount.toString(),
      Context.caller().toString(),
    ]),
  );

  ReentrancyGuard.endNonReentrant();
}

/**
 * Enables the auto deposit feature.
 * @param binaryArgs - Arguments serialized with Args
 * The arguments should include:
 * - amount: u256 - The amount to be deposited automatically.
 * - frequency: u64 - The frequency (in massa periods).
 * - srcWallet: string - The source wallet address from which the funds will be drawn.
 * - coinsToUse: u64 - The amount of coins to be used for the swap transactions.
 * - depositCoins: u64 - The amount of coins to be attached to each deposit call.
 */
export function enableAutoDeposit(binaryArgs: StaticArray<u8>): void {
  onlyOwner();

  // Start Reentrancy Guard
  ReentrancyGuard.nonReentrant();

  // Get the current state of auto deposit
  const autoDepositEnabled = byteToBool(Storage.get(autoDepositEnabledKey));

  assert(!autoDepositEnabled, 'ALREADY_ENABLED');

  const args = new Args(binaryArgs);

  const amountEachPeriod = args.nextU256().expect('Amount expected');
  const periodFrequency = args.nextU64().expect('period frequency expected');
  const srcWallet = args.nextString().expect('src wallet expected');
  const coinsToUse = args.nextU64().expect('coins to use expected');
  const depositCoins = args.nextU64().expect('deposit coins expected');

  assert(periodFrequency > 3, 'PERIOD_FREQUENCY_TOO_LOW');

  // Current Smart contract address
  const calleeAddress = Context.callee();

  // Check the allowance of the srcWallet for BASE_TOKEN is enough
  const baseToken = new IMRC20(new Address(BASE_TOKEN_ADDRESS));

  const allowance = baseToken.allowance(new Address(srcWallet), calleeAddress);

  // For safety, we require the allowance to be at least 10 times the amountEachPeriod
  const shouldAllowance = SafeMath256.div(amountEachPeriod, u256.fromU64(10));

  assert(
    allowance >= shouldAllowance,
    'INSUFFICIENT_ALLOWANCE:' +
      allowance.toString() +
      ' < ' +
      shouldAllowance.toString(),
  );

  // Store the auto deposit configuration in the storage
  Storage.set(autoDepositEnabledKey, boolToByte(true));
  Storage.set(SRC_WALLET_KEY, srcWallet);
  Storage.set(PERIOD_FREQUENCY_KEY, u64ToBytes(periodFrequency));
  Storage.set(AMOUNT_EACH_PERIOD_KEY, u256ToBytes(amountEachPeriod));
  Storage.set(AUTO_DEPOSIT_COINS_KEY, u64ToBytes(coinsToUse));
  Storage.set(AUTO_DEPOSIT_TOTAL_COINS_KEY, u64ToBytes(depositCoins));

  // Schedule the first auto deposit
  _scheduleNextAutoDeposit();

  generateEvent(
    createEvent('AUTO_DEPOSIT_ENABLED', [
      Context.caller().toString(),
      amountEachPeriod.toString(),
      periodFrequency.toString(),
      srcWallet,
    ]),
  );

  // End Reentrancy Guard
  ReentrancyGuard.endNonReentrant();
}

/**
 * Schedules the next auto deposit using massa deferred calls.
 */
function _scheduleNextAutoDeposit(): void {
  // Implement the auto deposit logic using massa deferred calls

  const amount = bytesToU256(Storage.get(AMOUNT_EACH_PERIOD_KEY));
  const period = bytesToU64(Storage.get(PERIOD_FREQUENCY_KEY));
  const coinsToUse = bytesToU64(Storage.get(AUTO_DEPOSIT_COINS_KEY));
  const depositCoins = bytesToU64(Storage.get(AUTO_DEPOSIT_TOTAL_COINS_KEY));

  // Create the arguments for the deposit function
  const depositArgs = new Args()
    .add(amount)
    .add(coinsToUse) // CoinsToUse should be other than 0
    .add(u64.MAX_VALUE) // deadline
    .serialize();

  const paramsSize = depositArgs.length;
  // const maxGas = 1_000_000_000;
  const maxGas = 900_000_000;
  const currentPeriod = Context.currentPeriod();
  const bookingPeriod = currentPeriod + period;

  const slot = findCheapestSlot(
    bookingPeriod,
    bookingPeriod,
    maxGas,
    paramsSize,
  );

  const cost = deferredCallQuote(slot, maxGas, paramsSize);

  const depositTotalCost = SafeMath.add(cost, depositCoins);

  const callId = deferredCallRegister(
    Context.callee().toString(),
    'deposit',
    slot,
    maxGas,
    depositArgs,
    depositCoins,
  );

  // Save the current call ID to the storage to use it later (exp= cancel deffered call)
  Storage.set(CURRENT_CALL_ID_KEY, callId);

  generateEvent(
    createEvent('AUTO_DEPOSIT_SCHEDULED', [
      Context.caller().toString(),
      amount.toString(),
      period.toString(),
      callId,
      depositTotalCost.toString(),
      bookingPeriod.toString(),
      currentPeriod.toString(),
    ]),
  );
}

export function disableAutoDeposit(): void {
  onlyOwner();

  // Start Reentrancy Guard
  ReentrancyGuard.nonReentrant();

  // Get the current state of auto deposit
  const autoDepositEnabled = byteToBool(Storage.get(autoDepositEnabledKey));

  assert(autoDepositEnabled, 'ALREADY_DISABLED');

  // Cancel the scheduled deferred call if exists
  const currentCallId = Storage.get(CURRENT_CALL_ID_KEY);

  if (deferredCallExists(currentCallId)) {
    deferredCallCancel(currentCallId);
  }

  // Update the auto deposit state in the storage to disabled
  Storage.set(autoDepositEnabledKey, boolToByte(false));
  // Clean up other related storage entries
  Storage.del(SRC_WALLET_KEY);
  Storage.del(PERIOD_FREQUENCY_KEY);
  Storage.del(AMOUNT_EACH_PERIOD_KEY);
  Storage.del(AUTO_DEPOSIT_COINS_KEY);
  Storage.del(AUTO_DEPOSIT_TOTAL_COINS_KEY);
  Storage.del(CURRENT_CALL_ID_KEY);

  // Emit an event indicating auto deposit has been disabled
  generateEvent(
    createEvent('AUTO_DEPOSIT_DISABLED', [Context.caller().toString()]),
  );

  // End Reentrancy Guard
  ReentrancyGuard.endNonReentrant();
}

/**
 * Get the vault name
 * @returns The vault name as serialized string
 */
export function getVaultName(): StaticArray<u8> {
  const vaultName = bytesToString(Storage.get(vaultNameKey));
  return new Args().add(vaultName).serialize();
}
