pragma solidity ^0.4.24;

import "./Exponential.sol";
import "./ErrorReporter.sol";
import "./CarefulMath.sol";
import "./InterestRateModel.sol";

/**
  * @title The Compound Stable Coin Interest Rate Model
  * @author Compound
  * @notice See Section 2.4 of the Compound Whitepaper
  */
contract StableCoinInterestRateModel is Exponential {

    uint constant oneMinusSpreadBasisPoints = 8500;
    uint constant blocksPerYear = 2102400;

    enum IRError {
        NO_ERROR,
        FAILED_TO_ADD_CASH_PLUS_BORROWS,
        FAILED_TO_GET_EXP,
        FAILED_TO_MUL_PRODUCT_TIMES_BORROW_RATE
    }

    /*
     * @dev Calculates the utilization rate (borrows / (cash + borrows)) as an Exp
     */
    function getUtilizationRate(uint cash, uint borrows) pure internal returns (IRError, Exp memory) {
        if (borrows == 0) {
            // Utilization rate is zero when there's no borrows
            return (IRError.NO_ERROR, Exp({mantissa: 0}));
        }

        (Error err0, uint cashPlusBorrows) = add(cash, borrows);
        if (err0 != Error.NO_ERROR) {
            return (IRError.FAILED_TO_ADD_CASH_PLUS_BORROWS, Exp({mantissa: 0}));
        }

        (Error err1, Exp memory utilizationRate) = getExp(borrows, cashPlusBorrows);
        if (err1 != Error.NO_ERROR) {
            return (IRError.FAILED_TO_GET_EXP, Exp({mantissa: 0}));
        }

        return (IRError.NO_ERROR, utilizationRate);
    }

    /*
     * @dev Calculates the utilization and borrow rates for use by get{Supply,Borrow}Rate functions
     */
    function getUtilizationAndAnnualBorrowRate(uint cash, uint borrows) pure internal returns (IRError, Exp memory, Exp memory) {
        (IRError err0, Exp memory utilizationRate) = getUtilizationRate(cash, borrows);
        if (err0 != IRError.NO_ERROR) {
            return (err0, Exp({mantissa: 0}), Exp({mantissa: 0}));
        }

        // utilizationRate * 0.3 (30%), which is `rate * 3 / 10`
        (Error err1, Exp memory utilizationRateMuled) = mulScalar(utilizationRate, 3);
        // `mulScalar` only overflows when the product is >= 2^256.
        // utilizationRate is a real number on the interval [0,1], which means that
        // utilizationRate.mantissa is in the interval [0e18,1e18], which means that three times
        // that is in the interval [0e18,3e18]. That interval has no intersection with 2^256, and therefore
        // this can never overflow. As such, we assert.
        assert(err1 == Error.NO_ERROR);

        (Error err2, Exp memory utilizationRateScaled) = divScalar(utilizationRateMuled, 10);
        // 10 is a constant, and therefore cannot be zero, which is the only error case of divScalar.
        assert(err2 == Error.NO_ERROR);

        // Add the 10% for (10% + 30% * Ua)
        (Error err3, Exp memory annualBorrowRate) = addExp(utilizationRateScaled, Exp({mantissa: mantissaOneTenth}));
        // `addExp` only fails when the addition of mantissas overflow.
        // As per above, utilizationRateMuled is capped at 3e18 and when divided by 10,
        // utilizationRateScaled is capped at 3e17. mantissaOneTenth = 1e17, and thus the addition
        // is capped at 4e17, which is less than 2^256.
        assert(err3 == Error.NO_ERROR);

        return (IRError.NO_ERROR, utilizationRate, annualBorrowRate);
    }

    /**
      * @notice Gets the current supply interest rate based on the given asset, total cash and total borrows
      * @dev The return value should be scaled by 1e18, thus a return value of
      *      `(true, 1000000000000)` implies an interest rate of 0.000001 or 0.0001% *per block*.
      * @param _asset The asset to get the interest rate of
      * @param cash The total cash of the asset in the market
      * @param borrows The total borrows of the asset in the market
      * @return Success or failure and the supply interest rate per block scaled by 10e18
      */
    function getSupplyRate(address _asset, uint cash, uint borrows) public view returns (uint, uint) {
        _asset; // pragma ignore unused argument

        (IRError err0, Exp memory utilizationRate0, Exp memory annualBorrowRate) = getUtilizationAndAnnualBorrowRate(cash, borrows);
        if (err0 != IRError.NO_ERROR) {
            return (uint(err0), 0);
        }

        // We're going to multiply the utilization rate by the spread's numerator
        (Error err1, Exp memory utilizationRate1) = mulScalar(utilizationRate0, oneMinusSpreadBasisPoints);
        // mulScalar only overflows when product is greater than or equal to 2^256.
        // utilization rate's mantissa is a number between [0e18,1e18]. That means that
        // utilizationRate1 is a value between [0e18,8.5e21]. This is strictly less than 2^256.
        assert(err1 == Error.NO_ERROR);

        // Next multiply this product times the borrow rate
        (Error err2, Exp memory supplyRate0) = mulExp(utilizationRate1, annualBorrowRate);
        // If the product of the mantissas for mulExp are both less than 2^256,
        // then this operation will never fail. TODO: Verify.
        // We know that borrow rate is in the interval [0, 4e17] from above.
        // We know that utilizationRate1 is in the interval [0, 8.5e21] from directly above.
        // As such, the multiplication is in the interval of [0, 3.4e39]. This is strictly
        // less than 2^256 (which is about 10e77).
        assert(err2 == Error.NO_ERROR);

        // And then divide down by the spread's denominator (basis points divisor)
        // as well as by blocks per year.
        (Error err3, Exp memory standardSupplyRate) = divScalar(supplyRate0, 10000 * blocksPerYear); // basis points * blocks per year
        // divScalar only fails when divisor is zero. This is clearly not the case.
        assert(err3 == Error.NO_ERROR);

        // Note: StableCoins interest rate should be much less than the standard rate for other tokens
        (Error err4, uint finalSupplyRate) = div(standardSupplyRate.mantissa, 2);

        assert(err4 == Error.NO_ERROR);
        return (uint(IRError.NO_ERROR), finalSupplyRate);
    }

    /**
      * @notice Gets the current borrow interest rate based on the given asset, total cash and total borrows
      * @dev The return value should be scaled by 1e18, thus a return value of
      *      `(true, 1000000000000)` implies an interest rate of 0.000001 or 0.0001% *per block*.
      * @param _asset The asset to get the interest rate of
      * @param cash The total cash of the asset in the market
      * @param borrows The total borrows of the asset in the market
      * @return Success or failure and the borrow interest rate per block scaled by 10e18
      */
    function getBorrowRate(address _asset, uint cash, uint borrows) public view returns (uint, uint) {
        _asset; // pragma ignore unused argument

        (IRError err0, Exp memory _utilizationRate, Exp memory annualBorrowRate) = getUtilizationAndAnnualBorrowRate(cash, borrows);
        if (err0 != IRError.NO_ERROR) {
            return (uint(err0), 0);
        }

        // And then divide down by blocks per year.
        (Error err1, Exp memory standardBorrowRate) = divScalar(annualBorrowRate, blocksPerYear); // basis points * blocks per year
        // divScalar only fails when divisor is zero. This is clearly not the case.
        assert(err1 == Error.NO_ERROR);

        _utilizationRate; // pragma ignore unused variable

        // Note: StableCoins interest rate should be much less than the standard rate for other tokens
        (Error err2, uint finalBorrowRate) = div(standardBorrowRate.mantissa, 2);

        assert(err2 == Error.NO_ERROR);
        return (uint(IRError.NO_ERROR), finalBorrowRate);
    }
}
