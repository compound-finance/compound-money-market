pragma solidity ^0.4.24;

import "truffle/Assert.sol";
import "./MoneyMarketWithPriceTest.sol";

/*
 * @dev This tests the money market with tests for calculateAccountLiquidity, part 4
 */
contract MoneyMarketTest_CalculateAccountLiquidity4 is MoneyMarketWithPriceTest {

    function testCalculateAccountLiquidity_SupplyAssetPriceOverflow() public {
        address userAddress = nextAddress();
        address asset = nextAddress();

        markets[asset].supplyIndex = 1;
        markets[asset].supplyRateMantissa = 10**59;
        markets[asset].blockNumber = 1;

        // Wipeoput any previous collateral assets before adding the new one.
        collateralMarkets = new address[](0);
        addCollateralMarket(asset);

        supplyBalances[userAddress][asset] = Balance({
            principal: 10**18,
            interestIndex: 2
        });

        setAssetPriceInternal(asset, Exp({mantissa: 2**256 - 1}));

        (Error err2, Exp memory liquidity, Exp memory shortfall) = calculateAccountLiquidity(userAddress);
        assertZero(liquidity.mantissa, "default value");
        assertZero(shortfall.mantissa, "default value");
        assertError(Error.INTEGER_OVERFLOW, err2, "should overflow calculating supply balance with massive asset price");
    }
}