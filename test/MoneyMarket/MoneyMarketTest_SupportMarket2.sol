pragma solidity ^0.4.24;

import "truffle/Assert.sol";
import "./MoneyMarketWithPriceTest.sol";

/*
 * @dev This tests the money market with tests for supportMarket part 2.
 */
contract MoneyMarketTest_SupportMarket2 is MoneyMarketWithPriceTest {

    function testSupportMarket_NotAdmin() public {
        clearCollateralMarkets();

        address asset = nextAddress();
        admin = address(0);

        assertError(Error.UNAUTHORIZED, Error(_supportMarket(asset, InterestRateModel(asset))), "requires admin rights");

        Assert.equal(markets[asset].isSupported, false, "market stays unsupported");
    }

    function testSupportMarket_SucceedsWithBadInterestRateModelValue() public {
        clearCollateralMarkets();

        // This test is mostly to prove we haven't yet dealt with bad values, or may never
        address asset = nextAddress();

        admin = msg.sender;
        assertNoError(Error(_setAssetPrice(asset, 500)));

        assertNoError(Error(_supportMarket(asset, InterestRateModel(address(0)))));

        Assert.equal(markets[asset].isSupported, true, "market should now be supported");
        Assert.equal(markets[asset].interestRateModel, address(0), "market has interest rate model set");
    }

    function clearCollateralMarkets() internal {
        collateralMarkets = new address[](0); // clear collateral markets
    }
}