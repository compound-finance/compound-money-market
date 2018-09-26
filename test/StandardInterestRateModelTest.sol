pragma solidity ^0.4.24;

import "truffle/Assert.sol";
import "./AssertHelpers.sol";
import "./MathHelpers.sol";
import "../contracts/StandardInterestRateModel.sol";

contract StandardInterestRateModelTest is StandardInterestRateModel {

    // Supply rate = (1 - 0.1) * Ua * ( 5% + (45% * Ua) )
    // C.f. Elixir:
    /*
        getSupplyRate = fn (cash, borrows) ->
            ua = div(trunc(1.0e18) * trunc(borrows),(trunc(cash)+trunc(borrows)));
            ua_scaled = ua * 9000;
            borrowRate = trunc(5.0e16) + div(45*ua,100);

            borrowTimesUa = div(borrowRate * ua_scaled, trunc(1.0e18));

            div(borrowTimesUa, 10000 * 2102400);
        end
    */
    function testGetSupplyRate() public {
        (uint err0, uint rate0) = getSupplyRate(address(this), 500, 100);
        Assert.equal(0, err0, "should be successful");
        Assert.equal(8918378995, rate0, "supply rate for 500/100"); // getSupplyRate.(500, 100)

        (uint err1, uint rate1) = getSupplyRate(address(this), 3 * 10**18, 5 * 10**18);
        Assert.equal(0, err1, "should be successful");
        Assert.equal(88626391267, rate1, "borrow rate for 3e18/5e18"); // getSupplyRate.(3.0e18, 5.0e18)

        // TODO: Handle zero/zero case
        (uint err2, uint rate2) = getSupplyRate(address(this), 0, 0);
        Assert.equal(0, err2, "should be successful");
        Assert.equal(0, rate2, "borrow rate for 0/0");
    }

    function testGetSupplyRate_FAILED_TO_ADD_CASH_PLUS_BORROWS() public {
        (uint err, uint rate) = getSupplyRate(address(this), uint(-1), uint(-1));
        Assert.equal(uint(IRError.FAILED_TO_ADD_CASH_PLUS_BORROWS), err, "expected FAILED_TO_ADD_CASH_PLUS_BORROWS");
        Assert.equal(0, rate, "error calculating");
    }

    function testGetSupplyRate_FAILED_TO_GET_EXP() public {
        (uint err, uint rate) = getSupplyRate(address(this), 0, uint(-1));
        Assert.equal(uint(IRError.FAILED_TO_GET_EXP), err, "expected FAILED_TO_GET_EXP");
        Assert.equal(0, rate, "error calculating");
    }

    // Borrow rate = 5% + (45% * Ua)
    // C.f. Elixir:
    /*
        getBorrowRate = fn (cash, borrows) ->
            ua = div(trunc(1.0e18) * trunc(borrows),(trunc(cash)+trunc(borrows)));
            div(trunc(5.0e16) + div(45*ua,100), 2102400)
        end
    */
    function testGetBorrowRate() public {
        (uint err0, uint rate0) = getBorrowRate(address(this), 500, 100);
        Assert.equal(0, err0, "should be successful");
        Assert.equal(59455859969, rate0, "borrow rate for 500/100"); // getBorrowRate.(500, 100)

        (uint err1, uint rate1) = getBorrowRate(address(this), 3 * 10**18, 5 * 10**18);
        Assert.equal(0, err1, "should be successful");
        Assert.equal(157558028919, rate1, "borrow rate for 3e18/5e18"); // getBorrowRate.(3.0e18, 5.0e18)
    }

    function testGetBorrowRate_FAILED_TO_ADD_CASH_PLUS_BORROWS() public {
        (uint err, uint rate) = getBorrowRate(address(this), uint(-1), uint(-1));
        Assert.equal(uint(IRError.FAILED_TO_ADD_CASH_PLUS_BORROWS), err, "expected FAILED_TO_ADD_CASH_PLUS_BORROWS");
        Assert.equal(0, rate, "error calculating");
    }

    function testGetBorrowRate_FAILED_TO_GET_EXP() public {
        (uint err, uint rate) = getBorrowRate(address(this), 0, uint(-1));
        Assert.equal(uint(IRError.FAILED_TO_GET_EXP), err, "expected FAILED_TO_GET_EXP");
        Assert.equal(0, rate, "error calculating");
    }


}
