pragma solidity ^0.4.24;

import "truffle/Assert.sol";
import "./MoneyMarketWithPriceTest.sol";

/*
 * @dev This tests the money market with tests for calculateDiscountedRepayToEvenAmount.
 *      shortfall / [Oracle price for the borrow * (1 - liquidationDiscount)]
 */
contract MoneyMarketTest_CalculateDiscountedRepayToEvenAmount is MoneyMarketWithPriceTest {

    function testCalculateDiscountedBorrowDenominatedShortfall_HappyPathNoDiscount() public {
        address userAddress = nextAddress();
        address assetBorrow = nextAddress();
        address assetCollateral = nextAddress();

        liquidationDiscount = Exp({mantissa: 0});
        collateralRatio = Exp({mantissa: 2 * mantissaOne});

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

        // shortfall = abs((10 * 3) - (50 * 2 * 2)) = 170
        // 170 / 2 = 85
        Assert.equal(85, result, "170 / 2");

        assertNoError(err);
    }

    function testCalculateDiscountedBorrowDenominatedShortfall_HappyPathDiscount() public {
        address userAddress = nextAddress();
        address assetBorrow = nextAddress();
        address assetCollateral = nextAddress();

        liquidationDiscount = Exp({mantissa: 10**17}); // 10% discount
        collateralRatio = Exp({mantissa: 2 * mantissaOne});

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

        // shortfall = abs((10 * 3) - (50 * 2 * 2)) = 170
        // 170 / 2 = 85
        // shortfall / [Oracle price for the borrow * (1 - liquidationDiscount)]
        // 170 / (2 * 0.9)
        Assert.equal(94, result, "floor(170 / (2 * 0.9))");

        assertNoError(err);
    }

    function testCalculateDiscountedBorrowDenominatedShortfall_AccountLiquidityFails() public {
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
        markets[assetBorrow].borrowRateMantissa = 2**256 - 1;
        markets[assetBorrow].blockNumber = 1;

        (Error err, uint result) = calculateDiscountedRepayToEvenAmount(userAddress, Exp({mantissa: 2 * mantissaOne}));
        assertZero(result, "default value");

        assertError(Error.INTEGER_OVERFLOW, err, "should overflow calculating borrow index with massive rate");
    }
}