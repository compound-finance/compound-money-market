"use strict";

const Immutable = require('seamless-immutable');
const {deployNew, load, save} = require('./deployUtils');

const FaucetToken = artifacts.require("./FaucetToken.sol");
const FaucetNonStandardToken = artifacts.require("./FaucetNonStandardToken.sol");
const WrappedEther = artifacts.require("./WrappedEther.sol");

const network = process.env["NETWORK"];
const defaultAllocation = '1000000000000000000000000000000';
const tokens = [
  {name: "0x Protocol", symbol: "ZRX", decimals: 18, price: 0.001599},
  {name: "Basic Attention Token", symbol: "BAT", decimals: 18, price: 0.000571},
  {name: "Augur", symbol: "REP", decimals: 18, contract: FaucetNonStandardToken, price: 0.000571},
  {name: "TrueUSD", symbol: "TUSD", decimals: 18, price: 0.000571},
  {name: "Wrapped Ether", symbol: "WETH", decimals: 18, contract: WrappedEther, price: 1},
];

if (!network) {
  throw "NETWORK env var must be set";
}

async function doDeploy() {
  const config = load(network);
  const configTokens = Immutable.getIn(config, ["Tokens"]) || {};

  // We will deploy tokens for development
  for (let token of tokens) {
    if (!configTokens[token.symbol]) {
      const contract = token.contract || FaucetToken;
      delete token['contract'];

      const deployed = await deployNew(network, contract, [defaultAllocation, token.name, token.decimals, token.symbol], false, true, ` ${token.name}`);

      save(network, ["Tokens", token.symbol], {
        ...token,
        address: deployed.address
      });
    }
  }
};

module.exports = doDeploy;