pragma solidity ^0.4.24;

import "truffle/Assert.sol";
import "./MoneyMarketWithPriceTest.sol";

/*
 * @dev This tests the money market with tests for calculateAccountLiquidity, part 5
 */
contract MoneyMarketTest_CalculateAccountLiquidity5 is MoneyMarketWithPriceTest {

    function testCalculateAccountLiquidity_SupplySummationOverflow() public {
        address userAddress = nextAddress();
        address asset1 = nextAddress();
        address asset2 = nextAddress();

        markets[asset1].supplyIndex = 1;
        markets[asset1].supplyRateMantissa = 1;
        markets[asset1].blockNumber = block.number;
        markets[asset2].supplyIndex = 1;
        markets[asset2].supplyRateMantissa = 1;
        markets[asset2].blockNumber = 1;

        // Wipeoput any previous collateral assets before adding the new one.
        collateralMarkets = new address[](0);
        addCollateralMarket(asset1);
        addCollateralMarket(asset2);

        // Use 2 balances that will overflow when added.
        supplyBalances[userAddress][asset1] = Balance({
            principal: 2**256 - 1,
            interestIndex: 1
        });
        supplyBalances[userAddress][asset2] = Balance({
            principal: 2**256 - 1,
            interestIndex: 1
        });

        setAssetPriceInternal(asset1, Exp({mantissa: 1}));
        setAssetPriceInternal(asset2, Exp({mantissa: 1}));

        (Error err2, Exp memory liquidity, Exp memory shortfall) = calculateAccountLiquidity(userAddress);
        assertZero(liquidity.mantissa, "default value");
        assertZero(shortfall.mantissa, "default value");
        assertError(Error.INTEGER_OVERFLOW, err2, "should overflow calculating supply sums with massive supply balances");
    }
}