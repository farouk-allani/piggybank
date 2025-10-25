import {
  Account,
  Args,
  bytesToStr,
  Mas,
  MRC20,
  OperationStatus,
  parseMas,
  parseUnits,
  Provider,
  SmartContract,
  Web3Provider,
} from '@massalabs/massa-web3';

export async function increaseTokenAllowance(
  tokenContract: MRC20,
  spenderAddress: string,
  amount: string,
) {
  console.log(
    `Increasing allowance for ${spenderAddress} to spend ${amount} tokens...`,
  );

  const op = await tokenContract.increaseAllowance(
    spenderAddress,
    parseUnits(amount, 6),
  ); // Assuming token has 6 decimals

  console.log(`Operation ID: ${op.id}`);

  const status = await op.waitSpeculativeExecution();

  if (status === OperationStatus.SpeculativeSuccess) {
    console.log(`Allowance increased successfully.`);
  } else {
    console.log('Status:', status);
    // Show speculativ events for debugging
    const spec_events = await op.getSpeculativeEvents();
    console.log('Speculative events:', spec_events);
    throw new Error('Failed to increase allowance');
  }
}
