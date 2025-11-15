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
import { deployLiqManager } from './calls/liqManager';

const account = await Account.fromEnv();
const provider = JsonRpcProvider.buildnet(account);

await deployLiqManager(provider);
