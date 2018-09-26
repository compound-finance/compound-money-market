"use strict";

const Migrations = artifacts.require("./Migrations.sol");
const {deploy} = require('../scripts/javascript/deployUtils');

module.exports = function(deployer, network) {
  deploy(deployer, network, Migrations);
};
