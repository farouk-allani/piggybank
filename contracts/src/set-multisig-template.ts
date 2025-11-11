import 'dotenv/config';
import {
  Account,
  Args,
  JsonRpcProvider,
  SmartContract,
  parseMas,
} from '@massalabs/massa-web3';

const FACTORY_ADDRESS = 'AS17QCqE84wEygb6prEXJZERqzubQr5c6tvJZ3t5eLFPYpoNAbac';
const MULTISIG_TEMPLATE_ADDRESS = 'AS13xj59tBzoAidm6s4Pd2neEdpjbaWd5Dk3NbyY6saywG2W1aGp';

async function main() {
  console.log('🔧 Setting Multi-Sig Template Address...\n');

  // Load account from environment
  const account = await Account.fromEnv();
  const provider = JsonRpcProvider.buildnet(account);

  console.log('Account address:', provider.address);
  console.log('Factory address:', FACTORY_ADDRESS);
  console.log('Template address:', MULTISIG_TEMPLATE_ADDRESS);
  console.log('Network: Buildnet\n');

  // Create factory contract instance
  const factoryContract = new SmartContract(provider, FACTORY_ADDRESS);

  console.log('📝 Calling setMultiSigTemplateAddress...');

  const args = new Args().addString(MULTISIG_TEMPLATE_ADDRESS).serialize();

  const operation = await factoryContract.call('setMultiSigTemplateAddress', args, {
    coins: parseMas('0.1'),
  });

  console.log('Operation ID:', operation.id);
  console.log('Waiting for confirmation...');

  await operation.waitSpeculativeExecution();

  console.log('\n Multi-sig template address set successfully!');
  console.log('\n Next steps:');
  console.log('1. Update frontend/.env with:');
  console.log(`   VITE_SMART_CONTRACT=${FACTORY_ADDRESS}`);
  console.log(`   VITE_MULTISIG_TEMPLATE=${MULTISIG_TEMPLATE_ADDRESS}`);
  console.log('2. Rebuild and redeploy the frontend');
  console.log('3. Test creating a multi-sig vault from the UI');
}

main().catch(console.error);

