import { SmartContract, Args, ArrayTypes, parseUnits, parseMas, OperationStatus, bytesToStr, MRC20 } from '@massalabs/massa-web3';
import { toast } from 'react-toastify';
import {
  DCA,
  DCADisplay,
  DCA_CONTRACT_ADDRESS,
  getTokenSymbol,
  formatInterval,
  calculateDCAStatus,
  calculateProgress,
  estimateNextExecution
} from './dca-types';
import { USDC_DECIMALS, WMAS_DECIMALS, WETH_DECIMALS, WBTC_DECIMALS } from './types';

// Get DCA contract instance
function getDCAContract(connectedAccount: any): SmartContract {
  if (!connectedAccount) throw new Error("Missing connected account");

  if (!DCA_CONTRACT_ADDRESS) {
    throw new Error('DCA contract address not found');
  }

  return new SmartContract(connectedAccount, DCA_CONTRACT_ADDRESS);
}

// Get token decimals based on address
function getTokenDecimals(tokenAddress: string): number {
  const decimalsMap: { [key: string]: number } = {
    'AS12N76WPYB3QNYKGhV2jZuQs1djdhNJLQgnm7m52pHWecvvj1fCQ': USDC_DECIMALS, // USDC
    'AS12FW5Rs5YN2zdpEnqwj4iHUUPt9R4Eqjq2qtpJFNKW3mn33RuLU': WMAS_DECIMALS, // WMAS
    'AS12rcqHGQ3bPPhnjBZsYiANv9TZxYp96M7r49iTMUrX8XCJQ8Wrk': WETH_DECIMALS, // WETH
    'AS1ZXy3nvqXAMm2w6viAg7frte6cZfJM8hoMvWf4KoKDzvLzYKqE': WBTC_DECIMALS  // WBTC
  };
  return decimalsMap[tokenAddress] || 18; // Default to 18 decimals
}

// Format token amount for display
function formatTokenAmount(amount: bigint, tokenAddress: string): string {
  const decimals = getTokenDecimals(tokenAddress);
  const divisor = BigInt(10 ** decimals);
  const readableAmount = amount > 0n ?
    (Number(amount) / Number(divisor)).toFixed(6).replace(/\.?0+$/, '') : '0';
  return readableAmount;
}

// Start a new DCA strategy
export async function startDCA(
  connectedAccount: any,
  amountEachDCA: string,
  interval: bigint,
  nbOfDCA: bigint,
  tokenPath: string[],
  threshold: bigint,
  moreGas: boolean,
  startIn: bigint = 0n,
  masToSend: string = '0'
): Promise<{ success: boolean; dcaId?: number; error?: string }> {
  const toastId = toast.loading('Creating DCA strategy...');

  try {
    console.log('Starting DCA strategy...');

    const contract = getDCAContract(connectedAccount);

    // Get decimals for the first token in path (source token)
    const sourceTokenDecimals = getTokenDecimals(tokenPath[0]);
    const amountInSmallestUnit = parseUnits(amountEachDCA, sourceTokenDecimals);

    console.log('DCA Parameters:', {
      amountEachDCA: amountInSmallestUnit.toString(),
      interval: interval.toString(),
      nbOfDCA: nbOfDCA.toString(),
      tokenPath,
      threshold: threshold.toString(),
      moreGas,
      startIn: startIn.toString(),
      masToSend
    });

    const args = new Args()
      .addU256(amountInSmallestUnit)
      .addU64(interval)
      .addU64(nbOfDCA)
      .addArray(tokenPath, ArrayTypes.STRING)
      .addU32(threshold)
      .addBool(moreGas)
      .addU64(startIn)
      .serialize();

    toast.update(toastId, {
      render: 'Waiting for transaction confirmation...',
      isLoading: true
    });

    const operation = await contract.call('startDCA', args, {
      coins: masToSend ? parseMas(masToSend) : parseMas('0.1'), // Gas for the transaction
    });

    console.log(`Operation ID: ${operation.id}`);

    const status = await operation.waitSpeculativeExecution();

    if (status === OperationStatus.SpeculativeSuccess) {
      console.log('DCA strategy created successfully');

      // Get events to extract DCA ID
      const events = await operation.getSpeculativeEvents();
      console.log('All events:', events);
      let dcaId: number | undefined;

      for (const event of events) {
        console.log('Event:', event);
        if (event.data && event.data.includes('DCA_ADDED')) {
          // Extract DCA ID from event data: "DCA_ADDED:address;?!14"
          const parts = event.data.split(';?!');
          if (parts.length > 1) {
            // Remove any non-numeric characters and parse
            const idStr = parts[1].replace(/[^\d]/g, '');
            if (idStr) {
              dcaId = parseInt(idStr);
              console.log('Extracted DCA ID:', dcaId);
            }
          }
          break;
        }
      }

      if (!dcaId) {
        console.warn('Could not extract DCA ID from events');
      }

      toast.update(toastId, {
        render: dcaId ? ` DCA #${dcaId} created successfully!` : ' DCA strategy created successfully!',
        type: 'success',
        isLoading: false,
        autoClose: 5000,
      });

      return { success: true, dcaId };
    } else {
      console.log('Status:', status);
      const spec_events = await operation.getSpeculativeEvents();
      console.log('Speculative events:', spec_events);

      toast.update(toastId, {
        render: 'Failed to create DCA strategy',
        type: 'error',
        isLoading: false,
        autoClose: 5000,
      });

      return { success: false, error: 'Failed to create DCA strategy' };
    }
  } catch (error) {
    console.error('Error creating DCA strategy:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    toast.update(toastId, {
      render: `Error: ${errorMessage}`,
      type: 'error',
      isLoading: false,
      autoClose: 5000,
    });

    return { success: false, error: errorMessage };
  }
}

// Stop a DCA strategy
export async function stopDCA(
  connectedAccount: any,
  dcaId: bigint
): Promise<{ success: boolean; error?: string }> {
  const toastId = toast.loading('Stopping DCA strategy...');

  try {
    console.log(`Stopping DCA ${dcaId}...`);

    const contract = getDCAContract(connectedAccount);

    const args = new Args()
      .addU64(dcaId)
      .serialize();

    toast.update(toastId, {
      render: 'Waiting for transaction confirmation...',
      isLoading: true
    });

    const operation = await contract.call('stopDCA', args, {
      coins: parseMas('0.1'), // Gas for the transaction
    });

    const status = await operation.waitSpeculativeExecution();

    if (status === OperationStatus.SpeculativeSuccess) {
      toast.update(toastId, {
        render: '🛑 DCA strategy stopped successfully',
        type: 'success',
        isLoading: false,
        autoClose: 5000,
      });

      return { success: true };
    } else {
      const events = await operation.getSpeculativeEvents();
      console.log('Stop DCA failed, events:', events);

      toast.update(toastId, {
        render: 'Failed to stop DCA strategy',
        type: 'error',
        isLoading: false,
        autoClose: 5000,
      });

      return { success: false, error: 'Failed to stop DCA strategy' };
    }
  } catch (error) {
    console.error('Error stopping DCA:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    toast.update(toastId, {
      render: `Error: ${errorMessage}`,
      type: 'error',
      isLoading: false,
      autoClose: 5000,
    });

    return { success: false, error: errorMessage };
  }
}

// Update a DCA strategy
export async function updateDCA(
  connectedAccount: any,
  dcaId: bigint,
  amountEachDCA: string,
  interval: bigint,
  nbOfDCA: bigint,
  tokenPath: string[],
  threshold: bigint,
  moreGas: boolean,
  masToSend: string = '0'
): Promise<{ success: boolean; error?: string }> {
  const toastId = toast.loading('Updating DCA strategy...');

  try {
    console.log(`Updating DCA ${dcaId}...`);

    const contract = getDCAContract(connectedAccount);

    // Get decimals for the first token in path (source token)
    const sourceTokenDecimals = getTokenDecimals(tokenPath[0]);
    const amountInSmallestUnit = parseUnits(amountEachDCA, sourceTokenDecimals);

    const args = new Args()
      .addU64(dcaId)
      .addU256(amountInSmallestUnit)
      .addU64(interval)
      .addU64(nbOfDCA)
      .addArray(tokenPath, ArrayTypes.STRING)
      .addU32(threshold)
      .addBool(moreGas)
      .serialize();

    toast.update(toastId, {
      render: 'Waiting for transaction confirmation...',
      isLoading: true
    });

    const operation = await contract.call('updateDCA', args, {
      coins: masToSend ? parseMas(masToSend) : parseMas('0.1'), // Gas for the transaction
    });

    const status = await operation.waitSpeculativeExecution();

    if (status === OperationStatus.SpeculativeSuccess) {
      toast.update(toastId, {
        render: '✅ DCA strategy updated successfully',
        type: 'success',
        isLoading: false,
        autoClose: 5000,
      });

      return { success: true };
    } else {
      const events = await operation.getSpeculativeEvents();
      console.log('Update DCA failed, events:', events);

      toast.update(toastId, {
        render: 'Failed to update DCA strategy',
        type: 'error',
        isLoading: false,
        autoClose: 5000,
      });

      return { success: false, error: 'Failed to update DCA strategy' };
    }
  } catch (error) {
    console.error('Error updating DCA:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    toast.update(toastId, {
      render: `Error: ${errorMessage}`,
      type: 'error',
      isLoading: false,
      autoClose: 5000,
    });

    return { success: false, error: errorMessage };
  }
}

// Get a single DCA by ID
export async function getDCA(
  connectedAccount: any,
  dcaId: bigint,
  owner: string
): Promise<DCA | null> {
  try {
    console.log(`Fetching DCA ${dcaId} for owner ${owner}...`);

    const storageKey = `D::${owner}:${dcaId}`;

    // Read from storage directly
    const value = await connectedAccount.readStorage(
      DCA_CONTRACT_ADDRESS,
      [storageKey],
      false
    );

    console.log(`Storage read result for DCA ${dcaId}:`, value);

    if (!value || value.length === 0 || !value[0]) {
      console.log(`No DCA found with ID ${dcaId}`);
      return null;
    }

    // Extract bytes from storage response
    let dataBytes = value[0];
    if (typeof dataBytes === 'object' && !(dataBytes instanceof Uint8Array)) {
      dataBytes = dataBytes.value || dataBytes.final_value || dataBytes.candidate_value || dataBytes;
    }

    if (dataBytes instanceof Uint8Array && dataBytes.length === 0) {
      console.log(`DCA ${dcaId} storage is empty`);
      return null;
    }

    const resultArgs = new Args(dataBytes);

    // Read fields in the correct order (matching DUSA SDK)
    const amountEachDCA = resultArgs.nextU256()!;
    const intervalInMilliseconds = Number(resultArgs.nextU64()!);
    const nbOfDCA = Number(resultArgs.nextU64()!);
    const tokenPath = resultArgs.nextArray(ArrayTypes.STRING) as string[];
    const threshold = Number(resultArgs.nextU32()!);
    const moreGas = resultArgs.nextBool()!;
    const startTime = Number(resultArgs.nextU64()!);
    const executedCount = Number(resultArgs.nextU64()!);
    const deferredCallId = resultArgs.nextString()!;

    // DUSA stores interval in milliseconds, convert to seconds for UI
    const intervalInSeconds = Math.floor(intervalInMilliseconds / 1000);

    const dca: DCA = {
      id: Number(dcaId),
      amountEachDCA,
      interval: intervalInSeconds,
      nbOfDCA,
      tokenPath,
      threshold,
      moreGas,
      startTime,
      endTime: 0,
      executedCount,
      deferredCallId
    };

    // Calculate end time (interval is in seconds, need to convert to ms)
    dca.endTime = dca.startTime + (dca.interval * dca.nbOfDCA * 1000);

    console.log(`Successfully fetched DCA ${dcaId}:`, dca);
    return dca;
  } catch (error) {
    console.log(`DCA ${dcaId} not found or error:`, error);
    return null;
  }
}

// Get all DCAs for a user
export async function getUserDCAs(
  connectedAccount: any,
  userAddress: string
): Promise<DCADisplay[]> {
  try {
    console.log(`Fetching DCAs for user ${userAddress}...`);

    const storagePrefix = `D::${userAddress}:`;

    let keys;
    try {
      keys = await connectedAccount.getStorageKeys(
        DCA_CONTRACT_ADDRESS,
        storagePrefix,
        false
      );
    } catch (error) {
      console.error('Error getting storage keys:', error);

      // Fallback: try to fetch known DCA IDs (12, 11, 6 based on your history)
      console.log('Trying fallback method with known IDs...');
      const dcas: DCADisplay[] = [];
      for (const id of [12, 11, 10, 9, 8, 7, 6]) {
        const dca = await getDCA(connectedAccount, BigInt(id), userAddress);
        if (dca) {
          const status = calculateDCAStatus(dca);
          const progress = calculateProgress(dca);
          const estimatedNext = estimateNextExecution(dca);

          dcas.push({
            ...dca,
            status,
            fromToken: getTokenSymbol(dca.tokenPath[0]),
            toToken: getTokenSymbol(dca.tokenPath[dca.tokenPath.length - 1]),
            amountEachDCAFormatted: formatTokenAmount(dca.amountEachDCA, dca.tokenPath[0]),
            intervalFormatted: formatInterval(dca.interval),
            progress,
            estimatedNextExecution: estimatedNext
          });
        }
      }
      return dcas;
    }

    console.log(`Found ${keys.length} DCA keys`);
    console.log('Raw keys response:', keys);

    // If no keys found, try fallback method with known IDs
    if (!keys || keys.length === 0) {
      console.log('No keys found, trying fallback method - checking IDs 1-30...');
      const dcas: DCADisplay[] = [];
      for (const id of Array.from({ length: 30 }, (_, i) => i + 1)) {
        try {
          const dca = await getDCA(connectedAccount, BigInt(id), userAddress);
          if (dca) {
            console.log(`Found DCA #${id}:`, dca);
            const status = calculateDCAStatus(dca);
            const progress = calculateProgress(dca);
            const estimatedNext = estimateNextExecution(dca);

            dcas.push({
              ...dca,
              status,
              fromToken: getTokenSymbol(dca.tokenPath[0]),
              toToken: getTokenSymbol(dca.tokenPath[dca.tokenPath.length - 1]),
              amountEachDCAFormatted: formatTokenAmount(dca.amountEachDCA, dca.tokenPath[0]),
              intervalFormatted: formatInterval(dca.interval),
              progress,
              estimatedNextExecution: estimatedNext
            });
          }
        } catch (err) {
          // DCA doesn't exist, continue
        }
      }
      console.log(`Fetched ${dcas.length} DCAs using fallback method`);
      return dcas;
    }

    const dcas: DCADisplay[] = [];

    for (const key of keys) {
      const deserializedKey = bytesToStr(key);
      console.log('DCA key:', deserializedKey);

      // Extract DCA ID from key: "D::<address>:<id>"
      const parts = deserializedKey.split(':');
      // Key format is "D::address:id" which splits into ['D', '', 'address', 'id'] (4 parts)
      if (parts.length === 4) {
        const dcaId = BigInt(parts[3]); // ID is at index 3, not 2
        const dca = await getDCA(connectedAccount, dcaId, userAddress);

        if (dca) {
          // Convert to DCADisplay
          const status = calculateDCAStatus(dca);
          const progress = calculateProgress(dca);
          const estimatedNext = estimateNextExecution(dca);

          const dcaDisplay: DCADisplay = {
            ...dca,
            status,
            fromToken: getTokenSymbol(dca.tokenPath[0]),
            toToken: getTokenSymbol(dca.tokenPath[dca.tokenPath.length - 1]),
            amountEachDCAFormatted: formatTokenAmount(dca.amountEachDCA, dca.tokenPath[0]),
            intervalFormatted: formatInterval(dca.interval),
            progress,
            estimatedNextExecution: estimatedNext
          };

          dcas.push(dcaDisplay);
        }
      }
    }

    console.log(`Fetched ${dcas.length} DCAs for user`);
    return dcas;
  } catch (error) {
    console.error('Error fetching user DCAs:', error);
    return [];
  }
}

// Approve token spending for DCA contract
export async function approveTokenForDCA(
  connectedAccount: any,
  tokenAddress: string,
  amount: string
): Promise<{ success: boolean; error?: string }> {
  const toastId = toast.loading('Approving token spending...');

  try {
    const tokenContract = new SmartContract(connectedAccount, tokenAddress);
    const decimals = getTokenDecimals(tokenAddress);

    const args = new Args()
      .addString(DCA_CONTRACT_ADDRESS) // spender
      .addU256(parseUnits(amount, decimals)) // amount
      .addU64(parseMas('0.01')) // coins for balance entry cost
      .serialize();

    console.log(`Approving DCA contract to spend ${amount} tokens`);

    toast.update(toastId, {
      render: 'Waiting for approval confirmation...',
      isLoading: true
    });

    const operation = await tokenContract.call('increaseAllowance', args, {
      coins: parseMas('0.1'), // Gas for approval
    });

    const status = await operation.waitSpeculativeExecution();

    if (status === OperationStatus.SpeculativeSuccess) {
      toast.update(toastId, {
        render: '✅ Token spending approved',
        type: 'success',
        isLoading: false,
        autoClose: 3000,
      });

      return { success: true };
    } else {
      toast.update(toastId, {
        render: 'Token approval failed',
        type: 'error',
        isLoading: false,
        autoClose: 5000,
      });

      return { success: false, error: 'Token approval failed' };
    }
  } catch (error) {
    console.error('Error approving token:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    toast.update(toastId, {
      render: `Approval failed: ${errorMessage}`,
      type: 'error',
      isLoading: false,
      autoClose: 5000,
    });

    return { success: false, error: errorMessage };
  }
}

// Get user's token balance
export async function getUserTokenBalance(
  connectedAccount: any,
  userAddress: string,
  tokenAddress: string
): Promise<string> {
  try {
    const tokenContract = new MRC20(connectedAccount, tokenAddress);
    const rawBalance = await tokenContract.balanceOf(userAddress);

    const balanceBigInt = BigInt(rawBalance.toString());
    const decimals = getTokenDecimals(tokenAddress);
    const divisor = BigInt(10 ** decimals);
    const readableBalance = balanceBigInt > 0n ?
      (Number(balanceBigInt) / Number(divisor)).toFixed(6).replace(/\.?0+$/, '') : '0';

    return readableBalance;
  } catch (error) {
    console.error('Error getting token balance:', error);
    return '0';
  }
}
