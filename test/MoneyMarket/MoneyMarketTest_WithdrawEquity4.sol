pragma solidity ^0.4.24;

import "truffle/Assert.sol";
import "./MoneyMarketTest.sol";

/**
  * @dev This tests the money market with tests for _withdrawEquity part 4.
  */
contract MoneyMarketTest_WithdrawEquity4 is MoneyMarketTest {

    function testWithdrawEquity_OverflowCashPlusBorrows() public {
        address asset = address(this);
        address protocol = address(this);
        balances[protocol] = 10000;

        admin = msg.sender;
        Assert.equal(0, balances[admin], "setup failed; admin should have no token balance");

        markets[asset].totalSupply = 10;
        markets[asset].totalBorrows = (2**256) - 1;

        assertError(Error.INTEGER_OVERFLOW, Error(_withdrawEquity(asset, 1)), "cash + borrows should have caused overflow");

        Assert.equal(10000, balances[protocol], "cash should be unchanged");
        Assert.equal(10, markets[asset].totalSupply, "totalSupply should be unchanged");
        Assert.equal((2**256) - 1, markets[asset].totalBorrows, "totalBorrows should be unchanged");

        Assert.equal(0, balances[admin], "admin should have no token balance");
    }

    function testWithdrawEquity_UnderflowEquity() public {
        address asset = address(this);
        address protocol = address(this);
        balances[protocol] = 10000;

        admin = msg.sender;
        Assert.equal(0, balances[admin], "setup failed; admin should have no token balance");

        markets[asset].totalSupply = (2**256) - 2;
        markets[asset].totalBorrows = 1;

        assertError(Error.INTEGER_UNDERFLOW, Error(_withdrawEquity(asset, 1)), "cash + borrows - supply should have caused underflow");

        Assert.equal(10000, balances[protocol], "cash should be unchanged");
        Assert.equal((2**256) - 2, markets[asset].totalSupply, "totalSupply should be unchanged");
        Assert.equal(1, markets[asset].totalBorrows, "totalBorrows should be unchanged");

        Assert.equal(0, balances[admin], "admin should have no token balance");
    }
}