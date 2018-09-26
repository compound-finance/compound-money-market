pragma solidity ^0.4.24;

import "truffle/Assert.sol";
import "./MoneyMarketTest.sol";

/**
  * @dev This tests the money market with tests for _withdrawEquity part 2.
  */
contract MoneyMarketTest_WithdrawEquity2 is MoneyMarketTest {

    function testWithdrawEquity_SuccessAllEquity() public {
        address asset = address(this);
        address protocol = address(this);
        balances[protocol] = 10000;

        admin = msg.sender;
        uint initialAdminBalance = balances[admin];

        markets[asset].totalSupply = 2000;
        markets[asset].totalBorrows = 1000;

        // equity = 10000 - (2000 + 1000) = 7000
        // we attempt to withdraw all 7000, which should be allowed
        assertNoError(Error(_withdrawEquity(asset, 7000)));

        Assert.equal(3000, balances[protocol], "cash should now be reduced to 3000");
        Assert.equal(2000, markets[asset].totalSupply, "totalSupply should be unchanged");
        Assert.equal(1000, markets[asset].totalBorrows, "totalBorrows should be unchanged");

        Assert.equal(initialAdminBalance + 7000, balances[admin], "admin should now have the equity");
    }
}