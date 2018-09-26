pragma solidity ^0.4.24;

import "truffle/Assert.sol";
import "./MoneyMarketWithPriceTest.sol";

/*
 * @dev This tests the money market with tests for supportMarket.
 */
contract MoneyMarketTest_SupportMarket is MoneyMarketWithPriceTest {

    function testSupportMarket_Success() public {
        clearCollateralMarkets();

        address asset = nextAddress();
        address[] memory single = new address[](1);
        single[0] = asset;

        admin = msg.sender;

        validateMarket(asset, 0, false, 0, 0);
        assertNoError(Error(_setAssetPrice(asset, 500)));

        assertNoError(Error(_supportMarket(asset, InterestRateModel(asset))));

        validateMarket(asset, asset, true, 10 ** 18, 10 ** 18);
        Assert.equal(single, collateralMarkets, "should have just this asset");

        markets[asset].supplyIndex = 5;
        markets[asset].borrowIndex = 6;

        assertNoError(Error(_supportMarket(asset, InterestRateModel(asset))));

        validateMarket(asset, asset, true, 5, 6);
        Assert.equal(single, collateralMarkets, "should still have just this asset");
    }

    function validateMarket(address asset, address intRateModel, bool isSupported, uint supplyIndex, uint borrowIndex) internal {

        Assert.equal(markets[asset].isSupported, isSupported, "validateMarket: isSupported");
        Assert.equal(markets[asset].interestRateModel, intRateModel, "validateMarket: interestRateModel");
        Assert.equal(markets[asset].supplyIndex, supplyIndex, "validateMarket: supplyIndex");
        Assert.equal(markets[asset].borrowIndex, borrowIndex, "validateMarket: borrowIndex");
    }

    function clearCollateralMarkets() internal {
        collateralMarkets = new address[](0); // clear collateral markets
    }

}