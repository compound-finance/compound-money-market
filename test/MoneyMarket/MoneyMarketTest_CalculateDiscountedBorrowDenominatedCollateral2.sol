pragma solidity ^0.4.24;

import "truffle/Assert.sol";
import "./MoneyMarketWithPriceTest.sol";

/*
 * @dev This tests the money market with tests for calculateDiscountedBorrowDenominatedCollateral
 *      discountedBorrowDenominatedCollateral = [supplyCurrent / (1 + liquidationDiscount)] * (Oracle price for the collateral / Oracle price for the borrow)
 */
contract MoneyMarketTest_CalculateDiscountedBorrowDenominatedCollateral2 is MoneyMarketWithPriceTest {

    function testCalculateDiscountedBorrowDenominatedCollateral_HugeSupplyCurrentCausesOverflow() public {
        liquidationDiscount = Exp({mantissa: 10**17}); // .1

        Exp memory collateralPrice = Exp({mantissa: mantissaOne * 3});
        Exp memory underwaterAssetPrice = Exp({mantissa: mantissaOne});

        (Error err, uint result) = calculateDiscountedBorrowDenominatedCollateral(underwaterAssetPrice, collateralPrice, 2**237);
        assertZero(result, "default value");

        assertError(Error.INTEGER_OVERFLOW, err, "should overflow from a huge supplyCurrent");
    }

    function testCalculateDiscountedBorrowDenominatedCollateral_HugePriceUnderwaterAssetCausesOverflow() public {
        liquidationDiscount = Exp({mantissa: 10**18}); // 100%

        Exp memory collateralPrice = Exp({mantissa: mantissaOne * 3});
        // We want  mulExp(onePlusLiquidationDiscount, assetPrices[underwaterAsset]) to overflow in Exp math, so we set assetPrices[assetBorrow] very high
        Exp memory underwaterAssetPrice = Exp({mantissa: 2**256 - 1});

        (Error err, uint result) = calculateDiscountedBorrowDenominatedCollateral(underwaterAssetPrice, collateralPrice, 2 * 10**18);
        assertZero(result, "default value");

        assertError(Error.INTEGER_OVERFLOW, err, "should overflow from a huge assetPrice of underwater asset");
    }

    function testCalculateDiscountedBorrowDenominatedCollateral_ZeroPriceCollateralCausesDivisionByZero() public {
        Exp memory collateralPrice = Exp({mantissa: mantissaOne * 3});
        // We want divExp(supplyCurrentTimesOracleCollateral, onePlusLiquidationDiscountTimesOracleBorrow); to throw division by zero error
        // so we set borrow price to zero to get a denominator of 0.
        Exp memory underwaterAssetPrice = Exp({mantissa: 0});

        (Error err, uint result) = calculateDiscountedBorrowDenominatedCollateral(underwaterAssetPrice, collateralPrice, 2 * 10**18);
        assertZero(result, "default value");

        assertError(Error.DIVISION_BY_ZERO, err, "should get division by zero when borrowed asset has price of zero");
    }
}