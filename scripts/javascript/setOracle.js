"use strict";

const {load} = require('./deployUtils');

const MoneyMarket = artifacts.require("./MoneyMarket.sol");
const Immutable = require('seamless-immutable');

const network = process.env["NETWORK"];
if (!network) {
  throw "NETWORK env var must be set";
}

async function setOracle() {
  const config = load(network);

  const moneyMarketAddress = Immutable.getIn(config, ["Contracts", "MoneyMarket"]);
  if (!moneyMarketAddress) {
    throw `No MoneyMarket address stored for network: ${network}`;
  }

  const oracleAddress = process.env["ORACLE_ADDRESS"] || Immutable.getIn(config, ["Contracts", "PriceOracle"]);
  if (!oracleAddress) {
    throw "ORACLE_ADDRESS env var must be set";
  }

  console.log(`Setting oracle to ${oracleAddress}...`);
  const moneyMarket = MoneyMarket.at(moneyMarketAddress);

  const result = await moneyMarket._setOracle(oracleAddress);
  const error = result.logs.find((log) => log.event == "Failure");
  const log = result.logs.find((log) => log.event == "NewOracle");

  if (error) {
    throw `ErrorReporter Failure: Error=${error.args.error} Info=${error.args.info} Detail=${error.args.detail}`;
  }

  if (!log) {
    throw `Could not find log "NewOracle" in result logs [${result.logs.map((log) => log.event).join(',')}]`
  }

  console.log(`Setting oracle to ${oracleAddress} succeeded.`);

}

module.exports = setOracle;
