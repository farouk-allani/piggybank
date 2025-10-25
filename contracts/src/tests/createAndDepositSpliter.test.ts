import 'dotenv/config';
import {
  Account,
  Args,
  Mas,
  SmartContract,
  JsonRpcProvider,
  MRC20,
  formatUnits,
  BUILDNET_TOKENS,
} from '@massalabs/massa-web3';
import * as dotenv from 'dotenv';
import { TokenWithPercentage } from '../calls/structs/TokenWithPercentage';
import { USDC_TOKEN_ADDRESS, WETH_TOKEN_ADDRESS } from '../calls/const';
import {
  createAndDepositSplitterVault,
  createSplitterVault,
  deployFactory,
  getUserSplitterVaults,
} from '../calls/factory';
import { increaseTokenAllowance } from '../calls/token';

dotenv.config();

const account = await Account.fromEnv();
const provider = JsonRpcProvider.buildnet(account);

const factoryContract = await deployFactory(provider);

const usdcTokenPercentage = new TokenWithPercentage(USDC_TOKEN_ADDRESS, 30n);
const wethTokenPercentage = new TokenWithPercentage(WETH_TOKEN_ADDRESS, 20n);
const wmasTokenPercentage = new TokenWithPercentage(BUILDNET_TOKENS.WMAS, 50n);
const usdcTokenContract = new MRC20(provider, USDC_TOKEN_ADDRESS);
const wethTokenContract = new MRC20(provider, WETH_TOKEN_ADDRESS);
const wmasTokenContract = new MRC20(provider, BUILDNET_TOKENS.WMAS);

const tokensWithPercentage = [
  usdcTokenPercentage,
  wethTokenPercentage,
  wmasTokenPercentage,
];

console.log('Account address:', account.address.toString());
console.log('Factory contract address:', factoryContract.address.toString());

const amount = '10';

// Increase the Allowance of the factory contract to spend user's USDC
await increaseTokenAllowance(
  usdcTokenContract,
  factoryContract.address.toString(),
  amount,
);

await createAndDepositSplitterVault(
  factoryContract,
  tokensWithPercentage,
  amount,
);

// Get teh user splitter vaults
const splitterVaults = await getUserSplitterVaults(
  provider,
  account.address.toString(),
  factoryContract,
);

console.log('User splitter vaults:', splitterVaults);

if (splitterVaults.length === 0) {
  throw new Error('No splitter vaults found for the user');
}

const firstSplitterVault = new SmartContract(provider, splitterVaults[0]);

const wmasBalance = await wmasTokenContract.balanceOf(
  firstSplitterVault.address,
);
console.log(`Splitter vault WMAS balance: ${formatUnits(wmasBalance, 9)} WMAS`);

const usdcBalance = await usdcTokenContract.balanceOf(
  firstSplitterVault.address,
);
console.log(`Splitter vault USDC balance: ${formatUnits(usdcBalance, 6)} USDC`);

const wethBalance = await wethTokenContract.balanceOf(
  firstSplitterVault.address,
);
console.log(
  `Splitter vault WETH balance: ${formatUnits(wethBalance, 18)} WETH`,
);
