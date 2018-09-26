pragma solidity ^0.4.24;

/**
  * Our solidity tests are NOT running in isolation. Until we fix that, we need a reliable way to generate
  * unique addresses for certain tests without causing interference across tests.
  **/
contract AddressGenerator {

    uint public addressCounter = 1;

    function nextAddress() internal returns (address) {
        addressCounter = addressCounter + 1;
        return address(uint(address(this)) + addressCounter);
    }

}