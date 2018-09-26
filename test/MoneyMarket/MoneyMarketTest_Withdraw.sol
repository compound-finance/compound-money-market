pragma solidity ^0.4.24;

import "truffle/Assert.sol";
import "./MoneyMarketTest.sol";


/*
 * @dev This tests the withdraw function of the money market.
 */
contract MoneyMarketTest_Withdraw is MoneyMarketTest {

    function testBasicValidations() public {
        address token = address(this);

        uint err = withdraw(token, 10);
        Assert.equal(uint(Error.TOKEN_INSUFFICIENT_CASH), err, "should have returned Error.TOKEN_INSUFFICIENT_CASH");
    }
}