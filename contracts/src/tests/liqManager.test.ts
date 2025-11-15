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
import { addLiquidity, deployLiqManager } from '../calls/liqManager';

dotenv.config();

const account = await Account.fromEnv();
const provider = JsonRpcProvider.buildnet(account);

const liqManagerContract = await deployLiqManager(provider);

// Call addLiquidity
await addLiquidity(liqManagerContract, 10, '1', '1');
