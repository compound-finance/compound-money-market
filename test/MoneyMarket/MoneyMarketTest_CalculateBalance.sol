pragma solidity ^0.4.24;

import "truffle/Assert.sol";
import "./MoneyMarketTest.sol";

/*
 * @dev This tests the money market with tests for calculateBalance.
 */
contract MoneyMarketTest_CalculateBalance is MoneyMarketTest {

    function testCalculateBalance() public {
        Error err;
        uint balance;

        // Simple test
        (err, balance) = calculateBalance(11, 2, 6);
        assertNoError(err);
        Assert.equal(33, balance, "11 * 6 / 2");

        // Test on more realistic numbers
        (err, balance) = calculateBalance(10**20, 10**18, 2 * 10**18);
        assertNoError(err);
        Assert.equal(2 * (10**20), balance, "10**20 * (2 * 10**18) / 10**18");

        // Test truncation
        (err, balance) = calculateBalance(1111, 3, 10);
        assertNoError(err);
        Assert.equal(3703, balance, "1111 * 10 / 3");

        // Test unnecessary overflow
        (err, balance) = calculateBalance(10**76, 100, 100);
        assertError(Error.INTEGER_OVERFLOW, err, "overflows on mul step");
        Assert.equal(0, balance, "nil when overflow");

        // Test division by zero
        (err, balance) = calculateBalance(10, 0, 100);
        assertError(Error.DIVISION_BY_ZERO, err, "divides by zero");
        Assert.equal(0, balance, "nil when divide by zero");

        // Test user's first supply- both previous balance and index are 0
        (err, balance) = calculateBalance(0, 0, 10**18);
        assertNoError(err);
        Assert.equal(0, balance, "returns 0 if previous balance was zero and does not try to divide 0 by 0");

        // Test with small end of back of envelope estimates
        // Our interestIndexEnd of 10512937595120000000 corresponds to 1 block of 1% annual interest
        (err, balance) = calculateBalance(50 * 10**18, 10**18, 1000000004756468797);
        assertNoError(err);
        Assert.equal(50000000237823439850, balance, "(50 * 10**18 * 1000000004756468797) / 10**18");

        // Our interestIndexEnd of 10512937595120000000 corresponds to ~10 years of 100% interest
        (err, balance) = calculateBalance(10**30, 10**18, 10512937595120000000);
        assertNoError(err);
        Assert.equal(10512937595120000000000000000000, balance, "10**30 * (10512937595120000000) / 10**18");
    }

}