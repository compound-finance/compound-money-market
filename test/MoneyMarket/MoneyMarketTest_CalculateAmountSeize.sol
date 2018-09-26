pragma solidity ^0.4.24;

import "truffle/Assert.sol";
import "./MoneyMarketWithPriceTest.sol";

/*
 * @dev This tests the money market with tests for calculateAmountSeize
 */
contract MoneyMarketTest_CalculateAmountSeize is MoneyMarketWithPriceTest {

    function testCalculateAmountSeize_HappyPathNoDiscount() public {
        liquidationDiscount = Exp({mantissa: 0});

        Exp memory underwaterAssetPrice = Exp({mantissa: mantissaOne});
        Exp memory collateralPrice = Exp({mantissa: mantissaOne * 3});

        (Error err, uint result) = calculateAmountSeize(underwaterAssetPrice, collateralPrice, 2 * 10**18);
        assertNoError(err);

        Assert.equal(666666666666666666, result, "6.666...x10^17");
    }

    function testCalculateAmountSeize_HappyPathDiscounted() public {
        liquidationDiscount = Exp({mantissa: 5 * 10**16}); // 5% discount

        Exp memory underwaterAssetPrice = Exp({mantissa: mantissaOne});
        Exp memory collateralPrice = Exp({mantissa: mantissaOne * 3});

        (Error err, uint result) = calculateAmountSeize(underwaterAssetPrice, collateralPrice, 5 * 10**18);
        assertNoError(err);

        Assert.equal(1750000000000000000, result, "1750000000000000000");
    }

    function testCalculateAmountSeize_HappyPathDiscountedBigPriceDifference() public {
        liquidationDiscount = Exp({mantissa: 5 * 10**16}); // 5% discount

        Exp memory underwaterAssetPrice = Exp({mantissa: mantissaOne});
        Exp memory collateralPrice = Exp({mantissa: mantissaOne * 550});

        (Error err, uint result) = calculateAmountSeize(underwaterAssetPrice, collateralPrice, 5 * 10**18);
        assertNoError(err);

        Assert.equal(9545454545454545, result, "9545454545454545");
    }
}