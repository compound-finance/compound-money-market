"use strict";

const WalletProvider = require("truffle-wallet-provider");
const Wallet = require('ethereumjs-wallet');
const fs = require('fs');
const path = require('path');

const networks = ["rinkeby", "kovan", "ropsten", "mainnet"];

const infuraNetworks = networks.reduce((networks, network) => {
  const envVarName = `${network.toUpperCase()}_PRIVATE_KEY`
  let privateKeyHex = process.env[envVarName];
  const networksHome = process.env['ETHEREUM_NETWORKS_HOME'];

  if (networksHome && !privateKeyHex) {
    try {
      // Try to read from file
      const networkPathResolved = path.join(fs.realpathSync(networksHome), network);
      privateKeyHex = fs.readFileSync(networkPathResolved, 'UTF8').trim();
    } catch (e) {
      // File does not exist or is inaccessible
    }
  }

  if (privateKeyHex) {
    const privateKey = Buffer.from(privateKeyHex, "hex")
    const wallet = Wallet.fromPrivateKey(privateKey);
    const provider = new WalletProvider(wallet, `https://${network}.infura.io/`);

    return {
      ...networks,
      [network]: {
        host: "localhost",
        port: 8545,
        network_id: "*",
        gas: 6600000,
        gasPrice: 15000000000, // 15 gwei
        provider,
      }
    };
  } else {
    return networks;
  }
}, {});

let mochaOptions = {};

if (process.env.SOLIDITY_COVERAGE) {
  mochaOptions = {
    enableTimeouts: false,
    grep: /@gas/,
    invert: true
  };
}

module.exports = {
  networks: {
    ...infuraNetworks,
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*",
      // TODO: Use `test` instead and change back to 4600000
      gas: 6600000,
      gasPrice: 20000,
    },
    // See example coverage settings at https://github.com/sc-forks/solidity-coverage
    coverage: {
      host: "localhost",
      network_id: "*",
      gas: 0xfffffffffff,
      gasPrice: 0x01,
      port: 8555
    },
    test: {
      host: "localhost",
      port: 8545,
      network_id: "*",
      gas: 6721975,
      gasPrice: 1
    }
  },
  solc: {
    optimizer: {
      enabled: true
    }
  },
  mocha: mochaOptions,
  contracts_build_directory: process.env.CONTRACTS_BUILD_DIRECTORY || undefined
};
