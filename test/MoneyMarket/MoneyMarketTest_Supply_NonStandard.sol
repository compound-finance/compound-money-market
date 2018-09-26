pragma solidity ^0.4.24;

import "truffle/Assert.sol";
import "./MoneyMarketNonStandardTest.sol";

/*
 * @dev This tests the money market with tests for supply.
 */
contract MoneyMarketTest_Supply_NonStandard is MoneyMarketNonStandardTest {

    function testSupply_basicValidations() public {
        address token = address(this); // must be this
        address protocol = address(this); // must be this

        uint err = supply(token, 10);
        Assert.equal(uint(Error.MARKET_NOT_SUPPORTED), err, "should have returned Error.MARKET_NOT_SUPPORTED");

        markets[token].isSupported = true;

        err = supply(token, 10);
        Assert.equal(uint(Error.TOKEN_INSUFFICIENT_ALLOWANCE), err, "should have returned Error.TOKEN_INSUFFICIENT_ALLOWANCE");

        approve(protocol, 20); // allowed[customer][protocol] = 20; is not working. why not?
        err = supply(token, 10);
        Assert.equal(uint(Error.TOKEN_INSUFFICIENT_BALANCE), err, "should have returned Error.TOKEN_INSUFFICIENT_BALANCE");
    }

}