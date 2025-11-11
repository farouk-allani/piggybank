import { Address, call } from '@massalabs/massa-as-sdk';
import { Args } from '@massalabs/as-types';
import { TokenWithPercentage } from '../structs/token';
import { u256 } from 'as-bignum/assembly';

export class IMultiSigVault {
  _origin: Address;

  constructor(origin: Address) {
    this._origin = origin;
  }

  init(
    signers: string[],
    threshold: u8,
    tokensWithPercentage: TokenWithPercentage[],
    vaultName: string,
    eaglefiRouterAddress: string,
    coins: u64 = 0,
  ): void {
    const args = new Args();

    args.add(signers);
    args.add(threshold);
    args.addSerializableObjectArray(tokensWithPercentage);
    args.add(vaultName);
    args.add(eaglefiRouterAddress);

    call(this._origin, 'constructor', args, coins);
  }

  deposit(amount: u256, coinsToUse: u64, deadline: u64, coins: u64 = 0): void {
    const args = new Args();

    args.add(amount);
    args.add(coinsToUse);
    args.add(deadline);

    call(this._origin, 'deposit', args, coins);
  }

  proposeWithdrawal(
    token: Address,
    amount: u256,
    recipient: Address,
    coins: u64 = 0,
  ): void {
    const args = new Args();

    args.add(token);
    args.add(amount);
    args.add(recipient);

    call(this._origin, 'proposeWithdrawal', args, coins);
  }

  approveProposal(proposalId: u32, coins: u64 = 0): void {
    const args = new Args();

    args.add(proposalId);

    call(this._origin, 'approveProposal', args, coins);
  }
}

