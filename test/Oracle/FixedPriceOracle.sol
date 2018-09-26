pragma solidity ^0.4.24;

// No imports here because this contract can get moved around
// by a script for when we deploy it in dev environments.

contract FixedPriceOracle {

    /**
      * @notice Gets the price of a given asset
      * @dev fetches the price of a given asset
      * @param asset Asset to get the price of
      * @return the price scaled by 10**18, or zero if the price is not available
      */
    function assetPrices(address asset) public view returns (uint) {
        // let's avoid warning about unused function parameter
        if (asset == address(0)) {
            return 0;
        }
        // 0.05
        return 5 * (10 ** 16);
    }
}