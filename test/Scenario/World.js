"use strict";

const Action = require('./Action');
const Immutable = require('seamless-immutable');
const {buildMoneyMarket, buildPriceOracle} = require('./MoneyMarket');
const {ErrorEnumInv, FailureInfoEnumInv} = require('../ErrorReporter');
const BigNumber = require('bignumber.js');

const accountMap = {
  "root": 0,
  "Bank": 1,
  "Geoff": 2,
  "Torrey": 3,
  "Robert": 4
};

const startingBlockNumber = 1000;

function getUser(world, userArg) {
  const accountIndex = accountMap[userArg];

  if (accountIndex == undefined) {
    throw new Error(`Encountered unknown user: ${userArg}`);
  }

  return world.accounts[accountIndex];
}

function getToken(world, tokenArg) {
  return Immutable.getIn(
    world,
    ['tokens', tokenArg]
  );
}

function getAmount(world, amountArg) {
  if (amountArg === "MAX") {
    return new BigNumber(-1);
  } else {
    const number = new BigNumber(amountArg);

    if (number === NaN) {
      throw new Error(`Encountered invalid number: ${amountArg}`);
    } else {
      return number;
    }
  }
}

async function initWorld(accounts) {
  const priceOracle = await buildPriceOracle(accounts[0]);
  const moneyMarket = await buildMoneyMarket(accounts[0], priceOracle);

  await moneyMarket.methods.setBlockNumber(startingBlockNumber).send({from: accounts[0]});

  return Immutable({
      isWorld: true,
      actions: [],
      lastResult: undefined,
      lastTx: undefined,
      lastError: undefined,
      moneyMarket: moneyMarket,
      priceOracle: priceOracle,
      accounts: accounts,
      tokens: {},
      blockNumber: startingBlockNumber // starting block number
  });
}

function addAction(world, log, result, tx=null, error=null, resultIsError=false) {
  let resultMessage;

  if (resultIsError) {
    resultMessage = `Error.${ErrorEnumInv[result]}`
  } else {
    resultMessage = result;
  }

  const worldWithAction = Immutable.update(
    world,
    'actions',
    (actions) => actions.concat([new Action(log, resultMessage)])
  );

  let lastError = undefined;

  if (error) {
    lastError = { success: false, thrownError: error };
  } else if (tx) {
    const log = tx.events["Failure"];

    if (log) {
      lastError = {
        success: false,
        error: ErrorEnumInv[log.returnValues[0]],
        info: FailureInfoEnumInv[log.returnValues[1]],
        detail: Number(log.returnValues[2])
      };
    }
  }

  if (!lastError) {
    lastError = { success: true };
  }

  return Immutable.merge(
    worldWithAction,
    {
      lastResult: result,
      lastTx: tx,
      lastError: lastError
    }
  );
}

module.exports = {
  getAmount,
  getToken,
  getUser,
  initWorld,
  addAction
};
