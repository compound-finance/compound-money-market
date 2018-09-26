"use strict";

const web3_ = require('./Web3');

// Wraps a contract in our new web3 1.0 truffle contract
function getContract(contractName) {
  const c = artifacts.require(contractName);

  // Switch for now on coverage or not
  let opts;

  if (process.env.SOLIDITY_COVERAGE) {
    opts = {gas: 0xfffffffffff, gasPrice: 1};
  } else {
    opts = {gas: 6700000, gasPrice: 20000};
  }

  const contract = new web3_.eth.Contract(c._json.abi, null, opts);
  contract.new = (...args) => contract.deploy({data: c._json.bytecode, arguments: args});
  // contract.setProvider(web3.currentProvider);

  return contract;
}

function fallback(contract, params) {
  return new Promise((resolve, reject) => {
    web3_.eth.sendTransaction(Object.assign(params, {to: contract._address}), (error, hash) => {
      if (error) {
        reject(error);
      } else {
        resolve(hash);
      }
    });
  });
}

async function getResult(promise) {
  const [result, err] = await promise;

  if (err) {
    throw err;
  } else {
    return result;
  }
}

async function readContract(contract, fun, args, params, asNumber=false) {
  return await contract.methods[fun](...args).call(params).then((result) => {
    let decodedResult;

    if (asNumber) {
      decodedResult = Number(result);
    } else {
      decodedResult = result;
    }

    return [decodedResult, null];
  }).catch((err) => {
    return [null, new Error(`Error reading ${contract.name}.${fun}(${JSON.stringify(args)}): ${err}`)];
  });
}

async function execContract(contract, fun, args, params) {
  // https://web3js.readthedocs.io/en/1.0/web3-eth-contract.html#methods-mymethod-send
  return await contract.methods[fun](...args).send(params).on("transactionHash", (trxHash) => {
    // console.log(["Exec Transaction Hash", trxHash]);
  }).then((result) => {
    return [result, null];
  }).catch((err) => {
    return [null, new Error(`Error executing ${contract.name}.${fun}(${JSON.stringify(args)}): ${err}`)];
  });
}

async function readAndExecContract(contract, fun, args, params, asNumber=false) {
  const [result, resultError] = await readContract(contract, fun, args, params, asNumber);
  const [tx, txError] = await execContract(contract, fun, args, params);

  return [result, tx, resultError || txError];
}

module.exports = {
  execContract,
  fallback,
  getContract,
  getResult,
  readAndExecContract,
  readContract,
};
