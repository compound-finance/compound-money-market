pragma solidity ^0.4.24;

import "truffle/Assert.sol";
import "./AssertHelpers.sol";
import "./MathHelpers.sol";
import "../contracts/StableCoinInterestRateModel.sol";

contract StableCoinInterestRateModelTest is StableCoinInterestRateModel {

    // Supply rate = (1 - 0.15) * Ua * ( 10% + (30% * Ua) )
    // C.f. Elixir:
    /*
        getSupplyRate = fn (cash, borrows) ->
            ua = div(trunc(1.0e18) * trunc(borrows),(trunc(cash)+trunc(borrows)));
            ua_scaled = ua * 8500;
            borrowRate = trunc(1.0e17) + div(3*ua,10);

            borrowTimesUa = div(borrowRate * ua_scaled, trunc(1.0e18));

            standardRate = div(borrowTimesUa, 10000 * 2102400);
            div(standardRate, 2);
        end
    */
    function testGetSupplyRate() public {
        (uint err0, uint rate0) = getSupplyRate(address(this), 500, 100);
        Assert.equal(0, err0, "should be successful");
        Assert.equal(( 10107496194 / 2 ), rate0, "supply rate for 500/100"); // getSupplyRate.(500, 100)

        (uint err1, uint rate1) = getSupplyRate(address(this), 3 * 10**18, 5 * 10**18);
        Assert.equal(0, err1, "should be successful");
        Assert.equal(( 72647628900 / 2 ), rate1, "borrow rate for 3e18/5e18"); // getSupplyRate.(3.0e18, 5.0e18)

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

    // Borrow rate = 10% + (30% * Ua)
    // C.f. Elixir:
    /*
        getBorrowRate = fn (cash, borrows) ->
            ua = div(trunc(1.0e18) * trunc(borrows),(trunc(cash)+trunc(borrows)));
            standardRate = div(trunc(1.0e17) + div(3*ua,10), 2102400)
            div(standardRate, 2)
        end
    */
    function testGetBorrowRate() public {
        (uint err0, uint rate0) = getBorrowRate(address(this), 500, 100);
        uint expectedRate = ( uint(71347031963) / uint(2) );
        Assert.equal(0, err0, "should be successful");
        Assert.equal(expectedRate, rate0, "borrow rate for 500/100"); // getBorrowRate.(500, 100)

        uint expectedRate2 = ( uint(136748477929) / uint(2) );
        (uint err1, uint rate1) = getBorrowRate(address(this), 3 * 10**18, 5 * 10**18);
        Assert.equal(0, err1, "should be successful");
        Assert.equal(expectedRate2, rate1, "borrow rate for 3e18/5e18"); // getBorrowRate.(3.0e18, 5.0e18)
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
