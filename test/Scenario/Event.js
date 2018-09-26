"use strict";

const {getContract} = require('../Contract');
const {bigNums, getExpMantissa, range} = require('../Utils');
const FaucetTokenHarness = getContract("./FaucetToken.sol");
const FaucetTokenNonStandardHarness = getContract("./FaucetNonStandardToken.sol");
const Immutable = require('seamless-immutable');
const AlwaysFailInterestRateModel = getContract("./test/InterestRateModel/AlwaysFailInterestRateModel.sol");
const FixedInterestRateModel = getContract("./test/InterestRateModel/FixedInterestRateModel.sol");
const StandardInterestRateModel = getContract("./StandardInterestRateModel.sol");
const {addAction} = require('./World');
const {checkAssertion} = require('./Assertion');
const {getResult, execContract, readAndExecContract} = require('../Contract');
const {getAmount, getToken, getUser} = require('./World');

async function processEvents(originalWorld, events) {
  return events.reduce(async (world, event) => {
    world = await processEvent(await world, event);

    if (!world) {
      throw new Error(`Encountered null world result when processing event ${event[0]}: ${world}`);
    } else if (!world.isWorld) {
      throw new Error(`Encountered world result which was not isWorld when processing event ${event[0]}: ${world}`);
    }

    return world;
  }, Promise.resolve(originalWorld));
}

function isNonStandard(tokenName) {
  return tokenName == "OMG"; // Non-standard token!
}

async function addToken(world, tokenArg) {
  // TODO: The other params should possibly come from the scenario.
  const tokenDecimals = 18;
  const tokenName = tokenArg;
  let faucetToken;

  if (isNonStandard(tokenName)) {
    faucetToken = await FaucetTokenNonStandardHarness.new(0, tokenName, tokenDecimals, tokenArg).send({from: getUser(world, "root")});
  } else {
    faucetToken = await FaucetTokenHarness.new(0, tokenName, tokenDecimals, tokenArg).send({from: getUser(world, "root")});
  }

  // TODO: This should probably not need to give cash to the protocol, but most tests assume the protocol does have cash
  // await faucetToken.methods.allocateTo(world.moneyMarket._address, bigNums.ether.times(100)).send({from: getUser(world, "root")});

  world = Immutable.setIn(
    world,
    ['tokens', tokenArg],
    {
      _address: faucetToken._address,
      methods: faucetToken.methods,
      decimals: tokenDecimals,
      name: tokenName
    }
  );

  world = addAction(
    world,
    `Added token ${tokenName} at address ${faucetToken._address}`,
    // TODO: If this is a unmined result, then we won't have the address yet!
    // TODO: It's possible we leave the address as a promise, or like we're doing, we just expect
    //       the trx to mine.
    `${tokenName}@${faucetToken._address}`
  );

  return world;
}

async function addCash(world, token, amount) {
  let [value, tx, error] = await readAndExecContract(token, 'allocateTo', [world.moneyMarket._address, amount], {from: getUser(world, "root")});

  world = addAction(
    world,
    `Added ${amount} cash for token ${token.name}`,
    value,
    tx,
    error
  );

  return world;
}

async function addSupportedAsset(world, token) {
  // TODO: We should actually make this scenario event pass in an interest rate model and price
  const interestRateModel = await AlwaysFailInterestRateModel.new().send({from: getUser(world, "root")});
  // Need to set non-zero price before supporting.
  let [value, tx, error] = await readAndExecContract(world.moneyMarket, '_supportMarket', [token._address, interestRateModel._address], {from: getUser(world, "root")});

  world = addAction(
    world,
    `Added supported asset ${token.name}`,
    value,
    tx,
    error,
    true
  );

  return world;
}

async function suspendAsset(world, token) {
  let [value, tx, error] = await readAndExecContract(world.moneyMarket, '_suspendMarket', [token._address], {from: getUser(world, "root")});

  world = addAction(
    world,
    `Suspended asset ${token.name}`,
    value,
    tx,
    error,
    true
  );

  return world;
}

async function setAssetValue(world, token, amount) {
  let [value, tx, error] = await readAndExecContract(world.priceOracle, 'harnessSetAssetPrice', [token._address, getExpMantissa(amount)], {from: getUser(world, "root")});

  world = addAction(
    world,
    `Set asset ${token.name} value to ${amount}`,
    value,
    tx,
    error
  );

  return world;
}

async function approve(world, user, token, amount) {
  let [value, tx, error] = await readAndExecContract(token, 'approve', [world.moneyMarket._address, amount], {from: user});

  world = addAction(
    world,
    `Approved ${token.name} token for ${user} of ${amount}`,
    value,
    tx,
    error
  );

  return world;
}

async function faucet(world, user, token, amount) {
  let [value, tx, error] = await readAndExecContract(token, 'allocateTo', [user, amount], {from: getUser(world, "root")});

  world = addAction(
    world,
    `Fauceted ${amount} tokens to ${user}`,
    value,
    tx,
    error
  );

  return world;
}

async function supply(world, user, token, amount) {
  let [value, tx, error] = await readAndExecContract(world.moneyMarket, 'supply', [token._address, amount], {gas: 1000000, from: user});

  world = addAction(
    world,
    `Supplied token ${token.name} for ${amount}`,
    value,
    tx,
    error,
    true
  );

  return world;
}

async function withdraw(world, user, token, amount) {
  let [value, tx, error] = await readAndExecContract(world.moneyMarket, 'withdraw', [token._address, amount], {from: user});

  world = addAction(
    world,
    `Withdrew ${amount} of token ${token.name}`,
    value,
    tx,
    error,
    true
  );

  return world;
}

async function borrow(world, user, token, amount) {
  let [value, tx, error] = await readAndExecContract(world.moneyMarket, 'borrow', [token._address, amount], {from: user});

  world = addAction(
    world,
    `Borrowed token ${token.name} for ${amount}`,
    value,
    tx,
    error,
    true
  );

  return world;
}

async function repayBorrow(world, user, token, amount) {
  let [value, tx, error] = await readAndExecContract(world.moneyMarket, 'repayBorrow', [token._address, amount], {from: user});

  world = addAction(
    world,
    `Repaid borrow of token ${token.name} for ${amount}`,
    value,
    tx,
    error,
    true
  );

  return world;
}

async function liquidateBorrow(world, liquidator, targetAccount, assetBorrow, assetCollateral, requestedAmountClose) {
  let [value, tx, error] = await readAndExecContract(world.moneyMarket, 'liquidateBorrow',
      [targetAccount, assetBorrow._address, assetCollateral._address, requestedAmountClose], {from: liquidator});

  world = addAction(
    world,
    `Liquidated borrow of ${requestedAmountClose} ${assetBorrow.name} in exchange for ${assetCollateral.name} `,
    value,
    tx,
    error,
    true
  );

  return world;
}

async function fastForward(world, blocks) {
  world = Immutable.update(world, 'blockNumber', (blockNumber) => blockNumber + blocks);

  let [value, tx, error] = await readAndExecContract(world.moneyMarket, 'setBlockNumber', [world.blockNumber], {from: getUser(world, "root")});

  world = addAction(
    world,
    `Fast forwarded ${blocks} block(s).`,
    value,
    tx,
    error
  );

  return world;
}

async function setInterestRate(world, token, interestRateArg) {
  const [interestRateType, ...interestRateVal] = interestRateArg;
  let interestModel;
  let interestRateDescription;

  switch (interestRateType) {
    case "FixedRate":
      const [supplyInterestRate, borrowInterestRate] = interestRateVal;
      const supplyInterestRateScaled = Math.trunc(supplyInterestRate * 1e18);
      const borrowInterestRateScaled = Math.trunc(borrowInterestRate * 1e18);
      interestRateDescription = `fixed ${(supplyInterestRate * 100)}% / ${(borrowInterestRate * 100)}%`;

      interestModel = await FixedInterestRateModel.new(supplyInterestRateScaled, borrowInterestRateScaled).send({from: getUser(world, "root")});

      break;
    case "WhitepaperRate":
      interestModel = await StandardInterestRateModel.new().send({from: getUser(world, "root")});
      interestRateDescription = "whitepaper interest rate";

      break;
    default:

      throw new Error(`Unknown interest rate type: ${interestRateType}`);
  }

  let [value, tx, error] = await readAndExecContract(world.moneyMarket, '_setMarketInterestRateModel', [token._address, interestModel._address], {from: getUser(world, "root")});

  world = addAction(
    world,
    `Set interest rate for ${token.name} to ${interestRateDescription}`,
    value,
    tx,
    error,
    true
  );

  return world;
}

async function setOriginationFee(world, fee) {
  let [value, tx, error] = await readAndExecContract(world.moneyMarket, '_setOriginationFee', [getExpMantissa(fee)], {from: getUser(world, "root")});

  world = addAction(
    world,
    `Set origination fee to ${fee}`,
    value,
    tx,
    error,
    true
  );

  return world;
}

async function setRiskParameters(world, ratio, discount) {
  let [value, tx, error] = await readAndExecContract(world.moneyMarket, '_setRiskParameters', [getExpMantissa(ratio), getExpMantissa(discount)], {from: getUser(world, "root")});

  world = addAction(
    world,
    `Set collateral ratio to ${ratio} and liquidation discount to ${discount}`,
    value,
    tx,
    error,
    true
  );

  return world;
}

async function setPaused(world, newState) {
  let [value, tx, error] = await readAndExecContract(world.moneyMarket, '_setPaused', [newState], {from: getUser(world, "root")});

  world = addAction(
    world,
    `Set paused to ${newState}`,
    value,
    tx,
    error,
    true
  );

  return world;
}

async function inspect(world, string) {
  if (string !== undefined) {
    console.log(["Inspect", string, world]);
  } else {
    console.log(["Inspect", world]);
  }

  return world;
}

async function processEvent(world, event) {
  const [eventType, ...args] = event;

  // Note: these are all wrapped in immediately invoked functions to prevent leakage of variable bindings between cases.
  switch (eventType) {
    case "AddToken":
      return await (async () => {
        let [tokenArg] = args;

        return await addToken(world, tokenArg);
      })();
    case "AddCash":
      return await (async () => {
        let [tokenArg, amountArg] = args;

        return await addCash(world, getToken(world, tokenArg), getAmount(world, amountArg));
      })();
    case "AddSupportedAsset":
      return await (async () => {
        let [tokenArg] = args;

        return await addSupportedAsset(world, getToken(world, tokenArg));
      })();
    case "SuspendAsset":
      return await (async () => {
        let [tokenArg] = args;

        return await suspendAsset(world, getToken(world, tokenArg));
      })();
    case "Approve":
      return await (async () => {
        let [userArg, tokenArg, amountArg] = args;

        return await approve(world, getUser(world, userArg), getToken(world, tokenArg), getAmount(world, amountArg));
      })();
    case "Faucet":
      return await (async () => {
        let [userArg, tokenArg, amountArg] = args;

        return await faucet(world, getUser(world, userArg), getToken(world, tokenArg), getAmount(world, amountArg));
      })();
    case "Supply":
      return await (async () => {
        let [userArg, tokenArg, amountArg] = args;

        return await supply(world, getUser(world, userArg), getToken(world, tokenArg), getAmount(world, amountArg));
      })();
    case "Withdraw":
      return await (async () => {
        let [userArg, tokenArg, amountArg] = args;

        return await withdraw(world, getUser(world, userArg), getToken(world, tokenArg), getAmount(world, amountArg));
      })();
    case "Borrow":
      return await (async () => {
        let [userArg, tokenArg, amountArg] = args;

        return await borrow(world, getUser(world, userArg), getToken(world, tokenArg), getAmount(world, amountArg));
      })();
    case "PayBorrow":
      return await (async () => {
        let [userArg, tokenArg, amountArg] = args;

        return await repayBorrow(world, getUser(world, userArg), getToken(world, tokenArg), getAmount(world, amountArg));
      })();
    case "Liquidate":
      return await (async () => {
        let [liquidatorArg, targetUserArg, assetBorrowArg, closeAmountArg, assetCollateralArg] = args;

        return await liquidateBorrow(world, getUser(world, liquidatorArg), getUser(world, targetUserArg), getToken(world, assetBorrowArg), getToken(world, assetCollateralArg), getAmount(world, closeAmountArg));
      })();
    case "Assert":
      return await (async () => {
        let [assertionArg] = args;

        return await checkAssertion(world, assertionArg);
      })();
    case "FastForward":
      return await (async () => {
        let [blocks, _fastForwardBlocksKeyword] = args;

        return await fastForward(world, blocks);
      })();
    case "SetAssetValue":
      return await (async () => {
        let [tokenArg, amountArg] = args;

        return await setAssetValue(world, getToken(world, tokenArg), getAmount(world, amountArg));
      })();
    case "SetInterestRate":
      return await (async () => {
        let [tokenArg, interestRateArg] = args;

        return await setInterestRate(world, getToken(world, tokenArg), interestRateArg);
      })();
    case "SetOriginationFee":
      return await (async () => {
        let [fee] = args;

        return await setOriginationFee(world, Number(fee));
      })();
    case "SetCollateralRatio":
      return await (async () => {
        let [ratio] = args;

        return await setRiskParameters(world, Number(ratio), 0);
      })();
    case "SetPaused":
      return await (async () => {
        let [newState] = args;

        return await setPaused(world, newState);
      })();
    case "Inspect":
      return await (async () => {
        return await inspect(world, null);
      })();
    case "Debug":
      return await (async () => {
        let [message] = args;

        return await inspect(world, message);
      })();
    default:

      throw new Error(`Unknown event type: ${eventType}`);
  }
}

module.exports = {
	processEvents
};
