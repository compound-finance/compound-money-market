pragma solidity ^0.4.24;

import "truffle/Assert.sol";
import "./MoneyMarketWithPriceTest.sol";

/*
 * @dev This tests the money market with tests for oracle activities, part 2
 */
contract MoneyMarketTest_Oracle2 is MoneyMarketWithPriceTest {

    // Here we are letting the MoneyMarket be its own oracle.
    function testFetchAssetPrice_Oracle() public {
        oracle = address(this);
        address asset1 = nextAddress();
        address asset2 = nextAddress();

        assetPrices[asset1].mantissa = 5;
        assetPrices[asset2].mantissa = 10;

        (Error err1, Exp memory price1) = fetchAssetPrice(asset1);
        Assert.equal(0, uint(err1), "err1");

        (Error err2, Exp memory price2) = fetchAssetPrice(asset2);
        Assert.equal(0, uint(err2), "err2");

        Assert.equal(5, price1.mantissa, "price1 mantissa");
        Assert.equal(10, price2.mantissa, "price2 mantissa");
    }
}