"use strict";

const Web3_ = require('web3');
const web3_ = new Web3_(web3.currentProvider);

web3_.extend({
  property: 'evm',
  methods: [{
    name: 'mine',
    call: 'evm_mine',
    params: 0
  }]
});

module.exports = web3_;