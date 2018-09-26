pragma solidity ^0.4.24;

import "truffle/Assert.sol";
import "./MoneyMarketTest.sol";

/*
 * @dev This tests the money market with tests for addCollateralMarket.
 */
contract MoneyMarketTest_AddCollateralMarket is MoneyMarketTest {

    function testAddCollateralMarket() public {
        address addr1 = nextAddress();
        address addr2 = nextAddress();
        address[] memory empty;
        address[] memory single = new address[](1);
        single[0] = addr1;
        address[] memory both = new address[](2);
        both[0] = addr1;
        both[1] = addr2;

        Assert.equal(empty, collateralMarkets, "should have no markets");

        addCollateralMarket(addr1);
        Assert.equal(getCollateralMarketsLength(), 1, "should have first market");
        Assert.equal(single, collateralMarkets, "should have just the one market");

        addCollateralMarket(addr1);
        Assert.equal(getCollateralMarketsLength(), 1, "should still have first market");
        Assert.equal(single, collateralMarkets, "should have just the one market, still");

        addCollateralMarket(addr2);
        Assert.equal(getCollateralMarketsLength(), 2, "should have first two markets");
        Assert.equal(both, collateralMarkets, "should have both markets");
    }

}