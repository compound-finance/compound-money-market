pragma solidity ^0.4.24;

import "../contracts/MoneyMarket.sol";

contract MoneyMarketGasHarness is MoneyMarket {

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

    function harnessSetAccountSupplyBalance(address account, address asset, uint principal, uint interestIndex) public {
        supplyBalances[account][asset] = Balance({
            principal: principal,
            interestIndex: interestIndex
        });
    }

    function harnessSupportMarket(address asset) public {
        markets[asset].isSupported = true;
    }

    function harnessReadAndSetAccountSupplyBalanceAndMarketDetails(address account, address asset, uint principal, uint interestIndex, uint totalSupply, uint supplyRateBasisPoints, uint supplyIndex, uint totalBorrows, uint borrowRateBasisPoints, uint borrowIndex) public returns (uint) {
        Market storage market = markets[asset]; // Storing a storage pointer has the lowest gas cost
        Balance storage balance = supplyBalances[account][asset];

        uint res = 0; // Note: we track a result here so these operations do not get optimized out

        res += market.blockNumber;
        res += market.totalSupply;
        res += market.supplyRateMantissa;
        res += market.supplyIndex;
        res += market.totalBorrows;
        res += market.borrowRateMantissa;
        res += market.borrowIndex;
        res += balance.principal;
        res += balance.interestIndex;

        harnessSetAccountSupplyBalance(account, asset, principal, interestIndex);
        harnessSetMarketDetails(asset, totalSupply, supplyRateBasisPoints, supplyIndex, totalBorrows, borrowRateBasisPoints, borrowIndex);

        return res;
    }

    function harnessSetAccountSupplyBalanceAndMarketDetails(address account, address asset, uint principal, uint interestIndex, uint totalSupply, uint supplyRateBasisPoints, uint supplyIndex, uint totalBorrows, uint borrowRateBasisPoints, uint borrowIndex) public {
        harnessSetAccountSupplyBalance(account, asset, principal, interestIndex);
        harnessSetMarketDetails(asset, totalSupply, supplyRateBasisPoints, supplyIndex, totalBorrows, borrowRateBasisPoints, borrowIndex);
    }

    function harnessCalculateInterestIndex(uint startingInterestIndex, uint interestRateBasisPoints, uint blockDelta) public pure returns (uint) {
        // TODO: We can probably do this better getExp code in the newer versions of harnesses
        (Error err0, Exp memory interestRate) = getExp(interestRateBasisPoints, 10000);
        assert(err0 == Error.NO_ERROR);

        (Error err1, uint newInterestIndex) = calculateInterestIndex(startingInterestIndex, interestRate.mantissa, 0, blockDelta);
        assert(err1 == Error.NO_ERROR);

        return newInterestIndex;
    }
}