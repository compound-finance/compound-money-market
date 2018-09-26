pragma solidity ^0.4.24;

import "truffle/Assert.sol";
import "./MoneyMarketTest.sol";

/*
 * @dev This tests the money market with tests for _setPendingAdmin.
 */
contract MoneyMarketTest_SetPendingAdmin is MoneyMarketTest {

    function testSetPendingAdmin_asAdmin() public {
        address addr1 = nextAddress();

        admin = msg.sender;

        assertNoError(Error(_setPendingAdmin(addr1)));
        Assert.equal(pendingAdmin, addr1, "should be addr1");
    }

}