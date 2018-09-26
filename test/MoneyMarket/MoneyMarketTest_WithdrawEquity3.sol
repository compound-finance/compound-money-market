pragma solidity ^0.4.24;

import "truffle/Assert.sol";
import "./MoneyMarketTest.sol";

/**
  * @dev This tests the money market with tests for _withdrawEquity part 3.
  */
contract MoneyMarketTest_WithdrawEquity3 is MoneyMarketTest {

    function testWithdrawEquity_SuccessPartialEquity() public {
        address asset = address(this);
        address protocol = address(this);
        balances[protocol] = 10000;

        admin = msg.sender;
        uint initialAdminBalance = balances[admin];

        markets[asset].totalSupply = 2000;
        markets[asset].totalBorrows = 1000;

        // equity = 10000 - (2000 + 1000) = 7000
        // we attempt to withdraw 2500, which should be allowed
        assertNoError(Error(_withdrawEquity(asset, 2500)));

        Assert.equal(7500, balances[protocol], "cash should now be reduced to 7500");
        Assert.equal(2000, markets[asset].totalSupply, "totalSupply should be unchanged");
        Assert.equal(1000, markets[asset].totalBorrows, "totalBorrows should be unchanged");

        Assert.equal(initialAdminBalance + 2500, balances[admin], "admin should now have the equity that was withdrawn");
    }

    function testWithdrawEquity_SuccessZeroEquity() public {
        address asset = address(this);
        address protocol = address(this);
        balances[protocol] = 10000;

        admin = msg.sender;
        uint initialAdminBalance = balances[admin];

        markets[asset].totalSupply = 2000;
        markets[asset].totalBorrows = 1000;

        // we attempt to withdraw 0, which should be allowed
        assertNoError(Error(_withdrawEquity(asset, 0)));

        Assert.equal(10000, balances[protocol], "cash should be unchanged");
        Assert.equal(2000, markets[asset].totalSupply, "totalSupply should be unchanged");
        Assert.equal(1000, markets[asset].totalBorrows, "totalBorrows should be unchanged");

        Assert.equal(initialAdminBalance, balances[admin], "admin should still have no token balance");
    }
}