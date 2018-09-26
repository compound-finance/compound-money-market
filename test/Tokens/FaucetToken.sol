pragma solidity ^0.4.24;

import "./StandardToken.sol";

/**
  * @title The Compound Faucet Test Token
  * @author Compound
  * @notice A simple test token that lets anyone get more of it.
  */
contract FaucetToken is StandardToken {
    string public name;
    string public symbol;
    uint8 public decimals;

    constructor(uint256 _initialAmount, string _tokenName, uint8 _decimalUnits, string _tokenSymbol) public {
        totalSupply_ = _initialAmount;
        balances[msg.sender] = _initialAmount;
        name = _tokenName;
        symbol = _tokenSymbol;
        decimals = _decimalUnits;
    }

    /**
      * @dev Arbitrarily adds tokens to any account
      */
    function allocateTo(address _owner, uint256 value) public {
        balances[_owner] += value;
        totalSupply_ += value;
        emit Transfer(address(this), _owner, value);
    }
}
