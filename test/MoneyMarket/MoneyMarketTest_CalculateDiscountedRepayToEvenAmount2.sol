pragma solidity ^0.4.24;

import "truffle/Assert.sol";
import "./MoneyMarketWithPriceTest.sol";

/*
 * @dev This tests the money market with tests for calculateDiscountedRepayToEvenAmount.
 *      shortfall / [Oracle price for the borrow * (1 - liquidationDiscount)]
 */
contract MoneyMarketTest_CalculateDiscountedRepayToEvenAmount2 is MoneyMarketWithPriceTest {

    function testCalculateDiscountedBorrowDenominatedShortfall_UnderflowFromCollateralRatioMinusLiquidationDiscount() public {
        address userAddress = nextAddress();
        address assetBorrow = nextAddress();
        address assetCollateral = nextAddress();

        // Error setup: invalid collateral ratio of 1 and invalid liquidation discount of 200%
        collateralRatio = Exp({mantissa: mantissaOne}); // unrealistic 1:1 collateralRatio
        liquidationDiscount = Exp({mantissa: 2 * mantissaOne}); // 100% discount not valid

        // Wipe out any previous collateral assets before adding the new one.
        collateralMarkets = new address[](0);
        addCollateralMarket(assetBorrow);
        addCollateralMarket(assetCollateral);

        borrowBalances[userAddress][assetBorrow].interestIndex = 1;
        borrowBalances[userAddress][assetBorrow].principal = 50;
        assetPrices[assetBorrow] = Exp({mantissa: 2 * mantissaOne});

        supplyBalances[userAddress][assetCollateral].interestIndex = 1;
        supplyBalances[userAddress][assetCollateral].principal = 10;
        assetPrices[assetCollateral] = Exp({mantissa: 3 * mantissaOne});

        markets[assetBorrow].isSupported = true;
        markets[assetBorrow].supplyIndex = 1;
        markets[assetBorrow].supplyRateMantissa = 0;
        markets[assetBorrow].borrowIndex = 1;
        markets[assetBorrow].borrowRateMantissa = 0;
        markets[assetBorrow].blockNumber = 1;

        markets[assetCollateral].isSupported = true;
        markets[assetCollateral].supplyIndex = 1;
        markets[assetCollateral].supplyRateMantissa = 0;
        markets[assetCollateral].borrowIndex = 1;
        markets[assetCollateral].borrowRateMantissa = 0;
        markets[assetCollateral].blockNumber = 1;

        (Error err, uint result) = calculateDiscountedRepayToEvenAmount(userAddress, assetPrices[assetBorrow]);
        assertZero(result, "default value");

        assertError(Error.INTEGER_UNDERFLOW, err, "should cause underflow when collateral ratio < liquidation discount");
    }

    function testCalculateDiscountedBorrowDenominatedShortfall_UnderflowSubtractingOneFromCollateralRatioMinusLiquidationDiscount() public {
        address userAddress = nextAddress();
        address assetBorrow = nextAddress();
        address assetCollateral = nextAddress();

        // Error setup: unrealistic collateral ratio of 1 - .1 liquidation discount = 0.9. When one is subtracted from 0.9, we'll get underflow.
        collateralRatio = Exp({mantissa: mantissaOne}); // unrealistic 1:1 collateralRatio
        liquidationDiscount = Exp({mantissa: 10**17}); // 10% discount

        // Wipe out any previous collateral assets before adding the new one.
        collateralMarkets = new address[](0);
        addCollateralMarket(assetBorrow);
        addCollateralMarket(assetCollateral);

        borrowBalances[userAddress][assetBorrow].interestIndex = 1;
        borrowBalances[userAddress][assetBorrow].principal = 50;
        assetPrices[assetBorrow] = Exp({mantissa: 2 * mantissaOne});

        supplyBalances[userAddress][assetCollateral].interestIndex = 1;
        supplyBalances[userAddress][assetCollateral].principal = 10;
        assetPrices[assetCollateral] = Exp({mantissa: 3 * mantissaOne});

        markets[assetBorrow].isSupported = true;
        markets[assetBorrow].supplyIndex = 1;
        markets[assetBorrow].supplyRateMantissa = 0;
        markets[assetBorrow].borrowIndex = 1;
        markets[assetBorrow].borrowRateMantissa = 0;
        markets[assetBorrow].blockNumber = 1;

        markets[assetCollateral].isSupported = true;
        markets[assetCollateral].supplyIndex = 1;
        markets[assetCollateral].supplyRateMantissa = 0;
        markets[assetCollateral].borrowIndex = 1;
        markets[assetCollateral].borrowRateMantissa = 0;
        markets[assetCollateral].blockNumber = 1;

        (Error err, uint result) = calculateDiscountedRepayToEvenAmount(userAddress, assetPrices[assetBorrow]);
        assertZero(result, "default value");

        assertError(Error.INTEGER_UNDERFLOW, err, "should cause underflow when collateral ratio - liquidation discount < 1");
    }

    function testCalculateDiscountedBorrowDenominatedShortfall_TinyBorrowPriceCausesDivisionByZeroWhenDiscounted() public {
        address userAddress = nextAddress();
        address assetBorrow = nextAddress();

        // Wipe out any previous collateral assets before adding the new one.
        collateralMarkets = new address[](0);
        addCollateralMarket(assetBorrow);

        borrowBalances[userAddress][assetBorrow].principal = 1;
        markets[assetBorrow].isSupported = true;
        markets[assetBorrow].supplyIndex = 1;
        markets[assetBorrow].supplyRateMantissa = 1;
        markets[assetBorrow].borrowIndex = 1;
        markets[assetBorrow].borrowRateMantissa = 1;
        markets[assetBorrow].blockNumber = 1;

        // Setup failure
        // Set a price for the borrowed asset very low and discount high so borrowed asset price truncates to zero when discounted
        assetPrices[assetBorrow] = Exp({mantissa: 1}); //address => Exp
        liquidationDiscount = Exp({mantissa: 10**17});

        (Error err, uint result) = calculateDiscountedRepayToEvenAmount(userAddress, assetPrices[assetBorrow]);
        assertZero(result, "default value");

        assertError(Error.DIVISION_BY_ZERO, err, "should cause division by zero when tiny borrow asset price discounts to zero");
    }
}