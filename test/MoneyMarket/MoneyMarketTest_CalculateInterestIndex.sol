pragma solidity ^0.4.24;

import "truffle/Assert.sol";
import "./MoneyMarketTest.sol";

/*
 * @dev This tests the money market with tests for calculateInterestIndex.
 */
contract MoneyMarketTest_CalculateInterestIndex is MoneyMarketTest {

    function testCalculateInterestIndex_SimpleCalculation() public {
        uint startingInterestIndex = 10**18;

        (Error err0, Exp memory interestRate) = getExp(5, 100); // 5% or 0.05
        assertNoError(err0);
        Assert.equal(scientific(5, 16), interestRate.mantissa, "should have correct rate of 5%, which is 5e16e-18");

        uint blockStart = 100;
        uint blockEnd = 110;

        (Error err1, uint newInterestIndex) = calculateInterestIndex(startingInterestIndex, interestRate.mantissa, blockStart, blockEnd);
        assertNoError(err1);

        Assert.equal(scientific(15, 17), newInterestIndex, "should have correct index");
    }

    function testCalculateInterestIndex_MoreComplicatedCalculation() public {
        uint startingInterestIndex = 111111111111111111;

        (Error err0, Exp memory interestRate) = getExp(5, 10000000); // 0.00005% or 0.0000005
        assertNoError(err0);
        Assert.equal(scientific(5, 11), interestRate.mantissa, "should have correct rate of 0.00005%, which is 5e11e-18");

        uint blockStart = 100;
        uint blockEnd = 110;

        (Error err1, uint newInterestIndex) = calculateInterestIndex(startingInterestIndex, interestRate.mantissa, blockStart, blockEnd);
        assertNoError(err1);

        // This is `111111111111111111 * (1 + 10 * 0.0000005) with discrete math`
        Assert.equal(111111666666666666, newInterestIndex, "should have correct index");
    }

    function testCalculateInterestIndex_AnotherComplicatedCalculation() public {
        uint startingInterestIndex = 222222222222222222;

        (Error err0, Exp memory interestRate) = getExp(1, 100); // 1% or 0.01
        assertNoError(err0);
        Assert.equal(scientific(1, 16), interestRate.mantissa, "should have correct rate of 1%, which is 1e16e-18");

        uint blockStart = 1;
        uint blockEnd = 10000; // 9999 blocks

        (Error err1, uint newInterestIndex) = calculateInterestIndex(startingInterestIndex, interestRate.mantissa, blockStart, blockEnd);
        assertNoError(err1);

        // This is `222222222222222222 * (1 + 9999 * 0.01) with discrete math`
        Assert.equal(22442222222222222199, newInterestIndex, "should have correct index");
    }

    function testCalculateInterestIndex_SmallInterest() public {
        uint startingInterestIndex = 10**18;

        (Error err0, Exp memory interestRate) = getExp(1, 21024000); // 10% (0.1) annual interest / 2102400 blocks per year
        assertNoError(err0);

        uint blockStart = 1;
        uint blockEnd = 11; // 10 blocks

        (Error err1, uint newInterestIndex) = calculateInterestIndex(startingInterestIndex, interestRate.mantissa, blockStart, blockEnd);
        assertNoError(err1);

        // This is `1000000000000000000 * (1 + 10 * 1/21024000) with discrete math`
        Assert.equal(1000000475646879750, newInterestIndex, "should have correct index");
    }


}