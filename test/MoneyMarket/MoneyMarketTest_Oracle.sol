pragma solidity ^0.4.24;

import "truffle/Assert.sol";
import "./MoneyMarketTest.sol";

/*
 * @dev This tests the money market with tests for oracle activities.
 */
contract MoneyMarketTest_Oracle is MoneyMarketTest {

    function testSetOracle_NotAdmin() public {
        address addr1 = nextAddress();
        address addr2 = nextAddress();
        address addr3 = nextAddress();

        oracle = addr1;
        admin = addr2;

        assertError(Error.UNAUTHORIZED, Error(_setOracle(addr3)), "should fail as not admin");
        Assert.equal(oracle, addr1, "oracle should remain addr1");
    }
}