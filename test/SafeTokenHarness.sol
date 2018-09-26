pragma solidity ^0.4.24;

import "../contracts/SafeToken.sol";

contract SafeTokenHarness is SafeToken {

    // adding the completely valid 'view' declaration to this function causes gas usage test in SafeTokenHarnessTest.js
    // to fail because the result of calling this function is 'undefined.'
    // TODO: Figure out how SafeTokenHarnessTest of checkInboundTransfer can be modified so it doesn't fail if this is declared as view
    function checkInboundTransfer(address asset, address from, uint amount) public view returns (uint256) {
        Error err = checkTransferIn(asset, from, amount);

        return uint(err);
    }

    function doInboundTransfer(address asset, address from, uint amount) public returns (uint256) {
        Error err = doTransferIn(asset, from, amount);

        return uint(err);
    }

    function doOutboundTransfer(address asset, address to, uint amount) public returns (uint256) {
        Error err = doTransferOut(asset, to, amount);

        return uint(err);
    }

}