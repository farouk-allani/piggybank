import {
  SmartContract,
  Args,
  ArrayTypes,
  parseMas,
  parseUnits,
  OperationStatus,
  MRC20,
} from '@massalabs/massa-web3';
import { toast } from 'react-toastify';
import {
  TokenWithPercentage,
  USDC_DECIMALS,
  BASE_TOKEN_ADDRESS,
} from './types';

// Get factory contract instance
function getFactoryContract(connectedAccount: any): SmartContract {
  if (!connectedAccount) throw new Error('Missing connected account');

  const contractAddress = import.meta.env.VITE_SMART_CONTRACT as string;
  if (!contractAddress) {
    throw new Error('Smart contract address not found in environment variables');
  }

  return new SmartContract(connectedAccount, contractAddress);
}

// Get multi-sig vault contract instance
function getMultiSigVaultContract(
  connectedAccount: any,
  vaultAddress: string
): SmartContract {
  if (!connectedAccount) throw new Error('Missing connected account');
  return new SmartContract(connectedAccount, vaultAddress);
}

export interface MultiSigVaultInfo {
  signers: string[];
  threshold: number;
  vaultName: string;
  createdAt: number;
  proposalCount: number;
}

/**
 * Debug function to check proposal existence
 */
export async function debugProposal(
  connectedAccount: any,
  vaultAddress: string,
  proposalId: number
): Promise<void> {
  try {
    const vaultContract = getMultiSigVaultContract(connectedAccount, vaultAddress);
    console.log(`\n=== DEBUG: Checking proposal ${proposalId} ===`);

    const args = new Args().addU32(BigInt(proposalId)).serialize();
    const result = await vaultContract.read('getProposal', args);

    console.log('Result:', result);
    console.log('Has error:', !!result.info?.error);
    console.log('Error message:', result.info?.error);
    console.log('Value length:', result.value?.length);
    console.log('=== END DEBUG ===\n');
  } catch (error) {
    console.error('Debug error:', error);
  }
}

export interface Proposal {
  id: number;
  proposer: string;
  token: string;
  amount: string;
  recipient: string;
  timestamp: number;
  executed: boolean;
  approvals: string[];
}

/**
 * Check if a vault is a multi-sig vault
 */
export async function isMultiSigVault(
  connectedAccount: any,
  vaultAddress: string
): Promise<boolean> {
  try {
    const vaultContract = new SmartContract(connectedAccount, vaultAddress);
    const result = await vaultContract.read('isMultiSig');
    const args = new Args(result.value);
    return args.nextBool();
  } catch (error) {
    // If the function doesn't exist, it's not a multi-sig vault
    return false;
  }
}

/**
 * Get vault name from blockchain
 */
export async function getVaultName(
  connectedAccount: any,
  vaultAddress: string
): Promise<string> {
  try {
    const vaultContract = new SmartContract(connectedAccount, vaultAddress);
    const result = await vaultContract.read('getVaultName');
    const args = new Args(result.value);
    return args.nextString();
  } catch (error) {
    console.error('Error fetching vault name:', error);
    return 'Splitter Vault'; // Fallback name
  }
}

/**
 * Get multi-sig vault info
 */
export async function getMultiSigVaultInfo(
  connectedAccount: any,
  vaultAddress: string
): Promise<MultiSigVaultInfo | null> {
  try {
    const vaultContract = getMultiSigVaultContract(connectedAccount, vaultAddress);
    const result = await vaultContract.read('getVaultInfo');
    const args = new Args(result.value);

    const signers = args.nextArray(ArrayTypes.STRING) as string[];
    const threshold = Number(args.nextU8());
    const vaultName = args.nextString();
    const createdAt = Number(args.nextU64());
    const proposalCount = Number(args.nextU64());

    return {
      signers,
      threshold,
      vaultName,
      createdAt,
      proposalCount,
    };
  } catch (error) {
    console.error('Error fetching multi-sig vault info:', error);
    return null;
  }
}

/**
 * Get pending proposals
 */
export async function getPendingProposals(
  connectedAccount: any,
  vaultAddress: string
): Promise<number[]> {
  try {
    const vaultContract = getMultiSigVaultContract(connectedAccount, vaultAddress);
    const result = await vaultContract.read('getPendingProposals');
    const args = new Args(result.value);

    // The contract returns an array of u32, we need to use nextArray with ArrayTypes.U32
    const proposalIds = args.nextArray(ArrayTypes.U32) as (number | bigint)[];

    // Convert BigInt to number if needed
    const normalizedIds = proposalIds.map(id =>
      typeof id === 'bigint' ? Number(id) : id
    );

    console.log('Pending proposal IDs (normalized):', normalizedIds);
    return normalizedIds;
  } catch (error) {
    console.error('Error fetching pending proposals:', error);
    return [];
  }
}

/**
 * Get proposal details
 */
export async function getProposal(
  connectedAccount: any,
  vaultAddress: string,
  proposalId: number
): Promise<Proposal | null> {
  try {
    const vaultContract = getMultiSigVaultContract(connectedAccount, vaultAddress);

    console.log(`Fetching proposal ${proposalId} from vault ${vaultAddress}`);
    const args = new Args().addU32(BigInt(proposalId)).serialize();
    const result = await vaultContract.read('getProposal', args);

    console.log('Raw proposal result:', result);

    // Check if there's an error in the result
    if (result.info && result.info.error) {
      console.error('Smart contract error:', result.info.error);
      return null;
    }

    // Check if we have data
    if (!result.value || result.value.length === 0) {
      console.error('Empty response from getProposal');
      return null;
    }

    console.log('Proposal value bytes:', result.value);

    const resultArgs = new Args(result.value);

    console.log('Deserializing proposal ID...');
    const id = Number(resultArgs.nextU32());
    console.log('Proposal ID:', id);

    console.log('Deserializing proposer...');
    const proposer = resultArgs.nextString();
    console.log('Proposer:', proposer);

    console.log('Deserializing token...');
    const token = resultArgs.nextString();
    console.log('Token:', token);

    console.log('Deserializing amount...');
    const amount = resultArgs.nextU256().toString();
    console.log('Amount:', amount);

    console.log('Deserializing recipient...');
    const recipient = resultArgs.nextString();
    console.log('Recipient:', recipient);

    console.log('Deserializing timestamp...');
    const timestamp = Number(resultArgs.nextU64());
    console.log('Timestamp:', timestamp);

    console.log('Deserializing executed...');
    const executed = resultArgs.nextBool();
    console.log('Executed:', executed);

    console.log('Deserializing approvals...');
    const approvals = resultArgs.nextArray(ArrayTypes.STRING) as string[];
    console.log('Approvals:', approvals);

    return {
      id,
      proposer,
      token,
      amount,
      recipient,
      timestamp,
      executed,
      approvals,
    };
  } catch (error: any) {
    console.error(`Error fetching proposal ${proposalId}:`, error);
    console.error('Error details:', error.message);
    return null;
  }
}

/**
 * Create a new multi-sig vault
 */
export async function createMultiSigVault(
  connectedAccount: any,
  signers: string[],
  threshold: number,
  tokensWithPercentage: TokenWithPercentage[],
  vaultName: string,
  initialCoins: string = '0.1'
): Promise<{ success: boolean; vaultAddress?: string; error?: string }> {
  const toastId = toast.loading('Creating multi-sig vault...');

  try {
    console.log('Creating multi-sig vault with signers:', signers);
    console.log('Threshold:', threshold);
    console.log('Vault name:', vaultName);

    const contract = getFactoryContract(connectedAccount);

    const args = new Args()
      .addArray(signers, ArrayTypes.STRING)
      .addU8(BigInt(threshold))
      .addSerializableObjectArray(tokensWithPercentage)
      .addString(vaultName)
      .addU64(parseMas(initialCoins))
      .serialize();

    // Call the smart contract function
    // Need to send enough coins for:
    // - Operation fee (~0.1 MAS)
    // - Factory to deploy new vault contract (~0.1 MAS)
    // - Initial coins for the vault (initialCoins parameter)
    const operation = await contract.call('createMultiSigVault', args, {
      coins: parseMas('10'), // Enough for operation fee + vault deployment + initial vault coins
    });

    console.log(`Operation ID: ${operation.id}`);
    toast.update(toastId, {
      render: 'Waiting for transaction confirmation...',
      isLoading: true,
    });

    // Wait for the operation to be executed
    const status = await operation.waitSpeculativeExecution();

    if (status === OperationStatus.SpeculativeSuccess) {
      console.log('Multi-sig vault created successfully');

      // Get events to extract vault address
      const events = await operation.getSpeculativeEvents();
      let vaultAddress = '';

      for (const event of events) {
        if (event.data && event.data.includes('CREATE_MULTISIG_VAULT')) {
          // Extract vault address from event data
          const eventParts = event.data.split(',');
          if (eventParts.length > 0) {
            vaultAddress = eventParts[0]
              .replace('CREATE_MULTISIG_VAULT:', '')
              .trim();
          }
          break;
        }
      }

      toast.update(toastId, {
        render: 'Multi-sig vault created successfully!',
        type: 'success',
        isLoading: false,
        autoClose: 5000,
      });

      return { success: true, vaultAddress };
    } else {
      console.log('Status:', status);
      const spec_events = await operation.getSpeculativeEvents();
      console.log('Speculative events:', spec_events);

      toast.update(toastId, {
        render: 'Failed to create multi-sig vault',
        type: 'error',
        isLoading: false,
        autoClose: 5000,
      });

      return { success: false, error: 'Transaction failed' };
    }
  } catch (error: any) {
    console.error('Error creating multi-sig vault:', error);

    toast.update(toastId, {
      render: `Error: ${error.message || 'Unknown error'}`,
      type: 'error',
      isLoading: false,
      autoClose: 5000,
    });

    return { success: false, error: error.message };
  }
}

/**
 * Deposit to multi-sig vault
 */
export async function depositToMultiSigVault(
  connectedAccount: any,
  vaultAddress: string,
  amount: string,
  deadline: number = Math.floor(Date.now() / 1000) + 3600
): Promise<{ success: boolean; error?: string }> {
  const toastId = toast.loading('Depositing to multi-sig vault...');

  try {
    console.log('Depositing to vault:', vaultAddress);
    console.log('Amount:', amount);

    // First approve the vault to spend tokens
    const baseToken = new MRC20(connectedAccount, BASE_TOKEN_ADDRESS);
    const amountInSmallestUnit = parseUnits(amount, USDC_DECIMALS);

    // Approve
    const approveOp = await baseToken.increaseAllowance(
      vaultAddress,
      amountInSmallestUnit
    );
    await approveOp.waitSpeculativeExecution();

    // Now deposit
    const vaultContract = getMultiSigVaultContract(
      connectedAccount,
      vaultAddress
    );

    const args = new Args()
      .addU256(amountInSmallestUnit)
      .addU64(parseMas('0.5')) // Coins for swap operations
      .addU64(BigInt(deadline))
      .serialize();

    const operation = await vaultContract.call('deposit', args, {
      coins: parseMas('2'),
    });

    const status = await operation.waitSpeculativeExecution();

    if (status === OperationStatus.SpeculativeSuccess) {
      toast.update(toastId, {
        render: 'Deposit successful!',
        type: 'success',
        isLoading: false,
        autoClose: 5000,
      });

      return { success: true };
    } else {
      toast.update(toastId, {
        render: 'Deposit failed',
        type: 'error',
        isLoading: false,
        autoClose: 5000,
      });

      return { success: false, error: 'Transaction failed' };
    }
  } catch (error: any) {
    console.error('Error depositing:', error);

    toast.update(toastId, {
      render: `Error: ${error.message || 'Unknown error'}`,
      type: 'error',
      isLoading: false,
      autoClose: 5000,
    });

    return { success: false, error: error.message };
  }
}

/**
 * Create withdrawal proposal
 */
export async function proposeWithdrawal(
  connectedAccount: any,
  vaultAddress: string,
  token: string,
  amount: string,
  recipient: string,
  decimals: number = USDC_DECIMALS
): Promise<{ success: boolean; proposalId?: number; error?: string }> {
  const toastId = toast.loading('Creating withdrawal proposal...');

  try {
    const vaultContract = getMultiSigVaultContract(
      connectedAccount,
      vaultAddress
    );

    const amountInSmallestUnit = parseUnits(amount, decimals);

    const args = new Args()
      .addString(token)
      .addU256(amountInSmallestUnit)
      .addString(recipient)
      .serialize();

    const operation = await vaultContract.call('proposeWithdrawal', args, {
      coins: parseMas('0.5'),
    });

    const status = await operation.waitSpeculativeExecution();

    if (status === OperationStatus.SpeculativeSuccess) {
      toast.update(toastId, {
        render: 'Proposal created successfully!',
        type: 'success',
        isLoading: false,
        autoClose: 5000,
      });

      return { success: true };
    } else {
      toast.update(toastId, {
        render: 'Failed to create proposal',
        type: 'error',
        isLoading: false,
        autoClose: 5000,
      });

      return { success: false, error: 'Transaction failed' };
    }
  } catch (error: any) {
    console.error('Error creating proposal:', error);

    toast.update(toastId, {
      render: `Error: ${error.message || 'Unknown error'}`,
      type: 'error',
      isLoading: false,
      autoClose: 5000,
    });

    return { success: false, error: error.message };
  }
}

/**
 * Approve a withdrawal proposal
 */
export async function approveProposal(
  connectedAccount: any,
  vaultAddress: string,
  proposalId: number
): Promise<{ success: boolean; error?: string }> {
  const toastId = toast.loading('Approving proposal...');

  try {
    const vaultContract = getMultiSigVaultContract(
      connectedAccount,
      vaultAddress
    );

    const args = new Args().addU32(BigInt(proposalId)).serialize();

    const operation = await vaultContract.call('approveProposal', args, {
      coins: parseMas('0.5'),
    });

    const status = await operation.waitSpeculativeExecution();

    if (status === OperationStatus.SpeculativeSuccess) {
      toast.update(toastId, {
        render: 'Proposal approved!',
        type: 'success',
        isLoading: false,
        autoClose: 5000,
      });

      return { success: true };
    } else {
      toast.update(toastId, {
        render: 'Failed to approve proposal',
        type: 'error',
        isLoading: false,
        autoClose: 5000,
      });

      return { success: false, error: 'Transaction failed' };
    }
  } catch (error: any) {
    console.error('Error approving proposal:', error);

    toast.update(toastId, {
      render: `Error: ${error.message || 'Unknown error'}`,
      type: 'error',
      isLoading: false,
      autoClose: 5000,
    });

    return { success: false, error: error.message };
  }
}





