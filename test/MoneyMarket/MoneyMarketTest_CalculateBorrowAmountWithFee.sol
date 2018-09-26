pragma solidity ^0.4.24;

import "truffle/Assert.sol";
import "./MoneyMarketTest.sol";

/*
 * @dev This tests the money market with tests for calculateBorrowAmountWithFee.
 */
contract MoneyMarketTest_CalculateBorrowAmountWithFee is MoneyMarketTest {

    function testCalculateBorrowAmountWithFee() public {
        Error err;
        uint fee;

        (err, originationFee) = getExp(5, 1);
        assertNoError(err);
        (err, fee) = calculateBorrowAmountWithFee(6 wei);
        assertNoError(err);
        Assert.equal(36 wei, fee, "500% * 6 wei + 6 wei");

        (err, originationFee) = getExp(0, 1);
        assertNoError(err);
        (err, fee) = calculateBorrowAmountWithFee(6 wei);
        assertNoError(err);
        Assert.equal(6 wei, fee, "0% * 6 wei + 6 wei");

        (err, originationFee) = getExp(5, 1);
        assertNoError(err);
        (err, fee) = calculateBorrowAmountWithFee(0 wei);
        assertNoError(err);
        Assert.equal(0 wei, fee, "500% * 0 wei + 0 wei");

        (err, originationFee) = getExp(1, 1);
        assertNoError(err);
        (err, fee) = calculateBorrowAmountWithFee(1 ether);
        assertNoError(err);
        Assert.equal(2 ether, fee, "100% * 1 ether + 1 ether");

        (err, originationFee) = getExp(5, 1000);
        assertNoError(err);
        (err, fee) = calculateBorrowAmountWithFee(6 ether);
        assertNoError(err);
        Assert.equal(6.03 ether, fee, "0.5% * 6 Eth + 6 ether");

        (err, originationFee) = getExp(5, 10000);
        assertNoError(err);
        (err, fee) = calculateBorrowAmountWithFee(6000 ether);
        assertNoError(err);
        Assert.equal(6003 ether, fee, "0.05% * 6000 Eth + 6000 ether");

        (err, originationFee) = getExp(1, 1);
        assertNoError(err);
        (err, fee) = calculateBorrowAmountWithFee(10**75);
        assertError(Error.INTEGER_OVERFLOW, err, "overflows exp multiplication");
        Assert.equal(0, fee, "0 due to overflow");

        originationFee = Exp({mantissa: uint(-1)});
        (err, fee) = calculateBorrowAmountWithFee(0);
        assertError(Error.INTEGER_OVERFLOW, err, "overflows exp plus 1");
        Assert.equal(0, fee, "0 due to overflow");
    }

}