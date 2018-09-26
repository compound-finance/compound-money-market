pragma solidity ^0.4.24;

import "truffle/Assert.sol";
import "../MoneyMarketLightHarness.sol";
import "../AddressGenerator.sol";
import "../AssertHelpers.sol";
import "../MathHelpers.sol";
import "../EIP20Harness.sol";

/*
 * @dev This continues to test the money market, whose previous tests are full due to gas limits.
 */
contract MoneyMarketWithPriceTest is MoneyMarketLightHarness, MathHelpers, AssertHelpers, EIP20Harness, AddressGenerator {

    constructor() EIP20Harness(0, "mmtestb", 18, "mmtestb") public {}

}