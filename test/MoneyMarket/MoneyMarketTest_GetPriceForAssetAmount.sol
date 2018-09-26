pragma solidity ^0.4.24;

import "truffle/Assert.sol";
import "./MoneyMarketTest.sol";

contract MoneyMarketTest_GetPriceForAssetAmount is MoneyMarketTest {

    // Note: other scenarios for getPriceForAssetAmount are tested via functions that use it; this test is to ensure line coverage
    function testHandlesUnsetPriceOracle() public {
        oracle = address(0);
        address asset = nextAddress();

        (Error err, Exp memory result) = getPriceForAssetAmount(asset, 90);
        assertError(Error.ZERO_ORACLE_ADDRESS, err, "should have failed from unset oracle");
        Assert.equal(0, result.mantissa, "result.mantissa");
    }
}