// Multi-Signature Savings Vault Contract
// Allows multiple signers to manage a shared vault with threshold-based approvals

import {
  Address,
  Context,
  createEvent,
  generateEvent,
  Storage,
  validateAddress,
} from '@massalabs/massa-as-sdk';
import {
  Args,
  boolToByte,
  bytesToU256,
  bytesToU64,
  byteToBool,
  bytesToString,
  stringToBytes,
  u256ToBytes,
  u64ToBytes,
} from '@massalabs/as-types';
import { TokenWithPercentage } from './structs/token';
import { _setOwner } from './lib/ownership-internal';
import { ReentrancyGuard } from './lib/ReentrancyGuard';
import { BASE_TOKEN_ADDRESS, WMAS_TOKEN_ADDRESS } from './lib/storage';
import { IMRC20 } from './interfaces/IMRC20';
import { getBalanceEntryCost } from '@massalabs/sc-standards/assembly/contracts/MRC20/MRC20-external';
import { deserializeStringArray, serializeStringArray } from './lib/utils';
import { u256 } from 'as-bignum/assembly';
import { SafeMath256 } from './lib/safeMath';
import { PersistentMap } from './lib/PersistentMap';
import { IEagleSwapRouter } from './interfaces/IEagleSwapRouter';
import { SwapPath } from './structs/eaglefi/swapPath';
import { IFactory } from './interfaces/IFactory';

// Storage keys
const SIGNERS_KEY: StaticArray<u8> = stringToBytes('signers');
const THRESHOLD_KEY: StaticArray<u8> = stringToBytes('threshold');
const PROPOSAL_COUNT_KEY: StaticArray<u8> = stringToBytes('proposalCount');
const EAGLEFI_ROUTER_KEY: StaticArray<u8> = stringToBytes('eaglefiRouter');
const CREATED_AT_KEY: StaticArray<u8> = stringToBytes('createdAt');
const VAULT_NAME_KEY: StaticArray<u8> = stringToBytes('vaultName');
const FACTORY_ADDRESS_KEY: StaticArray<u8> = stringToBytes('factoryAddress');

// Persistent maps
const tokensPercentagesMap = new PersistentMap<string, u64>('tpm');
const allTokensAddressesKey: StaticArray<u8> = stringToBytes('allTokensAddresses');

// Proposal storage - stores proposal data by ID
const proposalMap = new PersistentMap<u32, string>('proposals');
const proposalApprovalsMap = new PersistentMap<u32, string>('approvals');
const proposalExecutedMap = new PersistentMap<u32, bool>('executed');

/**
 * Proposal structure (serialized as string for storage)
 * Format: proposer|token|amount|recipient|timestamp
 */
class Proposal {
  constructor(
    public id: u32,
    public proposer: Address,
    public token: Address,
    public amount: u256,
    public recipient: Address,
    public timestamp: u64,
  ) { }

  // Serialize proposal to string for storage
  toString(): string {
    // Store amount as bytes converted to hex string to avoid u256.from() issues
    const amountBytes = u256ToBytes(this.amount);
    let amountHex = '';
    for (let i = 0; i < amountBytes.length; i++) {
      const byte = amountBytes[i];
      const hex = byte.toString(16);
      amountHex += (byte < 16 ? '0' : '') + hex;
    }

    return `${this.proposer.toString()}|${this.token.toString()}|${amountHex}|${this.recipient.toString()}|${this.timestamp.toString()}`;
  }

  // Deserialize proposal from string
  static fromString(id: u32, data: string): Proposal {
    const parts = data.split('|');
    assert(parts.length == 5, 'Invalid proposal data');

    // Parse amount from hex string
    const amountHex = parts[2];
    const amountBytes = new StaticArray<u8>(32);
    for (let i = 0; i < 32 && i * 2 < amountHex.length; i++) {
      const hexByte = amountHex.substr(i * 2, 2);
      amountBytes[i] = U8.parseInt(hexByte, 16);
    }
    const amount = bytesToU256(amountBytes);

    return new Proposal(
      id,
      new Address(parts[0]),
      new Address(parts[1]),
      amount,
      new Address(parts[3]),
      U64.parseInt(parts[4]),
    );
  }
}

/**
 * Constructor - Initialize multi-sig vault
 * @param binaryArgs - Serialized arguments containing:
 *   - signers: Address[] - Array of signer addresses
 *   - threshold: u8 - Number of approvals required
 *   - tokensWithPercentage: TokenWithPercentage[] - Token allocation percentages
 *   - vaultName: string - Name of the vault
 *   - eaglefiRouterAddress: string - EagleFi router address for swaps
 */
export function constructor(binaryArgs: StaticArray<u8>): void {
  assert(Context.isDeployingContract(), 'NOT_DEPLOYING');

  const args = new Args(binaryArgs);

  // Parse signers
  const signers = args.nextStringArray().expect('signers expected');
  assert(signers.length >= 2, 'At least 2 signers required');
  assert(signers.length <= 5, 'Maximum 5 signers allowed');

  // Validate all signer addresses
  for (let i = 0; i < signers.length; i++) {
    assert(validateAddress(signers[i]), `Invalid signer address: ${signers[i]}`);
  }

  // Parse threshold
  const threshold = args.nextU8().expect('threshold expected');
  assert(threshold >= 2, 'Threshold must be at least 2');
  assert(u32(threshold) <= u32(signers.length), 'Threshold cannot exceed number of signers');

  // Parse token allocations
  const tokensWithPercentage = args
    .nextSerializableObjectArray<TokenWithPercentage>()
    .expect('tokens with percentage expected');

  // Validate percentages sum to 100
  let totalPercentage: u64 = 0;
  const allTokensAddresses = new Array<string>();

  for (let i = 0; i < tokensWithPercentage.length; i++) {
    const token = tokensWithPercentage[i];
    totalPercentage += token.percentage;
    tokensPercentagesMap.set(token.address.toString(), token.percentage);
    allTokensAddresses.push(token.address.toString());
  }

  assert(totalPercentage == 100, 'Token percentages must sum to 100');

  // Parse vault name
  const vaultName = args.nextString().expect('vault name expected');

  // Parse eaglefi router address
  const eaglefiRouterAddress = args.nextString().expect('eaglefi router expected');
  assert(validateAddress(eaglefiRouterAddress), 'Invalid router address');

  // Store configuration
  Storage.set(SIGNERS_KEY, serializeStringArray(signers));
  Storage.set(THRESHOLD_KEY, [threshold]);
  Storage.set(PROPOSAL_COUNT_KEY, u64ToBytes(0));
  Storage.set(EAGLEFI_ROUTER_KEY, stringToBytes(eaglefiRouterAddress));
  Storage.set(CREATED_AT_KEY, u64ToBytes(Context.timestamp()));
  Storage.set(VAULT_NAME_KEY, stringToBytes(vaultName));
  Storage.set(allTokensAddressesKey, serializeStringArray(allTokensAddresses));

  // Store factory address (caller is the factory contract)
  const caller = Context.caller();
  Storage.set(FACTORY_ADDRESS_KEY, stringToBytes(caller.toString()));

  // Set first signer as owner (for compatibility)
  _setOwner(signers[0]);

  // Approve router for token swaps
  const baseToken = new IMRC20(new Address(BASE_TOKEN_ADDRESS));
  baseToken.increaseAllowance(
    new Address(eaglefiRouterAddress),
    u256.fromU64(u64.MAX_VALUE),
    getBalanceEntryCost(BASE_TOKEN_ADDRESS, Context.callee().toString()),
  );

  // Initialize reentrancy guard
  ReentrancyGuard.__ReentrancyGuard_init();

  // Emit creation event
  generateEvent(
    createEvent('MULTISIG_VAULT_CREATED', [
      Context.callee().toString(),
      signers.join(','),
      threshold.toString(),
    ]),
  );
}

/**
 * Check if caller is a signer
 */
function isSigner(address: Address): bool {
  const signers = deserializeStringArray(Storage.get(SIGNERS_KEY));
  const addrStr = address.toString();

  for (let i = 0; i < signers.length; i++) {
    if (signers[i] == addrStr) {
      return true;
    }
  }
  return false;
}

/**
 * Require caller to be a signer
 */
function onlySigner(): void {
  assert(isSigner(Context.caller()), 'CALLER_NOT_SIGNER');
}

/**
 * Deposit funds into the vault (any signer can deposit)
 * Automatically splits deposit across configured tokens
 * @param binaryArgs - Serialized arguments containing:
 *   - amount: u256 - Amount to deposit
 *   - coinsToUse: u64 - Coins for swap transactions
 *   - deadline: u64 - Swap deadline timestamp
 */
export function deposit(binaryArgs: StaticArray<u8>): void {
  ReentrancyGuard.nonReentrant();
  onlySigner();

  const args = new Args(binaryArgs);
  const amount = args.nextU256().expect('amount expected');
  const coinsToUse = args.nextU64().expect('coinsToUse expected');
  const deadline = args.nextU64().expect('deadline expected');

  const baseToken = new IMRC20(new Address(BASE_TOKEN_ADDRESS));
  const vaultAddress = Context.callee();
  const caller = Context.caller();

  // Transfer tokens from caller to vault
  baseToken.transferFrom(
    caller,
    vaultAddress,
    amount,
    getBalanceEntryCost(BASE_TOKEN_ADDRESS, vaultAddress.toString()),
  );

  // Split deposit across tokens based on percentages
  const allTokens = deserializeStringArray(Storage.get(allTokensAddressesKey));
  const routerAddress = new Address(bytesToString(Storage.get(EAGLEFI_ROUTER_KEY)));
  const router = new IEagleSwapRouter(routerAddress);

  // Get factory address to query pool addresses
  const factoryAddress = new Address(bytesToString(Storage.get(FACTORY_ADDRESS_KEY)));
  const factory = new IFactory(factoryAddress);

  for (let i = 0; i < allTokens.length; i++) {
    const tokenAddress = allTokens[i];
    const percentage = tokensPercentagesMap.get(tokenAddress, 0);

    // Calculate amount for this token
    const tokenAmount = SafeMath256.div(
      SafeMath256.mul(amount, u256.fromU64(percentage)),
      u256.fromU64(100),
    );

    // Skip if amount is zero
    if (tokenAmount.isZero()) continue;

    // If token is base token, no swap needed
    if (tokenAddress == BASE_TOKEN_ADDRESS) continue;

    // Get pool addresses for swapping
    const basepoolAddress = factory.getTokenPoolAddress(BASE_TOKEN_ADDRESS);
    assert(basepoolAddress.length > 0, 'BASE_POOL_NOT_FOUND');

    let swapRoute: SwapPath[] = [];

    // If token is WMAS, swap with one route only, else two routes (BASE -> WMAS -> TOKEN)
    if (tokenAddress == WMAS_TOKEN_ADDRESS) {
      const swapPath = new SwapPath(
        new Address(basepoolAddress),
        new Address(BASE_TOKEN_ADDRESS),
        new Address(tokenAddress),
        vaultAddress,
        tokenAmount,
        u256.One, // amountOutMin set to 1 for simplicity
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
        u256.One, // amountOutMin set to 1 for simplicity
        true,
      );

      const swapPath2 = new SwapPath(
        new Address(poolAddress),
        new Address(WMAS_TOKEN_ADDRESS),
        new Address(tokenAddress),
        vaultAddress,
        u256.Zero, // amountIn will be determined by the previous swap
        u256.One, // amountOutMin set to 1 for simplicity
        false,
      );

      swapRoute = [swapPath1, swapPath2];
    }

    // Execute swap
    const customDeadline = u64.MAX_VALUE;
    const amountOut: u256 = router.swap(
      swapRoute,
      coinsToUse,
      customDeadline,
      coinsToUse * swapRoute.length,
    );

    assert(amountOut > u256.Zero, 'SWAP_FAILED_FOR_' + tokenAddress);
  }

  // Emit deposit event
  generateEvent(
    createEvent('MULTISIG_DEPOSIT', [
      caller.toString(),
      amount.toString(),
      Context.timestamp().toString(),
    ]),
  );

  ReentrancyGuard.endNonReentrant();
}

/**
 * Create a withdrawal proposal
 * @param binaryArgs - Serialized arguments containing:
 *   - token: Address - Token to withdraw
 *   - amount: u256 - Amount to withdraw
 *   - recipient: Address - Recipient address
 */
export function proposeWithdrawal(binaryArgs: StaticArray<u8>): void {
  onlySigner();

  const args = new Args(binaryArgs);
  const token = new Address(args.nextString().expect('token expected'));
  const amount = args.nextU256().expect('amount expected');
  const recipient = new Address(args.nextString().expect('recipient expected'));

  assert(validateAddress(recipient.toString()), 'Invalid recipient address');
  assert(!amount.isZero(), 'Amount must be greater than zero');

  // Check vault has sufficient balance
  const tokenContract = new IMRC20(token);
  const vaultBalance = tokenContract.balanceOf(Context.callee());
  assert(vaultBalance >= amount, 'Insufficient vault balance');

  // Get next proposal ID
  const proposalCount = bytesToU64(Storage.get(PROPOSAL_COUNT_KEY));
  const proposalId = u32(proposalCount);

  // Create proposal
  const proposal = new Proposal(
    proposalId,
    Context.caller(),
    token,
    amount,
    recipient,
    Context.timestamp(),
  );

  // Store proposal
  proposalMap.set(proposalId, proposal.toString());
  proposalExecutedMap.set(proposalId, false);

  // Initialize approvals with proposer's approval
  const approvals = [Context.caller().toString()];
  proposalApprovalsMap.set(proposalId, approvals.join(','));

  // Increment proposal count
  Storage.set(PROPOSAL_COUNT_KEY, u64ToBytes(proposalCount + 1));

  // Emit event
  generateEvent(
    createEvent('PROPOSAL_CREATED', [
      proposalId.toString(),
      Context.caller().toString(),
      token.toString(),
      amount.toString(),
      recipient.toString(),
    ]),
  );
}

/**
 * Approve a withdrawal proposal
 * @param binaryArgs - Serialized arguments containing:
 *   - proposalId: u32 - ID of proposal to approve
 */
export function approveProposal(binaryArgs: StaticArray<u8>): void {
  onlySigner();

  const args = new Args(binaryArgs);
  const proposalId = args.nextU32().expect('proposalId expected');

  // Check proposal exists
  assert(proposalMap.contains(proposalId), 'Proposal does not exist');

  // Check not already executed
  const executed = proposalExecutedMap.get(proposalId, false);
  assert(!executed, 'Proposal already executed');

  // Get current approvals
  const approvalsStr = proposalApprovalsMap.get(proposalId, '');
  const approvals = approvalsStr.length > 0 ? approvalsStr.split(',') : [];
  const callerStr = Context.caller().toString();

  // Check if already approved
  for (let i = 0; i < approvals.length; i++) {
    assert(approvals[i] != callerStr, 'Already approved');
  }

  // Add approval
  approvals.push(callerStr);
  proposalApprovalsMap.set(proposalId, approvals.join(','));

  // Emit event
  generateEvent(
    createEvent('PROPOSAL_APPROVED', [
      proposalId.toString(),
      callerStr,
      approvals.length.toString(),
    ]),
  );

  // Check if threshold met and auto-execute
  const threshold = u32(Storage.get(THRESHOLD_KEY)[0]);
  if (u32(approvals.length) >= threshold) {
    _executeProposal(proposalId);
  }
}

/**
 * Execute a proposal (internal function, called automatically when threshold met)
 */
function _executeProposal(proposalId: u32): void {
  // Get proposal
  const proposalData = proposalMap.get(proposalId, '');
  const proposal = Proposal.fromString(proposalId, proposalData);

  // Get approvals count
  const approvalsStr = proposalApprovalsMap.get(proposalId, '');
  const approvals = approvalsStr.split(',');
  const threshold = u32(Storage.get(THRESHOLD_KEY)[0]);

  // Verify threshold met
  assert(u32(approvals.length) >= threshold, 'Threshold not met');

  // Mark as executed
  proposalExecutedMap.set(proposalId, true);

  // Execute withdrawal
  const tokenContract = new IMRC20(proposal.token);
  tokenContract.transfer(
    proposal.recipient,
    proposal.amount,
    getBalanceEntryCost(proposal.token.toString(), proposal.recipient.toString()),
  );

  // Emit event
  generateEvent(
    createEvent('PROPOSAL_EXECUTED', [
      proposalId.toString(),
      proposal.token.toString(),
      proposal.amount.toString(),
      proposal.recipient.toString(),
    ]),
  );
}

/**
 * Get vault information
 * @returns Serialized vault info
 */
export function getVaultInfo(): StaticArray<u8> {
  const signers = deserializeStringArray(Storage.get(SIGNERS_KEY));
  const threshold = Storage.get(THRESHOLD_KEY)[0];
  const vaultName = Storage.get(VAULT_NAME_KEY);
  const createdAt = bytesToU64(Storage.get(CREATED_AT_KEY));
  const proposalCount = bytesToU64(Storage.get(PROPOSAL_COUNT_KEY));

  return new Args()
    .add(signers)
    .add(threshold)
    .add(vaultName)
    .add(createdAt)
    .add(proposalCount)
    .serialize();
}

/**
 * Get pending proposals (not yet executed)
 * @returns Serialized array of proposal IDs
 */
export function getPendingProposals(): StaticArray<u8> {
  const proposalCount = bytesToU64(Storage.get(PROPOSAL_COUNT_KEY));
  const pendingIds: u32[] = [];

  for (let i: u32 = 0; i < u32(proposalCount); i++) {
    if (proposalMap.contains(i)) {
      const executed = proposalExecutedMap.get(i, false);
      if (!executed) {
        pendingIds.push(i);
      }
    }
  }

  return new Args().add(pendingIds).serialize();
}

/**
 * Get proposal details
 * @param binaryArgs - Serialized proposal ID
 * @returns Serialized proposal data
 */
export function getProposal(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const proposalId = args.nextU32().expect('proposalId expected');

  assert(proposalMap.contains(proposalId), 'Proposal does not exist');

  const proposalData = proposalMap.get(proposalId, '');
  const proposal = Proposal.fromString(proposalId, proposalData);
  const executed = proposalExecutedMap.get(proposalId, false);
  const approvalsStr = proposalApprovalsMap.get(proposalId, '');
  const approvals = approvalsStr.length > 0 ? approvalsStr.split(',') : [];

  return new Args()
    .add(proposal.id)
    .add(proposal.proposer)
    .add(proposal.token)
    .add(proposal.amount)
    .add(proposal.recipient)
    .add(proposal.timestamp)
    .add(executed)
    .add(approvals)
    .serialize();
}

/**
 * Get token balances in the vault
 * @returns Serialized token balances
 */
export function getTokenBalances(): StaticArray<u8> {
  const allTokens = deserializeStringArray(Storage.get(allTokensAddressesKey));
  const vaultAddress = Context.callee();

  const balances: string[] = [];

  for (let i = 0; i < allTokens.length; i++) {
    const tokenAddress = allTokens[i];
    const tokenContract = new IMRC20(new Address(tokenAddress));
    const balance = tokenContract.balanceOf(vaultAddress);
    balances.push(`${tokenAddress}:${balance.toString()}`);
  }

  return new Args().add(balances).serialize();
}

/**
 * Get signers list
 * @returns Serialized signers array
 */
export function getSigners(): StaticArray<u8> {
  const signers = deserializeStringArray(Storage.get(SIGNERS_KEY));
  return new Args().add(signers).serialize();
}

/**
 * Get threshold
 * @returns Threshold value
 */
export function getThreshold(): StaticArray<u8> {
  const threshold = Storage.get(THRESHOLD_KEY)[0];
  return new Args().add(threshold).serialize();
}

/**
 * Check if this is a multi-sig vault
 * @returns true (always returns true for multi-sig vaults)
 */
export function isMultiSig(): StaticArray<u8> {
  return new Args().add(true).serialize();
}

/**
 * Get vault name
 * @returns Vault name
 */
export function getVaultName(): StaticArray<u8> {
  const vaultName = bytesToString(Storage.get(VAULT_NAME_KEY));
  return new Args().add(vaultName).serialize();
}
