pragma solidity ^0.4.24;

import "truffle/Assert.sol";
import "./MoneyMarketWithPriceTest.sol";

/*
 * @dev This tests the money market with tests for getPriceForAssetAmountMulCollatRatio.
 */
contract MoneyMarketTest_GetPriceForAssetAmountMulCollatRatio is MoneyMarketWithPriceTest {

    function testGetPriceForAssetAmountMulCollatRatio_Success1() public {
        address addr1 = nextAddress();

        (Error err1, Exp memory val1) = getExp(50, 1);
        assertNoError(err1);

        setAssetPriceInternal(addr1, val1);

        (Error err2, Exp memory assetValue) = getPriceForAssetAmountMulCollatRatio(addr1, 1 ether);
        assertNoError(err2);
        Assert.equal(100 ether, truncate(assetValue), "1 ether * 50:1 * 2:1");
    }

    function testGetPriceForAssetAmountMulCollatRatio_Success2() public {
        address addr1 = nextAddress();

        (Error err1, Exp memory val1) = getExp(1, 5);
        assertNoError(err1);

        setAssetPriceInternal(addr1, val1);

        (Error err2, Exp memory assetValue) = getPriceForAssetAmountMulCollatRatio(addr1, 1 ether);
        assertNoError(err2);
        Assert.equal(0.4 ether, truncate(assetValue), "1 ether * 1:5 * 2:1");
    }

    function testGetPriceForAssetAmountMulCollatRatio_Overflow() public {
        address addr1 = nextAddress();

        (Error err1, Exp memory val1) = getExp(10**58, 1); // Exp({mantissa: 10**76}); // our scaled representation of 10e59
        assertNoError(err1);

        setAssetPriceInternal(addr1, val1);

        (Error err2, Exp memory assetValue) = getPriceForAssetAmountMulCollatRatio(addr1, 10**18);
        assertError(Error.INTEGER_OVERFLOW, err2, "should overflow multiplication of massive price");
        assertZero(assetValue.mantissa, "default value");
    }

    function testGetPriceForAssetAmountMulCollatRatio_Zero() public {
        address addr1 = nextAddress();

        (Error err, Exp memory assetValue) = getPriceForAssetAmountMulCollatRatio(addr1, 10**18);
        assertError(Error.MISSING_ASSET_PRICE, err, "missing asset price");
        assertZero(assetValue.mantissa, "default value");
    }

    function testGetPriceForAssetAmountMulCollatRatio_UnsetOracle() public {
        oracle = address(0);
        // MoneyMarketWithPriceTest uses its own price map unless instructed to use the MoneyMarket's function
        useOracle = true;
        address addr1 = nextAddress();

        (Error err, Exp memory assetValue) = getPriceForAssetAmountMulCollatRatio(addr1, 10**18);
        assertError(Error.ZERO_ORACLE_ADDRESS, err, "should have failed from unset oracle");
        Assert.equal(0, assetValue.mantissa, "assetValue.mantissa");
    }

}