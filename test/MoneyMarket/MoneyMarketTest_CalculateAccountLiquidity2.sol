pragma solidity ^0.4.24;

import "truffle/Assert.sol";
import "./MoneyMarketWithPriceTest.sol";

/*
 * @dev This tests the money market with tests for calculateAccountLiquidity, part 2
 */
contract MoneyMarketTest_CalculateAccountLiquidity2 is MoneyMarketWithPriceTest {

    function testCalculateAccountLiquidity_BorrowInterestIndexShortcircuit() public {
        address userAddress = nextAddress();
        address asset = nextAddress();

        markets[asset].supplyIndex = 1;
        markets[asset].supplyRateMantissa = 1;
        markets[asset].borrowIndex = 1;
        markets[asset].borrowRateMantissa = 2**256 - 1;
        markets[asset].blockNumber = 1;

        // Wipeoput any previous collateral assets before adding the new one.
        collateralMarkets = new address[](0);
        addCollateralMarket(asset);

        (Error err2, Exp memory liquidity, Exp memory shortfall) = calculateAccountLiquidity(userAddress);
        assertZero(liquidity.mantissa, "default value");
        assertZero(shortfall.mantissa, "default value");
        assertNoError(err2);
    }

    function testCalculateAccountLiquidity_BorrowInterestIndexOverflow() public {
        address userAddress = nextAddress();
        address asset = nextAddress();

        borrowBalances[userAddress][asset].principal = 1;
        markets[asset].supplyIndex = 1;
        markets[asset].supplyRateMantissa = 1;
        markets[asset].borrowIndex = 1;
        markets[asset].borrowRateMantissa = 2**256 - 1;
        markets[asset].blockNumber = 1;

        // Wipeoput any previous collateral assets before adding the new one.
        collateralMarkets = new address[](0);
        addCollateralMarket(asset);

        (Error err2, Exp memory liquidity, Exp memory shortfall) = calculateAccountLiquidity(userAddress);
        assertZero(liquidity.mantissa, "default value");
        assertZero(shortfall.mantissa, "default value");
        assertError(Error.INTEGER_OVERFLOW, err2, "should overflow calculating borrow index with massive rate");
    }

    function testCalculateAccountLiquidity_BorrowCalculateBalanceOverflow() public {
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
            principal: 2**256 - 1,
            interestIndex: 2
            });

        (Error err2, Exp memory liquidity, Exp memory shortfall) = calculateAccountLiquidity(userAddress);
        assertZero(liquidity.mantissa, "default value");
        assertZero(shortfall.mantissa, "default value");
        assertError(Error.INTEGER_OVERFLOW, err2, "should overflow calculating borrow balance with massive principal");
    }



}