pragma solidity ^0.4.24;

import "./StandardToken.sol";

/**
  * @title The Compound Wrapped Ether Test Token
  * @author Compound
  * @notice A simple test token to wrap ether
  */
contract WrappedEther is StandardToken {
    string public name;
    string public symbol;
    uint8 public decimals;

    constructor(uint256 _initialAmount, string _tokenName, uint8 _decimalUnits, string _tokenSymbol) public {
        _initialAmount; // Ignore initial comment
        name = _tokenName;
        symbol = _tokenSymbol;
        decimals = _decimalUnits;
    }

    /**
      * @dev Send ether to get tokens
      */
    function deposit() public payable {
        balances[msg.sender] += msg.value;
        totalSupply_ += msg.value;
        emit Transfer(address(this), msg.sender, msg.value);
    }

    /**
      * @dev Withdraw tokens as ether
      */
    function withdraw(uint amount) public {
        require(balances[msg.sender] >= amount);
        balances[msg.sender] -= amount;
        totalSupply_ -= amount;
        msg.sender.transfer(amount);
        emit Transfer(msg.sender, address(this), amount);
    }
}
