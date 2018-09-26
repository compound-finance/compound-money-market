pragma solidity ^0.4.24;

import "./FixedInterestRateModel.sol";

/**
  * @title A Fixed Interest Rate Model with default rates for testing
  * @author Compound
  * @notice Defaults supply rates as 10% per block and borrow at 50% per block for testing
  */
contract SimpleInterestRateModel is FixedInterestRateModel {

    constructor() FixedInterestRateModel(1 * 10 ** 17, 5 * 10 ** 17) public {
        // Empty constructor
    }
}