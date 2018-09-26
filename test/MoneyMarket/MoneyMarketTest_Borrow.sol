pragma solidity ^0.4.24;

import "truffle/Assert.sol";
import "./MoneyMarketTest.sol";

/*
 * @dev This tests the money market with tests for borrow.
 */
contract MoneyMarketTest_Borrow is MoneyMarketTest {

    function testBorrow_MarketSupported() public {
        address token = address(this); // must be this

        uint err = borrow(token, 10);
        Assert.equal(uint(Error.MARKET_NOT_SUPPORTED), err, "should have returned Error.MARKET_NOT_SUPPORTED");
    }

}