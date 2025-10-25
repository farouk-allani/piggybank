import 'dotenv/config';
import {
  Account,
  Args,
  Mas,
  SmartContract,
  JsonRpcProvider,
} from '@massalabs/massa-web3';
import { getScByteCode } from './utils';
import { TokenWithPercentage } from './calls/structs/TokenWithPercentage';

const account = await Account.fromEnv();
const provider = JsonRpcProvider.buildnet(account);

console.log('Deploying contract...');

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

const events = await provider.getEvents({
  smartContractAddress: contract.address,
});

for (const event of events) {
  console.log('Event message:', event.data);
}
