pragma solidity ^0.4.24;

import "truffle/Assert.sol";
import "./MoneyMarketTest.sol";
import "../MathHelpers.sol";

/*
 * @dev This tests the money market with tests for setRiskParameters.
 */
contract MoneyMarketTest_SetRiskParameters is MoneyMarketTest {

    /**
      * @dev helper that lets us create an Exp with `getExp` without cluttering our test code with error checks of the setup.
      */
    function getExpFromRational(uint numerator, uint denominator) internal returns (Exp memory) {
        (Error err, Exp memory result) = getExp(numerator, denominator);

        Assert.equal(0, uint(err), "getExpFromRational failed");
        return result;
    }

    function testSetRiskParameters_NotAdmin() public {
        admin = address(0);

        Exp memory oldRatio = collateralRatio;
        Exp memory newRatio = getExpFromRational(3, 1);
        // Make sure newRatio is different so our validation of the non-update is legitimate
        Assert.notEqual(newRatio.mantissa, collateralRatio.mantissa, "setup failed; choose a different newRatio");
        
        Exp memory oldDiscount = liquidationDiscount;
        Exp memory newDiscount = getExpFromRational(5, 100);
        Assert.notEqual(newDiscount.mantissa, oldDiscount.mantissa, "setup failed; choose a different newDiscount");

        assertError(Error.UNAUTHORIZED, Error(_setRiskParameters(newRatio.mantissa, newDiscount.mantissa)), "should require admin rights");

        Assert.equal(collateralRatio.mantissa, oldRatio.mantissa, "collateral ratio should retain initial default value");
        Assert.equal(liquidationDiscount.mantissa, oldDiscount.mantissa, "liquidation discount should retain initial default value");
    }

    function testSetRiskParameters_Success() public {
        admin = msg.sender;
        Exp memory newRatio = getExpFromRational(3, 2);
        // Make sure newRatio is different so our validation of the update is legitimate
        Assert.notEqual(newRatio.mantissa, collateralRatio.mantissa, "setup failed; choose a different newRatio");

        Exp memory oldDiscount = liquidationDiscount;
        Exp memory newDiscount = getExpFromRational(5, 100);
        Assert.notEqual(newDiscount.mantissa, oldDiscount.mantissa, "setup failed; choose a different newDiscount");

        assertNoError(Error(_setRiskParameters(newRatio.mantissa, newDiscount.mantissa)));

        Assert.equal(collateralRatio.mantissa, newRatio.mantissa, "collateral ratio should have been updated");
        Assert.equal(liquidationDiscount.mantissa, newDiscount.mantissa, "liquidation discount should have been updated");
    }
}