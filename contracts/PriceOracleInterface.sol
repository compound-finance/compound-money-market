pragma solidity ^0.4.24;

contract PriceOracleInterface {

    /**
      * @notice Gets the price of a given asset
      * @dev fetches the price of a given asset
      * @param asset Asset to get the price of
      * @return the price scaled by 10**18, or zero if the price is not available
      */
    function assetPrices(address asset) public view returns (uint);
}