"use strict";

const {getResult, readContract} = require('../Contract');
const {getAmount, getToken, getUser} = require('./World');
const BigNumber = require('bignumber.js');

BigNumber.config({ ROUNDING_MODE: 3 });

// Maps from old error messages to new ones
function mapError(message) {
  return {
    "insufficient token balance": "TOKEN_INSUFFICIENT_BALANCE",
    "insufficient supply balance": "INSUFFICIENT_BALANCE",
    "asset is not allowed": "MARKET_NOT_SUPPORTED",
    "asset is suspended": "MARKET_NOT_SUPPORTED",
    "contract has been paused": "CONTRACT_PAUSED",
    "desired action violates collateral ratio": "INSUFFICIENT_LIQUIDITY",
    "desired liquidation amount is greater than max closable amount": "INVALID_CLOSE_AMOUNT_REQUESTED"
  }[message] || message;
}

const printError = JSON.stringify; // for now

// Fails an assertion with reason
function fail(reason) {
  assert.fail(0, 1, reason);
}

async function getSupplyBalance(world, user, token) {
  return Number(await world.moneyMarket.methods.getSupplyBalance(user, token._address).call());
}

async function getBorrowBalance(world, user, token) {
  return Number(await world.moneyMarket.methods.getBorrowBalance(user, token._address).call());
}

async function getTokenBalance(world, user, token) {
  return Number(await token.methods.balanceOf(user).call());
}

async function getAccountLiquidity(world, user) {
  return Number(await world.moneyMarket.methods.getAccountLiquidity(user).call());
}

async function getCollateralRatio(world) {
  return Number(await world.moneyMarket.methods.collateralRatio().call()) / 1e18;
}

async function getMaxBorrow(world, user) {
  return (await getAccountLiquidity(world, user)) / (await getCollateralRatio(world));
}

async function getBalanceSheetSupply(world, token) {
  return Number((await world.moneyMarket.methods.markets(token._address).call()).totalSupply);
}

async function getBalanceSheetBorrow(world, token) {
  return Number((await world.moneyMarket.methods.markets(token._address).call()).totalBorrows);
}

function getSigFigs(value) {
  let str = value.toString();

  str = str.replace(/e\d+/, ''); // Remove e01
  str = str.replace(/\./, ''); // Remove decimal point

  return str.length;
}

async function getAssertionValue(world, value) {
  const [valueType, ...valueArgs] = value;

  switch (valueType) {
    case "Exactly":
      return await (async () => {
        const [value] = valueArgs;

        return getAmount(world, value);
      })();
    case "Precisely":
      return await (async () => {
        const [value] = valueArgs;

        const amount = getAmount(world, value);
        amount.precisely = getSigFigs(value);

        return amount;
      })();
    case "SupplyBalance":
      return await (async () => {
        const [user, token] = valueArgs;

        return await getSupplyBalance(world, getUser(world, user), getToken(world, token));
      })();
    case "BorrowBalance":
      return await (async () => {
        const [user, token] = valueArgs;

        return await getBorrowBalance(world, getUser(world, user), getToken(world, token));
      })();
    case "TokenBalance":
      return await (async () => {
        const [user, token] = valueArgs;

        return await getTokenBalance(world, getUser(world, user), getToken(world, token));
      })();
    case "MaxBorrow":
      return await (async () => {
        const [user] = valueArgs;

        return await getMaxBorrow(world, getUser(world, user));
      })();
    case "BalanceSheetSupply":
      return await (async () => {
        const [token] = valueArgs;

        return await getBalanceSheetSupply(world, getToken(world, token));
      })();
    case "BalanceSheetBorrow":
      return await (async () => {
        const [token] = valueArgs;

        return await getBalanceSheetBorrow(world, getToken(world, token));
      })();
    default:

      throw new Error(`Unknown assertion value type: ${valueType}`);
  }
}

async function assertEqual(world, valueGiven, valueExpected) {
  const given = await getAssertionValue(world, valueGiven);
  const expected = await getAssertionValue(world, valueExpected);

  if (expected.precisely) {
    const givenFigs = new BigNumber(given.toString()).toPrecision(expected.precisely);
    const expectedFigs = new BigNumber(expected.toString()).toPrecision(expected.precisely);

    assert.equal(givenFigs, expectedFigs, `expected ${valueGiven} to equal ${valueExpected} to ${expected.precisely} sig fig(s)`);
  } else {
    assert.equal(given, expected, `expected ${valueGiven} to equal ${valueExpected}`);
  }

  return world;
}

async function assertFailure(world, message) {
  if (world.lastError === undefined) {
    fail(`Expected failure with "${message}", but world has undefined lastError`);
  } else if (world.lastError.success) {
    // Add some global debug logs so we can trace down the trx
    console.log(["Debug Log, last transaction", world.lastTx]);
    console.log(["Debug Log, last logs", world.lastTx.logs]);

    fail(`Expected failure with "${message}", got success (${world.lastTx.tx} - ${world.lastResult})`);
  } else if (world.lastError.thrownError) {
    fail(`Expected failure with message "${mapError(message)}" but got thrown error "${world.lastError.thrownError}"`);
  } else if (world.lastError.error != mapError(message)) {
    fail(`Expected failure with message "${mapError(message)}" but got "${printError(world.lastError)}"`);
  } else {
    return world;
  }
}

async function assertSuccess(world) {
  if (world.lastError === undefined) {
    fail(`Expected success contract execution, but world has undefined lastError`);
  } else if (world.lastError.success) {
    return world;
  } else if (world.lastError.thrownError) {
    console.log(["Debug Log, actions: ", world.actions]);
    fail(`Expected successful contract execution, got thrown error: ${world.lastError.thrownError}`);
  } else {
    console.log(["Debug Log, actions: ", world.actions]);
    fail(`Expected successful contract execution, got error: ${printError(world.lastError)}`);
  }
}

async function assertLog(world, message) {
  if (world.lastTx === undefined) {
    fail(`Expected log message "${message}" from contract execution, but world has undefined lastError`);
  } else {
    assert.hasLog(world.lastTx, message, {});

    return world;
  }
}

async function checkAssertion(world, assertion) {
  const [assertionType, ...assertionArgs] = assertion;

  switch (assertionType) {
    case "Equal":
      return await (async () => {
        const [given, expected] = assertionArgs;

        return await assertEqual(world, given, expected);
      })();
    case "Failure":
      return await (async () => {
        const message = assertionArgs;

        return await assertFailure(world, message);
      })();
    case "Success":
      return await (async () => {
        return await assertSuccess(world);
      })();
    case "Log":
      return await (async () => {
        const message = assertionArgs;

        return await assertLog(world, message);
      })();
    default:

      throw new Error(`Unknown assertion type: ${assertionType}`);
  }
}

module.exports = {
  checkAssertion
};
