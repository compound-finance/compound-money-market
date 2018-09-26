pragma solidity ^0.4.24;

import "../../contracts/InterestRateModel.sol";

/**
  * @title An Interest Rate Model for tests that can be instructed to return a failure instead of doing a calculation
  * @author Compound
  */
contract FailableInterestRateModel is InterestRateModel {

    bool public failSupplyRate;

    bool public failBorrowRate;

    uint constant public opaqueSupplyFailureCode = 10;
    uint constant public opaqueBorrowFailureCode = 20;


    constructor(bool _failSupplyRate, bool _failBorrowRate) public {
        failSupplyRate = _failSupplyRate;
        failBorrowRate = _failBorrowRate;
    }

    /**
      * @notice if failSupplyRate is true, returns (opaqueSupplyFailureCode, 0) (so it can be distinguished from a failing call to getBorrowRate)
      *         else returns 10% per block
      */
    function getSupplyRate(address _asset, uint _cash, uint _borrows) public view returns (uint, uint) {
        uint(_asset) + _cash + _borrows; // pragma ignore unused variables?

        if (failSupplyRate) {
            return (opaqueSupplyFailureCode, 0);
        }
        return (0, 1 * 10 ** 17);
    }

    /**
      * @notice if failBorrowRate is true, returns (opaqueBorrowFailureCode, 0) (so it can be distinguished from a failing call to getSupplyRate)
      *         else returns 50% per block
      */
    function getBorrowRate(address _asset, uint _cash, uint _borrows) view public returns (uint, uint) {
        uint(_asset) + _cash + _borrows; // pragma ignore unused variables?

        if (failBorrowRate) {
            return (opaqueBorrowFailureCode, 0);
        }
        return (0, 5 * 10 ** 17);
    }

}