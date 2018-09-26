pragma solidity ^0.4.24;

import "truffle/Assert.sol";
import "./MoneyMarketTest.sol";

/*
 * @dev This tests the money market with basic tests.
 */
contract MoneyMarketTest_Basic is MoneyMarketTest {

    function testMin() public {
        Assert.equal(min(5, 6), 5, "min(5,6)=5");
        Assert.equal(min(6, 5), 5, "min(6,5)=5");
        Assert.equal(min(5, 5), 5, "min(5,5)=5");
        Assert.equal(min(uint(-1), 0), 0, "min(max_uint, 0)=0");
        Assert.equal(min(0, uint(-1)), 0, "min(0, max_uint)=0");
        Assert.equal(min(0, 0), 0, "min(0,0)=0");
        Assert.equal(min(uint(-1), uint(-1)), uint(-1), "min(max_uint, max_uint)=max_uint");
    }

}