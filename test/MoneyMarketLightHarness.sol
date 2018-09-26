pragma solidity ^0.4.24;

import "../contracts/ErrorReporter.sol";
import "../contracts/MoneyMarket.sol";


contract MoneyMarketLightHarness is MoneyMarket {
    mapping (address => uint) public cashOverrides;

    mapping (address => bool) accountsToFailLiquidity;

    mapping (address => Exp) liquidityShortfalls;

    mapping (address => Exp) liquiditySurpluses;

    bool public failBorrowDenominatedCollateralCalculation;

    bool public failCalculateAmountSeize;

    /**
      * @dev Mapping of asset addresses and their corresponding price in terms of Eth-Wei
      *      which is simply equal to AssetWeiPrice * 10e18. For instance, if OMG token was
      *      worth 5x Eth then the price for OMG would be 5*10e18 or Exp({mantissa: 5000000000000000000}).
      *      Note: If useOracle is true, then we don't use this mapping and instead call the real function of MoneyMarket.
      * map: assetAddress -> Exp
      */
    mapping (address => Exp) public assetPrices;

    bool useOracle = false;

    function fetchAssetPrice(address asset) internal view returns (Error, Exp memory) {
        if (useOracle) {
            return super.fetchAssetPrice(asset);
        }

        return (Error.NO_ERROR, assetPrices[asset]);
    }

    function getCash(address asset) internal view returns (uint) {
        uint override = cashOverrides[asset];
        if (override > 0) {
            return override;
        }
        return super.getCash(asset);
    }

    function harnessSetAssetPrice(address asset, uint priceNum, uint priceDenom) public {
        (Error err0, Exp memory assetPrice) = getExp(priceNum, priceDenom);
        assert(err0 == Error.NO_ERROR);

        setAssetPriceInternal(asset, assetPrice);
    }

    // TODO: RENAME to include harness in name
    /**
      * @notice Sets the price of a given asset
      * @dev Oracle function to set the price of a given asset
      * @param asset Asset to set the price of
      * @param assetPriceMantissa Price of asset-wei in terms of eth-wei, scaled by 1e18.
      * @return uint 0=success, otherwise a failure (see ErrorReporter.sol for details)
      */
    function _setAssetPrice(address asset, uint assetPriceMantissa) public returns (uint) {
        // Set the asset price to `price`
        setAssetPriceInternal(asset, Exp({mantissa: assetPriceMantissa}));
        return uint(Error.NO_ERROR);
    }

    /**
      * @dev Sets the price for the given asset. The price for any asset must be specified as
      * the AssetWeiPrice * 10e18. For instance, if DRGN is currently worth 0.00113323 Eth then
      * the price must be specified as Exp({mantissa: 1133230000000000}).
      */
    function setAssetPriceInternal(address asset, Exp memory price) internal {
        assetPrices[asset] = price;
    }

    function harnessSetMaxAssetPrice(address asset) public {
        setAssetPriceInternal(asset, Exp({mantissa: 2**256 - 1}));
    }

    function harnessSetMarketDetails(address asset, uint totalSupply, uint supplyRateBasisPoints, uint supplyIndex, uint totalBorrows, uint borrowRateBasisPoints, uint borrowIndex) public {
        (Error err0, Exp memory supplyRate) = getExp(supplyRateBasisPoints, 10000);
        (Error err1, Exp memory borrowRate) = getExp(borrowRateBasisPoints, 10000);

        assert(err0 == Error.NO_ERROR);
        assert(err1 == Error.NO_ERROR);

        markets[asset].blockNumber = block.number;
        markets[asset].totalSupply = totalSupply;
        markets[asset].supplyRateMantissa = supplyRate.mantissa;
        markets[asset].supplyIndex = supplyIndex;
        markets[asset].totalBorrows = totalBorrows;
        markets[asset].borrowRateMantissa = borrowRate.mantissa;
        markets[asset].borrowIndex = borrowIndex;
    }
}