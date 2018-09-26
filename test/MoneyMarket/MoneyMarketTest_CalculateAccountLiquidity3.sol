pragma solidity ^0.4.24;

import "truffle/Assert.sol";
import "./MoneyMarketWithPriceTest.sol";

/*
 * @dev This tests the money market with tests for calculateAccountLiquidity, part 3
 */
contract MoneyMarketTest_CalculateAccountLiquidity3 is MoneyMarketWithPriceTest {

    function testCalculateAccountLiquidity_BorrowAssetPriceOverflow() public {
        address userAddress = nextAddress();
        address asset = nextAddress();

        markets[asset].supplyIndex = 1;
        markets[asset].supplyRateMantissa = 1;
        markets[asset].borrowIndex = 1;
        markets[asset].borrowRateMantissa = 10**59;
        markets[asset].blockNumber = 1;

        // Wipeoput any previous collateral assets before adding the new one.
        collateralMarkets = new address[](0);
        addCollateralMarket(asset);

        borrowBalances[userAddress][asset] = Balance({
            principal: 10**18,
            interestIndex: 2
            });

        setAssetPriceInternal(asset, Exp({mantissa: 2**256 - 1}));

        (Error err2, Exp memory liquidity, Exp memory shortfall) = calculateAccountLiquidity(userAddress);
        assertZero(liquidity.mantissa, "default value");
        assertZero(shortfall.mantissa, "default value");
        assertError(Error.INTEGER_OVERFLOW, err2, "should overflow calculating borrow balance with massive asset price");
    }

    function testCalculateAccountLiquidity_BorrowSummationOverflow() public {
        address userAddress = nextAddress();
        address asset1 = nextAddress();
        address asset2 = nextAddress();

        markets[asset1].supplyIndex = 1;
        markets[asset1].supplyRateMantissa = 1;
        markets[asset1].borrowIndex = 1;
        markets[asset1].borrowRateMantissa = 1;
        markets[asset1].blockNumber = block.number;
        markets[asset2].supplyIndex = 1;
        markets[asset2].supplyRateMantissa = 1;
        markets[asset2].borrowIndex = 1;
        markets[asset2].borrowRateMantissa = 1;
        markets[asset2].blockNumber = block.number;

        // Wipeoput any previous collateral assets before adding the new one.
        collateralMarkets = new address[](0);
        addCollateralMarket(asset1);
        addCollateralMarket(asset2);

        // Use 2 balances that will overflow when added.
        borrowBalances[userAddress][asset1] = Balance({
            principal: 10**59,
            interestIndex: 1
            });
        borrowBalances[userAddress][asset2] = Balance({
            principal: 10**59,
            interestIndex: 1
            });

        // For simplicity we'll use a collateralRatio of 1e-18
        collateralRatio = Exp({mantissa: mantissaOne});

        setAssetPriceInternal(asset1, Exp({mantissa: mantissaOne}));
        setAssetPriceInternal(asset2, Exp({mantissa: mantissaOne}));

        (Error err2, Exp memory liquidity, Exp memory shortfall) = calculateAccountLiquidity(userAddress);
        assertZero(liquidity.mantissa, "default value");
        assertZero(shortfall.mantissa, "default value");
        assertError(Error.INTEGER_OVERFLOW, err2, "should overflow calculating borrow sums with massive borrow balances");
    }
}