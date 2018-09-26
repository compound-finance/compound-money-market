pragma solidity ^0.4.24;

import "truffle/Assert.sol";
import "./MoneyMarketTest.sol";

/**
  * @dev This tests the money market with tests for _withdrawEquity.
  */
contract MoneyMarketTest_WithdrawEquity is MoneyMarketTest {

    function testWithdrawEquity_NotAdmin() public {
        address asset = address(this);
        balances[asset] = 10000;

        // Update admin to so admin check will fail
        admin = address(0);
        Assert.equal(0, balances[admin], "setup failed; admin should have no token balance");

        assertError(Error.UNAUTHORIZED, Error(_withdrawEquity(asset, 5000)), "requires admin rights");

        Assert.equal(10000, balances[asset], "cash should be unchanged");

        Assert.equal(0, balances[admin], "admin should have no token balance");
    }

    function testWithdrawEquity_AmountTooLargeCashOnly() public {
        address asset = address(this);
        address protocol = address(this);
        balances[protocol] = 10000;

        admin = msg.sender;
        Assert.equal(0, balances[admin], "setup failed; admin should have no token balance");

        assertError(Error.EQUITY_INSUFFICIENT_BALANCE, Error(_withdrawEquity(asset, 20000)), "large amount should have been rejected");

        Assert.equal(10000, balances[asset], "cash should be unchanged");

        Assert.equal(0, balances[admin], "admin should have no token balance");
    }

    function testWithdrawEquity_AmountTooLargeAfterSupplySubtractedFromCashPlusBorrows() public {
        address asset = address(this);
        address protocol = address(this);
        balances[protocol] = 10000;

        admin = msg.sender;
        Assert.equal(0, balances[admin], "setup failed; admin should have no token balance");

        markets[asset].totalSupply = 2000;
        markets[asset].totalBorrows = 1000;

        // we attempt to withdraw 9500 < cash balance of 10000, but equity is only 9000:
        // equity = 10000 + 1000 - 2000 = 9000
        assertError(Error.EQUITY_INSUFFICIENT_BALANCE, Error(_withdrawEquity(asset, 9500)), "large amount should have been rejected");

        Assert.equal(10000, balances[protocol], "cash should be unchanged");
        Assert.equal(2000, markets[asset].totalSupply, "totalSupply should be unchanged");
        Assert.equal(1000, markets[asset].totalBorrows, "totalBorrows should be unchanged");

        Assert.equal(0, balances[admin], "admin should have no token balance");
    }


}