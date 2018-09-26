pragma solidity ^0.4.24;

import "truffle/Assert.sol";
import "./MoneyMarketWithPriceTest.sol";

contract MoneyMarketTest_GetAssetAmountForValue is MoneyMarketWithPriceTest {

    /**
     * @dev helper that lets us create an Exp with `getExp` without cluttering our test code with error checks of the setup.
     */
    function getExpFromRational(uint numerator, uint denominator) internal returns (Exp memory) {
        (Error err, Exp memory result) = getExp(numerator, denominator);

        Assert.equal(0, uint(err), "getExpFromRational failed");
        return result;
    }

    function testGetAssetAmountForValue_ZeroCases() public {

        Error err;
        uint amount;

        //////////
        // test no price
        address asset = nextAddress();
        (err, amount) = getAssetAmountForValue(asset, getExpFromRational(100, 1)); // 100 eth worth

        Assert.equal(uint(Error.DIVISION_BY_ZERO), uint(err), "should have returned Error.DIVISION_BY_ZERO");
        Assert.equal(0, amount, "should have returned amount 0");

        //////////
        // Test 0 eth worth
        asset = nextAddress();
        assetPrices[asset] = getExpFromRational(1, 5); // 0.2 eth per item
        (err, amount) = getAssetAmountForValue(asset, getExpFromRational(0, 1)); // 0 eth worth
        assertNoError(err);
        Assert.equal(0, amount, "should have returned amount 0");

    }

    function testGetAssetAmountForValue_NormalCases() public {

        Error err;
        uint amount;

        //////////
        // Test truncated rational result, price > 1
        address asset = nextAddress();
        assetPrices[asset] = getExpFromRational(5333, 1000); // 5.333;

        (err, amount) = getAssetAmountForValue(asset, getExpFromRational(1070, 1)); // 1070 eth worth
        assertNoError(err);
        // 1070 / 5.333 = 200.63753984624039, truncated to 200.
        Assert.equal(200, amount, "should have returned amount 200");

        //////////
        // Test truncated rational result, price < 1
        asset = nextAddress();
        assetPrices[asset] = getExpFromRational(45734, 10000000); // 0.0045734
        (err, amount) = getAssetAmountForValue(asset, getExpFromRational(1070, 1)); // 1070 eth worth
        assertNoError(err);
        // 1070 / 0.0045734 = 233961.604058249879739, truncated to 233961
        Assert.equal(233961, amount, "should have returned amount 233961");
    }

    function testHandlesUnsetPriceOracle() public {
        oracle = address(0);
        // MoneyMarketWithPriceTest uses its own price map unless instructed to use the MoneyMarket's function
        useOracle = true;
        address asset = nextAddress();

        (Error err, uint result) = getAssetAmountForValue(asset, getExpFromRational(1070, 1));
        assertError(Error.ZERO_ORACLE_ADDRESS, err, "should have failed from unset oracle");
        Assert.equal(0, result, "result");
    }
}