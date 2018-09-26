pragma solidity ^0.4.24;

import "truffle/Assert.sol";
import "./MoneyMarketTest.sol";

/*
 * @dev This tests the money market with tests for calculateAccountLiquidity.
 */
contract MoneyMarketTest_CalculateAccountLiquidity is MoneyMarketTest {

    function testCalculateAccountLiquidity_ShortcircuitsWithoutBalance() public {
        address userAddress = nextAddress();
        address asset = nextAddress();

        // Add a user
        markets[asset].supplyIndex = 1;
        markets[asset].supplyRateMantissa = 2**256 - 1;
        markets[asset].blockNumber = 1;

        // Wipeoput any previous collateral assets before adding the new one.
        collateralMarkets = new address[](0);
        addCollateralMarket(asset);

        (Error err2, Exp memory liquidity, Exp memory shortfall) = calculateAccountLiquidity(userAddress);
        assertZero(liquidity.mantissa, "default value");
        assertZero(shortfall.mantissa, "default value");
        assertNoError(err2);
    }

    function testCalculateAccountLiquidity_SupplyInterestIndexOverflow() public {
        address userAddress = nextAddress();
        address asset = nextAddress();

        // Add a user
        supplyBalances[userAddress][asset].principal = 1;
        markets[asset].supplyIndex = 1;
        markets[asset].supplyRateMantissa = 2**256 - 1;
        markets[asset].blockNumber = 1;

        // Wipeoput any previous collateral assets before adding the new one.
        collateralMarkets = new address[](0);
        addCollateralMarket(asset);

        (Error err2, Exp memory liquidity, Exp memory shortfall) = calculateAccountLiquidity(userAddress);
        assertZero(liquidity.mantissa, "default value");
        assertZero(shortfall.mantissa, "default value");
        assertError(Error.INTEGER_OVERFLOW, err2, "should overflow calculating supply index with massive rate");
    }

    function testCalculateAccountLiquidity_SupplyCalculateBalanceOverflow() public {
        address userAddress = nextAddress();
        address asset = nextAddress();

        markets[asset].supplyIndex = 1;
        markets[asset].supplyRateMantissa = 10**59;
        markets[asset].blockNumber = 1;

        // Wipeoput any previous collateral assets before adding the new one.
        collateralMarkets = new address[](0);
        addCollateralMarket(asset);

        supplyBalances[userAddress][asset] = Balance({
            principal: 2**256 - 1,
            interestIndex: 2
        });

        (Error err2, Exp memory liquidity, Exp memory shortfall) = calculateAccountLiquidity(userAddress);
        assertZero(liquidity.mantissa, "default value");
        assertZero(shortfall.mantissa, "default value");
        assertError(Error.INTEGER_OVERFLOW, err2, "should overflow calculating supply balance with massive principal");
    }
}