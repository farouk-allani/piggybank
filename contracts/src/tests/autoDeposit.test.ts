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
import {
  USDC_DECIMALS,
  USDC_TOKEN_ADDRESS,
  WETH_TOKEN_ADDRESS,
} from '../calls/const';
import {
  createSplitterVault,
  deployFactory,
  getUserSplitterVaults,
} from '../calls/factory';
import { depositToSplitterVault, enableAutoDeposit } from '../calls/splitter';
import { increaseTokenAllowance } from '../calls/token';

dotenv.config();

const account = await Account.fromEnv();
const provider = JsonRpcProvider.buildnet(account);

const factoryContract = await deployFactory(provider);

const usdcTokenPercentage = new TokenWithPercentage(USDC_TOKEN_ADDRESS, 20n);
const wethTokenPercentage = new TokenWithPercentage(WETH_TOKEN_ADDRESS, 50n);
const wmasTokenPercentage = new TokenWithPercentage(BUILDNET_TOKENS.WMAS, 30n);
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

// Increase allowance for USDC for the vault to pull funds
await increaseTokenAllowance(
  usdcTokenContract,
  firstSplitterVault.address,
  '2',
);


const usdcUserBalanceBefore = await usdcTokenContract.balanceOf(
  provider.address,
);
const vaultUsdcBalanceBefore = await usdcTokenContract.balanceOf(
  firstSplitterVault.address,
);

console.log(
  `USDC Balance Before Enable - User: ${formatUnits(
    usdcUserBalanceBefore,
    USDC_DECIMALS,
  )}, Vault: ${formatUnits(vaultUsdcBalanceBefore, USDC_DECIMALS)}`,
);

// Enable Auto Deposit for USDC
await enableAutoDeposit(
  firstSplitterVault,
  '0.1',
  account.address.toString(),
  64,
);

const usdcUserBalanceAfter = await usdcTokenContract.balanceOf(
  provider.address,
);
const vaultUsdcBalanceAfter = await usdcTokenContract.balanceOf(
  firstSplitterVault.address,
);

console.log(
  `USDC Balance After Enable - User: ${formatUnits(
    usdcUserBalanceAfter,
    USDC_DECIMALS,
  )}, Vault: ${formatUnits(vaultUsdcBalanceAfter, USDC_DECIMALS)}`,
);
