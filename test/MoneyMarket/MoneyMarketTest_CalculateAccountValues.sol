pragma solidity ^0.4.24;

import "truffle/Assert.sol";
import "./MoneyMarketWithPriceTest.sol";

/*
 * @dev This tests the money market with tests for calculateAccountValues
 */
contract MoneyMarketTest_CalculateAccountValues is MoneyMarketWithPriceTest {

    function testGetAccountValues_HappyPath() public {
        address userAddress = nextAddress();
        address asset1 = nextAddress();
        address asset2 = nextAddress();

        markets[asset1].supplyIndex = 1;
        markets[asset1].supplyRateMantissa = 1;
        markets[asset1].blockNumber = block.number;

        markets[asset2].borrowIndex = 1;
        markets[asset2].borrowRateMantissa = 1;
        markets[asset2].blockNumber = 1;

        // Wipe out any previous collateral assets before adding the new one.
        collateralMarkets = new address[](0);
        addCollateralMarket(asset1);
        addCollateralMarket(asset2);

        // provide a supply and a borrow balance
        supplyBalances[userAddress][asset1] = Balance({
            principal: 3 * 10**18,
            interestIndex: 1
            });

        borrowBalances[userAddress][asset2] = Balance({
            principal: 2 * 10**18,
            interestIndex: 1
            });

        setAssetPriceInternal(asset1, Exp({mantissa: 3}));
        setAssetPriceInternal(asset2, Exp({mantissa: 2}));

        // Test
        (uint err, uint supplyMantissa, uint borrowMantissa) = calculateAccountValues(userAddress);

        assertZero(err, "should have gotten NO_ERROR");
        Assert.equal(9 * 10**18, supplyMantissa, "should have gotten scaled supply value");
        Assert.equal(4 * 10**18, borrowMantissa, "should have gotten scaled borrow value");
    }

    function testGetAccountValues_SupplySummationOverflow() public {
        address userAddress = nextAddress();
        address asset1 = nextAddress();
        address asset2 = nextAddress();

        markets[asset1].supplyIndex = 1;
        markets[asset1].supplyRateMantissa = 1;
        markets[asset1].blockNumber = block.number;
        markets[asset2].supplyIndex = 1;
        markets[asset2].supplyRateMantissa = 1;
        markets[asset2].blockNumber = 1;

        // Wipe out any previous collateral assets before adding the new one.
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

        // Test
        (uint err2, uint supplyMantissa, uint borrowMantissa) = calculateAccountValues(userAddress);

        Assert.equal(3, err2, "should have gotten INTEGER_OVERFLOW");
        assertZero(supplyMantissa, "default value");
        assertZero(borrowMantissa, "default value");
    }
}