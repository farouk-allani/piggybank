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
  createSplitterVault,
  deployFactory,
  getUserSplitterVaults,
} from '../calls/factory';
import { depositToSplitterVault } from '../calls/splitter';
import { increaseTokenAllowance } from '../calls/token';

dotenv.config();

const account = await Account.fromEnv();
const provider = JsonRpcProvider.buildnet(account);

const factoryContract = await deployFactory(provider);

const btcTokenAddress = 'AS1ZXy3nvqXAMm2w6viAg7frte6cZfJM8hoMvWf4KoKDzvLzYKqE';

// const usdcTokenPercentage = new TokenWithPercentage(USDC_TOKEN_ADDRESS, 0n);
const wethTokenPercentage = new TokenWithPercentage(WETH_TOKEN_ADDRESS, 50n);
const wmasTokenPercentage = new TokenWithPercentage(BUILDNET_TOKENS.WMAS, 30n);
const btcTokenPercentage = new TokenWithPercentage(btcTokenAddress, 20n);
const usdcTokenContract = new MRC20(provider, USDC_TOKEN_ADDRESS);
const wethTokenContract = new MRC20(provider, WETH_TOKEN_ADDRESS);
const wmasTokenContract = new MRC20(provider, BUILDNET_TOKENS.WMAS);
const btcTokenContract = new MRC20(provider, btcTokenAddress);

const tokensWithPercentage = [
  // btcTokenPercentage,
  wethTokenPercentage,
  wmasTokenPercentage,
];

console.log('Account address:', account.address.toString());
console.log('Factory contract address:', factoryContract.address.toString());

// Create
await createSplitterVault(factoryContract, tokensWithPercentage);

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

console.log('Test passed successfully');

const firstSplitterVault = new SmartContract(provider, splitterVaults[0]);

const amount = '100';

// Increase the Allowance of the splitter vault contract to spend user's USDC
await increaseTokenAllowance(
  usdcTokenContract,
  firstSplitterVault.address.toString(),
  amount,
);

// Deposit
await depositToSplitterVault(firstSplitterVault, amount);

// Get the balance of the splitter vault
const balance = await usdcTokenContract.balanceOf(
  firstSplitterVault.address.toString(),
);
console.log(`Splitter vault USDC balance: ${formatUnits(balance, 6)} USDC`);

const wethBalance = await wethTokenContract.balanceOf(
  firstSplitterVault.address.toString(),
);
console.log(
  `Splitter vault WETH balance: ${formatUnits(wethBalance, 18)} WETH`,
);

const wmasBalance = await wmasTokenContract.balanceOf(
  firstSplitterVault.address.toString(),
);
console.log(`Splitter vault WMAS balance: ${formatUnits(wmasBalance, 9)} WMAS`);

const btcBalance = await btcTokenContract.balanceOf(
  firstSplitterVault.address.toString(),
);
console.log(
  `Splitter vault BTC-WMAS balance: ${formatUnits(btcBalance, 8)} BTC-WMAS`,
);
