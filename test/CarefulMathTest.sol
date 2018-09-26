pragma solidity ^0.4.24;

import "truffle/Assert.sol";
import "./AssertHelpers.sol";
import "../contracts/CarefulMath.sol";
import "../contracts/ErrorReporter.sol";

contract CarefulMathTest is CarefulMath, AssertHelpers {

    function testStandardAddition() public {
        (Error err, uint val) = add(5, 6);

        assertNoError(err);
        Assert.equal(11, val, "should compute addition correctly");
    }

    function testAddZeroLeft() public {
        (Error err, uint val) = add(0, 6);

        assertNoError(err);
        Assert.equal(6, val, "should compute addition correctly");
    }

    function testAddZeroRight() public {
        (Error err, uint val) = add(6, 0);

        assertNoError(err);
        Assert.equal(6, val, "should compute addition correctly");
    }

    function testAdditiveOverflow() public {
        (Error err, uint val) = add(5, uint(-1));

        assertError(Error.INTEGER_OVERFLOW, err, "should have error INTEGER_OVERFLOW");
        Assert.equal(0, val, "should have default value");
    }

    function testStandardSubtraction() public {
        (Error err, uint val) = sub(1000, 250);

        assertNoError(err);
        Assert.equal(750, val, "should compute subtraction correctly");
    }

    function testSubtractZero() public {
        (Error err, uint val) = sub(1000, 0);

        assertNoError(err);
        Assert.equal(1000, val, "should compute subtraction correctly");
    }

    function testSubtractFromZero() public {
        (Error err, uint val) = sub(0, 1000);

        assertError(Error.INTEGER_UNDERFLOW, err, "should have error INTEGER_UNDERFLOW");
        Assert.equal(0, val, "should compute subtraction correctly");
    }

    function testSubtractiveUnderflow() public {
        (Error err, uint val) = sub(250, 1000);

        assertError(Error.INTEGER_UNDERFLOW, err, "should have error INTEGER_UNDERFLOW");
        Assert.equal(0, val, "should compute subtraction correctly");
    }

    function testStandardMultiplication() public {
        (Error err, uint val) = mul(100, 7);

        assertNoError(err);
        Assert.equal(700, val, "should compute multiplication correctly");
    }

    function testStandardMultiplicationByZeroLeft() public {
        (Error err, uint val) = mul(0, 100);

        assertNoError(err);
        Assert.equal(0, val, "should compute multiplication correctly");
    }

    function testStandardMultiplicationByZeroRight() public {
        (Error err, uint val) = mul(100, 0);

        assertNoError(err);
        Assert.equal(0, val, "should compute multiplication correctly");
    }

    function testMultiplicativeOverflow() public {
        (Error err, uint val) = mul(uint(-1), 3);

        assertError(Error.INTEGER_OVERFLOW, err, "should have error INTEGER_OVERFLOW");
        Assert.equal(0, val, "should have default value");
    }

    function testLargeNumberIdentityMultiplication() public {
        (Error err, uint val) = mul(uint(-1), 1);

        assertNoError(err);
        Assert.equal(uint(-1), val, "should compute multiplication correctly");
    }

    function testStandardDivision() public {
        (Error err, uint val) = div(100, 5);

        assertNoError(err);
        Assert.equal(20, val, "should compute division correctly");
    }

    function testDivisionWithTruncation() public {
        (Error err, uint val) = div(100, 33);

        assertNoError(err);
        Assert.equal(3, val, "should compute division correctly");
    }

    function testDivisionOfZero() public {
        (Error err, uint val) = div(0, 8);

        assertNoError(err);
        Assert.equal(0, val, "should compute division correctly");
    }

    function testDivisionByZero() public {
        (Error err, uint val) = div(8, 0);

        assertError(Error.DIVISION_BY_ZERO, err, "should have error DIVISION_BY_ZERO");
        Assert.equal(0, val, "should have default value");
    }

    function testLargeNumberIdentityDivision() public {
        (Error err, uint val) = div(uint(-1), 1);

        assertNoError(err);
        Assert.equal(uint(-1), val, "should compute multiplication correctly");
    }


    function testAddThenSub() public {
        (Error err, uint val) = addThenSub(1, 3, 2);

        assertNoError(err);
        Assert.equal(2, val, "should perform operations in the stated order"); // 1 - 2 before adding 3 would underflow
    }

    function testAddThenSubOverflow() public {
        (Error err, uint val) = addThenSub(2**256 - 1, 2**256 - 1, 5);
        assertError(Error.INTEGER_OVERFLOW, err, "should have error INTEGER_OVERFLOW");

        Assert.equal(0, val, "should have default value");
    }
}