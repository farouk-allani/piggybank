import { Account, Web3Provider } from '@massalabs/massa-web3';
import * as dotenv from 'dotenv';

dotenv.config();

const account = await Account.fromEnv('PRIVATE_KEY');
const provider = Web3Provider.buildnet(account);

const client = provider.client;

// const defCallInfo = await client.deferredCallsInfo(['D1gcTPoAk847iDaqy4d3JVmmoPQ7yNPRHMjMvZocmLxiTfjL4z1H67RRDacR3rG5FyHqH']);

// console.log('Deferred Calls Info:', defCallInfo);

const events = await provider.getEvents({
  // callerAddress: account.address.toString(),
  smartContractAddress: 'AS18yCibaFYQbRsCYAB7VqKsusDoBNxQ3222UFGvEodnVWPjsjEE',
  // callerAddress: 'AS123VRQFat2EqNC1mhq56HDnJcjgkT9gEjfw766ageHLGviDsjab',
});

for (const event of events) {
  console.log('Event message:', event.data);
}

console.log('Done Evenst');
