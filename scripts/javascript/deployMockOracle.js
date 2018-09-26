"use strict";

const Immutable = require('seamless-immutable');
const {deployNew, load, save} = require('./deployUtils');

const FixedPriceOracle = artifacts.require("./FixedPriceOracle.sol");

const network = process.env["NETWORK"];

if (!network) {
  throw "NETWORK env var must be set";
}

async function doDeploy() {
  await deployNew(network, FixedPriceOracle, [], true, true, "", "PriceOracle");
};

module.exports = doDeploy;