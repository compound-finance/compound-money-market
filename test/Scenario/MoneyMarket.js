"use strict";

const {getContract} = require('../Contract');
const MoneyMarket = getContract("./test/MoneyMarketScenario.sol");
const PriceOracle = getContract("./test/PriceOracleHarness.sol");

async function buildMoneyMarket(root, priceOracle) {
  const moneyMarket = await MoneyMarket.new().send({from: root});
  await moneyMarket.methods._setOracle(priceOracle._address).send({from: root});

  // TODO: Should we set default origination fee here?

  return {
    _address: moneyMarket._address,
    name: 'MoneyMarket',
    methods: moneyMarket.methods
  };
}

async function buildPriceOracle(root) {
  const priceOracle = await PriceOracle.new().send({from: root});

  // TODO: Should we set default origination fee here?

  return {
    _address: priceOracle._address,
    name: 'PriceOracle',
    methods: priceOracle.methods
  };
}

module.exports = {
  buildMoneyMarket,
  buildPriceOracle
};
