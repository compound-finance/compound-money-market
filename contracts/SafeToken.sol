pragma solidity ^0.4.24;

import "./EIP20Interface.sol";
import "./EIP20NonStandardInterface.sol";
import "./ErrorReporter.sol";

/**
  * @title Safe Token
  * @author Compound
  * @notice This is a work in progress.
  */
contract SafeToken is ErrorReporter {

    /**
      * @dev Checks whether or not there is sufficient allowance for this contract to move amount from `from` and
      *      whether or not `from` has a balance of at least `amount`. Does NOT do a transfer.
      */
    function checkTransferIn(address asset, address from, uint amount) internal view returns (Error) {

        EIP20Interface token = EIP20Interface(asset);

        if (token.allowance(from, address(this)) < amount) {
            return Error.TOKEN_INSUFFICIENT_ALLOWANCE;
        }

        if (token.balanceOf(from) < amount) {
            return Error.TOKEN_INSUFFICIENT_BALANCE;
        }

        return Error.NO_ERROR;
    }

    /**
      * @dev Similar to EIP20 transfer, except it handles a False result from `transferFrom` and returns an explanatory
      *      error code rather than reverting.  If caller has not called `checkTransferIn`, this may revert due to
      *      insufficient balance or insufficient allowance. If caller has called `checkTransferIn` prior to this call,
      *      and it returned Error.NO_ERROR, this should not revert in normal conditions.
      *
      *      Note: This wrapper safely handles non-standard ERC-20 tokens that do not return a value.
      *            See here: https://medium.com/coinmonks/missing-return-value-bug-at-least-130-tokens-affected-d67bf08521ca
      */
    function doTransferIn(address asset, address from, uint amount) internal returns (Error) {
        EIP20NonStandardInterface token = EIP20NonStandardInterface(asset);

        bool result;

        token.transferFrom(from, address(this), amount);

        assembly {
            switch returndatasize()
                case 0 {                      // This is a non-standard ERC-20
                    result := not(0)          // set result to true
                }
                case 32 {                     // This is a complaint ERC-20
                    returndatacopy(0, 0, 32)
                    result := mload(0)        // Set `result = returndata` of external call
                }
                default {                     // This is an excessively non-compliant ERC-20, revert.
                    revert(0, 0)
                }
        }

        if (!result) {
            return Error.TOKEN_TRANSFER_FAILED;
        }

        return Error.NO_ERROR;
    }

    /**
      * @dev Checks balance of this contract in asset
      */
    function getCash(address asset) internal view returns (uint) {
        EIP20Interface token = EIP20Interface(asset);

        return token.balanceOf(address(this));
    }

    /**
      * @dev Checks balance of `from` in `asset`
      */
    function getBalanceOf(address asset, address from) internal view returns (uint) {
        EIP20Interface token = EIP20Interface(asset);

        return token.balanceOf(from);
    }

    /**
      * @dev Similar to EIP20 transfer, except it handles a False result from `transfer` and returns an explanatory
      *      error code rather than reverting. If caller has not called checked protocol's balance, this may revert due to
      *      insufficient cash held in this contract. If caller has checked protocol's balance prior to this call, and verified
      *      it is >= amount, this should not revert in normal conditions.
      *
      *      Note: This wrapper safely handles non-standard ERC-20 tokens that do not return a value.
      *            See here: https://medium.com/coinmonks/missing-return-value-bug-at-least-130-tokens-affected-d67bf08521ca
      */
    function doTransferOut(address asset, address to, uint amount) internal returns (Error) {
        EIP20NonStandardInterface token = EIP20NonStandardInterface(asset);

        bool result;

        token.transfer(to, amount);

        assembly {
            switch returndatasize()
                case 0 {                      // This is a non-standard ERC-20
                    result := not(0)          // set result to true
                }
                case 32 {                     // This is a complaint ERC-20
                    returndatacopy(0, 0, 32)
                    result := mload(0)        // Set `result = returndata` of external call
                }
                default {                     // This is an excessively non-compliant ERC-20, revert.
                    revert(0, 0)
                }
        }

        if (!result) {
            return Error.TOKEN_TRANSFER_OUT_FAILED;
        }

        return Error.NO_ERROR;
    }
}