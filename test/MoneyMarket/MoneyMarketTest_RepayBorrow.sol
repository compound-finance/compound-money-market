pragma solidity ^0.4.24;

import "truffle/Assert.sol";
import "./MoneyMarketTest.sol";

/*
 * @dev This tests the money market with tests for repayBorrow.
 */
contract MoneyMarketTest_RepayBorrow is MoneyMarketTest {

    function testRepayBorrow_basicValidations() public {
        address token = address(this); // must be this
        address protocol = address(this); // must be this

        // Set a borrow balance for the user
        markets[token].borrowIndex = 1;
        markets[token].borrowRateMantissa = 0;
        borrowBalances[msg.sender][token] = Balance({
            principal: 15,
            interestIndex: 1
        });

        // Repay too much
        uint err = repayBorrow(token, 16);
        Assert.equal(uint(Error.INTEGER_UNDERFLOW), err, "should have returned Error.INTEGER_UNDERFLOW");

        // Repay without approval
        err = repayBorrow(token, 10);
        Assert.equal(uint(Error.TOKEN_INSUFFICIENT_ALLOWANCE), err, "should have returned Error.TOKEN_INSUFFICIENT_ALLOWANCE");

        approve(protocol, 20); // allowed[customer][protocol] = 20; is not working. why not?

        // Repay without funds
        err = repayBorrow(token, 10);
        Assert.equal(uint(Error.TOKEN_INSUFFICIENT_BALANCE), err, "should have returned Error.TOKEN_INSUFFICIENT_BALANCE");
    }

}