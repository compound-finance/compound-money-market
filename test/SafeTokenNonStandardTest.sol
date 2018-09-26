pragma solidity ^0.4.24;

import "truffle/Assert.sol";
import "./AssertHelpers.sol";
import "./EIP20NonStandardReturnHarness.sol";
import "./AddressGenerator.sol";
import "../contracts/SafeToken.sol";
import "../contracts/ErrorReporter.sol";

contract SafeTokenNonStandardTest is SafeToken, AssertHelpers, EIP20NonStandardReturnHarness, AddressGenerator {

    constructor() EIP20NonStandardReturnHarness(0, "test", 18, "test") public {}

    function testCheckTransferIn_FailsWithInsufficientApproval() public {
        address token = address(this);
        address customer = nextAddress();

        Error err = checkTransferIn(token, customer, 5);

        assertError(err, Error.TOKEN_INSUFFICIENT_ALLOWANCE, "should fail with insufficient allowance");
    }

    function testCheckTransferIn_FailsWithInsufficientBalance() public {
        // This test contract is serving as both the ERC-20 token AND the contract requesting a transfer from customer.
        // Using separate variables to track those concepts to help with clarity.
        address token = address(this);
        address spender = address(this);

        address customer = nextAddress();

        allowed[customer][spender] = 6;

        Error err = checkTransferIn(token, customer, 5);

        assertError(err, Error.TOKEN_INSUFFICIENT_BALANCE, "should fail with insufficient balance");
    }

    function testCheckTransferIn_SuccessWithSufficientApprovalAndBalance() public {
        // This test contract is serving as both the ERC-20 token AND the contract requesting a transfer from customer.
        // Using separate variables to track those concepts to help with clarity.
        address token = address(this);
        address spender = address(this);

        address customer = nextAddress();

        allowed[customer][spender] = 6;
        balances[customer] = 7;

        Error err = checkTransferIn(token, customer, 6);
        assertNoError(err);

        Assert.equal(allowed[customer][spender], 6, "should not have subtracted allowance");
        Assert.equal(balances[customer], 7, "should not have subtracted balance");
    }

    function testDoTransferIn_SucceedsWithSufficientApprovalAndBalance() public {
        // This test contract is serving as both the ERC-20 token AND the contract requesting a transfer from customer.
        // Using separate variables to track those concepts to help with clarity.
        address token = address(this);
        address spender = address(this);

        address customer = nextAddress();

        allowed[customer][spender] = 6;
        balances[customer] = 7;

        Error err = doTransferIn(token, customer, 6);
        assertNoError(err);

        Assert.equal(allowed[customer][spender], 0, "should have subtracted allowance");
        Assert.equal(balances[customer], 1, "should have subtracted balance from customer");
        Assert.equal(balances[address(this)], 6, "should have added balance to this contract");
    }

    function testDoTransferIn_FailedDueToReturnValue() public {
        // This test contract is serving as both the ERC-20 token AND the contract requesting a transfer from customer.
        // Using separate variables to track those concepts to help with clarity.
        address token = address(this);
        address spender = address(this);

        address customer = address(0); // This is a magic value that causes EIP20NonStandardReturnHarness to short-circuit in `transferFrom`

        allowed[customer][spender] = 6;
        balances[customer] = 7;
        uint spenderBalance = balances[spender];

        Error err = doTransferIn(token, customer, 5);
        // We would usually have reverted here, since there's no way to indicate an error on non-standard tokens,
        // but instead, we return nothing since we're in a harness and we want to check everything else
        assertNoError(err);

        Assert.equal(allowed[customer][spender], 6, "should not have subtracted allowance");
        Assert.equal(balances[customer], 7, "should not have subtracted balance from customer");
        Assert.equal(balances[spender], spenderBalance, "should not have added balance to this contract");
    }

    function testGetCash() public {
        address token = address(this);
        address protocol = address(this);
        address noCashAddress = nextAddress();

        balances[protocol] = 500 * 10**18;

        uint protocolCash = getCash(token);
        Assert.equal(protocolCash, 500 * 10**18, "should have returned protocol's balance");
        Assert.equal(balances[protocol], 500 * 10**18, "should not have changed protocol's balance");
        Assert.equal(balances[noCashAddress], 0, "noCashAddress was not given any tokens so should have zero balance");
    }

    function testDoTransferOut_FailsWithInsufficientCash() public {
        address token = address(this);
        address account = nextAddress();
        address recipient = nextAddress();

        balances[account] = 10;
        failTransferToAddresses[recipient] = true;

        Error err = doTransferOut(token, recipient, 10);
        // We would usually have reverted here, since there's no way to indicate an error on non-standard tokens,
        // but instead, we return nothing since we're in a harness and we want to check everything else
        assertNoError(err);

        Assert.equal(balances[account], 10, "should not have subtracted balance");
        Assert.equal(balances[recipient], 0, "should not have given balance");
    }

    function testDoTransferOut_SuccessWithSufficientCash() public {
        // This test contract is serving as both the ERC-20 token AND the contract requesting a transfer from customer.
        // Using separate variables to track those concepts to help with clarity.
        address token = address(this);
        address account = address(this);
        address recipient = nextAddress();

        balances[account] = 10;

        Error err = doTransferOut(token, recipient, 10);
        assertNoError(err);

        Assert.equal(balances[account], 0, "should have subtracted balance");
        Assert.equal(balances[recipient], 10, "should not have given balance");
    }

    function testGetBalanceOf() public {
        address token = address(this);
        address account1 = nextAddress();
        address account2 = nextAddress();
        address account3 = nextAddress();

        balances[account1] = 10;
        balances[account2] = 20;

        Assert.equal(getBalanceOf(token, account1), 10, "account1 balance");
        Assert.equal(getBalanceOf(token, account2), 20, "account2 balance");
        Assert.equal(getBalanceOf(token, account3), 0, "account3 balance");
    }

}