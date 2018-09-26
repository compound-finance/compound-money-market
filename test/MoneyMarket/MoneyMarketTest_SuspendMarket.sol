pragma solidity ^0.4.24;

import "truffle/Assert.sol";
import "./MoneyMarketTest.sol";

/*
 * @dev This tests the money market with tests for suspendMarket.
 */
contract MoneyMarketTest_SuspendMarket is MoneyMarketTest {

    function testSuspendMarket_NotAdmin() public {
        address asset = nextAddress();
        markets[asset].blockNumber = 100;
        markets[asset].isSupported = true;

        admin = address(0);

        assertError(Error.UNAUTHORIZED, Error(_suspendMarket(asset)), "requires admin rights");

        Assert.equal(markets[asset].isSupported, true, "market stays supported");
    }

    function testSuspendMarket_NotConfigured() public {
        address asset = nextAddress();
        Assert.equal(markets[asset].blockNumber, uint(0), "test setup failed; market should not be configured with a block number");
        Assert.equal(markets[asset].isSupported, false, "test setup failed; market should not be configured");

        admin = msg.sender;

        assertNoError(Error(_suspendMarket(asset)));

        Assert.equal(markets[asset].blockNumber, uint(0), "market should not be configured");
        Assert.equal(markets[asset].isSupported, false, "market stays unsupported");
    }

    function testSuspendMarket_AlreadySuspended() public {
        address asset = nextAddress();
        markets[asset].blockNumber = 100;
        markets[asset].isSupported = false;

        admin = msg.sender;

        assertNoError(Error(_suspendMarket(asset)));

        Assert.equal(markets[asset].blockNumber, uint(100), "market should remain configured");
        Assert.equal(markets[asset].isSupported, false, "market stays unsupported");
    }

    function testSuspendMarket_Success() public {
        address asset = nextAddress();
        markets[asset].blockNumber = 100;
        markets[asset].isSupported = true;

        admin = msg.sender;

        assertNoError(Error(_suspendMarket(asset)));

        Assert.equal(markets[asset].blockNumber, uint(100), "market should remain configured");
        Assert.equal(markets[asset].isSupported, false, "market no longer supported");
    }

}