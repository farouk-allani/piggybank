import 'dotenv/config';
import {
  Account,
  JsonRpcProvider,
  SmartContract,
  Args,
  parseMas,
} from '@massalabs/massa-web3';

const FACTORY_ADDRESS = 'AS12LqhMDA8ssWTuXryjM8HSbQ8mZ2qPhN21of1kbCPPLbSGqYyam';

async function main() {
  console.log('💰 Funding Factory Contract...\n');

  // Load account from environment
  const account = await Account.fromEnv();
  const provider = JsonRpcProvider.buildnet(account);

  console.log('Account address:', provider.address);
  console.log('Factory address:', FACTORY_ADDRESS);
  console.log('Network: Buildnet\n');

  // Send 10 MAS to the factory by calling a getter function with coins attached
  // The coins will be transferred to the contract
  console.log('📝 Sending 10 MAS to factory...');

  const factoryContract = new SmartContract(provider, FACTORY_ADDRESS);

  const operation = await factoryContract.call(
    'getEagleSwapRouterAddress',
    new Args().serialize(),
    {
      coins: parseMas('10'),
    }
  );

  console.log('Operation ID:', operation.id);
  console.log('Waiting for confirmation...');

  await operation.waitSpeculativeExecution();

  console.log('\n✅ Factory funded successfully!');
  console.log('Factory now has enough coins to create vaults.');
}

main().catch(console.error);

