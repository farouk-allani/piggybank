import 'dotenv/config';
import {
  Account,
  Args,
  ArrayTypes,
  Mas,
  SmartContract,
  JsonRpcProvider,
} from '@massalabs/massa-web3';
import { getScByteCode } from './utils';
import { TokenWithPercentage } from './calls/structs/TokenWithPercentage';

// EagleFi Router address on buildnet
const eaglefiRouterAddress =
  'AS1Kf2KVdYghv9PeVcgQKVBpuVAqdvfwwMbGuffByxJbSMLqLvVo';

async function main() {
  console.log('🚀 Deploying Multi-Sig Vault Template...\n');

  // Load account from environment
  const account = await Account.fromEnv();
  const provider = JsonRpcProvider.buildnet(account);

  console.log('Account address:', provider.address);
  console.log('Network: Buildnet\n');

  // Get bytecode
  const multiSigByteCode = getScByteCode('build', 'multiSigVault.wasm');

  console.log('📦 Deploying multi-sig template contract...');

  // Deploy template with valid initialization
  const dummySigners = [
    provider.address,
    'AU12dG5xP1RDEB5ocdHkymNVvvSJmUL9BgHwCksDowqmGWxfpm93x', // Dummy second signer
  ];

  // Token allocation: 100% to BASE_TOKEN (USDC.e)
  const tokensWithPercentage: TokenWithPercentage[] = [
    new TokenWithPercentage(
      'AS12U4TZfNK7qoLyEERBBRDMu8nm5MKoRzPXDXans4v9wdATZedz9', // BASE_TOKEN_ADDRESS
      100n,
    ),
  ];

  // Build args using addArray for string array
  const templateArgs = new Args()
    .addArray(dummySigners, ArrayTypes.STRING)
    .addU8(2n) // 2 of 2 threshold
    .addSerializableObjectArray(tokensWithPercentage)
    .addString('Template Multi-Sig Vault')
    .addString(eaglefiRouterAddress);

  console.log('Deploying multi-sig template with', dummySigners.length, 'signers...');

  const multiSigTemplate = await SmartContract.deploy(
    provider,
    multiSigByteCode,
    templateArgs,
    {
      coins: Mas.fromString('0.1'), // Initial coins
    }
  );

  console.log('✅ Multi-Sig Template deployed at:', multiSigTemplate.address);
  console.log('\n📝 Next steps:');
  console.log('1. Copy the template address above');
  console.log(
    '2. Call setMultiSigTemplateAddress() on your factory contract'
  );
  console.log('3. Update your .env file with the template address');
  console.log('\nExample:');
  console.log(
    `VITE_MULTISIG_TEMPLATE=${multiSigTemplate.address}`
  );
  console.log('\n🎉 Deployment complete!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

