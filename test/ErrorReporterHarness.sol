pragma solidity ^0.4.24;

import "../contracts/ErrorReporter.sol";

contract ErrorReporterHarness is ErrorReporter {

    function harnessPleaseFail() public {
        Error err = Error.INTEGER_OVERFLOW;
        FailureInfo info = FailureInfo.SUPPLY_TRANSFER_IN_FAILED;

        fail(err, info);
    }

    function harnessPleaseFailOpaque(uint opaqueError) public {
        FailureInfo info = FailureInfo.SUPPLY_NEW_SUPPLY_RATE_CALCULATION_FAILED;

        failOpaque(info, opaqueError);
    }

}