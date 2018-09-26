"use strict";

const fs = require('fs');
const path = require('path');
const Immutable = require('seamless-immutable');
const Web3_ = require('web3');
const web3_ = new Web3_(web3.currentProvider);

function getNetworkFile(network, extra="") {
  return path.join(__dirname, '..', '..', 'networks', `${network}${extra}.json`);
}

function getBuildFile(contractName) {
  return path.join(__dirname, '..', '..', 'build_', 'contracts', `${contractName}.json`);
}

function loadNetworkConfig(network, extra="") {
  const networkFile = getNetworkFile(network, extra);
  let contents = "{}"; // default

  try {
    contents = fs.readFileSync(networkFile, 'UTF8');
  } catch (e) {
    // File read error, ignore
  }

  return Immutable(JSON.parse(contents));
}

const network = process.env["NETWORK"];

if (!network) {
  throw "NETWORK env var must be set";
}

async function buildConfig() {
  const config = loadNetworkConfig(network);
  const networkAbi = loadNetworkConfig(network, "-abi");
  const networkId = await web3_.eth.net.getId();

  const contracts = {};

  Object.entries(networkAbi).forEach(([contractName, abi]) => {
    const contract = contracts[contractName] || {networks: {}};
    const contractAddress = config[contractName];

    contract.contractName = contractName;
    if (contractAddress) {
      contract.networks[networkId] = { address: contractAddress };
    }

    contract.abi = abi;

    contracts[contractName] = contract;
  });

  Object.entries(contracts).forEach(([contractName, contractConfig]) => {
    const contractFile = getBuildFile(contractName);

    fs.writeFileSync(contractFile, JSON.stringify(contractConfig, null, 4));
  });
}

module.exports = buildConfig;
