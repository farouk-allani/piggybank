import { Args, stringToBytes } from '@massalabs/as-types';
import { Address, call, Storage } from '@massalabs/massa-as-sdk';
import { IMRC20 } from './IMRC20';
import { PairInformation } from '../structs/dusa/PairInfo';
import { FeeParameters } from '../structs/dusa/FeeParameters';

/// @dev The fee parameters that are used to calculate fees
export const FEES_PARAMETERS = stringToBytes('FEES_PARAMETERS');
/// @notice The token that is used as the base currency for the pair
export const TOKEN_X = 'TOKEN_X';
/// @notice The token that is used as the quote currency for the pair
export const TOKEN_Y = 'TOKEN_Y';

export class IDusaPair {
  _origin: Address;

  /**
   * Wraps a smart contract exposing standard token FFI.
   *
   * @param {Address} at - Address of the smart contract.
   */
  constructor(at: Address) {
    this._origin = at;
  }

  getTokenX(): IMRC20 {
    return new IMRC20(new Address(Storage.getOf(this._origin, TOKEN_X)));
  }

  getTokenY(): IMRC20 {
    return new IMRC20(new Address(Storage.getOf(this._origin, TOKEN_Y)));
  }

  getPairInformation(): PairInformation {
    const res = call(this._origin, 'getPairInformation', new Args(), 0);
    return new Args(res).nextSerializable<PairInformation>().unwrap();
  }

  /**
   * Get the fees parameters for this pair
   *
   */
  feeParameters(): FeeParameters {
    const bs = Storage.getOf(this._origin, FEES_PARAMETERS);
    return new Args(bs).nextSerializable<FeeParameters>().unwrap();
  }
}
