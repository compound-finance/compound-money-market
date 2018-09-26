pragma solidity ^0.4.24;

import "truffle/Assert.sol";
import "../contracts/ErrorReporter.sol";

contract ErrorReporterTest is ErrorReporter {

    function testZeroIsNoError() public {
        Error err = Error.NO_ERROR;

        Assert.equal(uint(err), 0, "zero must be no error");
    }

    function testOneIsOpaqueError() public {
        Error err = Error.OPAQUE_ERROR;

        Assert.equal(uint(err), 1, "one must be indicator of opaque error");
    }

    function testAnotherErrorIsNonZero() public {
        Error err = Error.INTEGER_OVERFLOW;

        Assert.isAbove(uint(err), 1, "integer overflow should be above one");
    }

    function testFail() public {
        Error err = Error.INTEGER_UNDERFLOW;
        FailureInfo info = FailureInfo.SUPPLY_TRANSFER_IN_FAILED;

        // Make sure our inputs aren't letting us do a bogus validation
        Assert.notEqual(uint(err), uint(info), "bad setup: use a FailureInfo with a uint value that differs from the Error's uint value");

        Assert.equal(fail(err, info), uint(err), "should return uint value of enum after fail");
    }

}