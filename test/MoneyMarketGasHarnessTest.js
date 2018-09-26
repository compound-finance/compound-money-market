"use strict";

const {assets, gas} = require('./Utils');
const {getContract} = require('./Contract');
const MoneyMarketGasHarness = getContract("./test/MoneyMarketGasHarness.sol");

contract('MoneyMarketGasHarness', function([root, ...accounts]) {

  // TODO: Get these bounds on gas price a bit tighter.
  // Current investigation sees that each external variable is costing about 1,000 gas which is probably due to ABI decoding.
  describe("harnessSetAccountSupplyBalance", async () => {
    it("stores a balance for about the cost of two words stored @gas", async () => {
      const moneyMarketHarness = await MoneyMarketGasHarness.new().send({from: root});

      const account = accounts[0];
      const asset = assets.OMG;
      const principal = 55;
      const interestIndex = 100;
      const first = await moneyMarketHarness.methods.harnessSetAccountSupplyBalance(account, asset, principal, interestIndex).send({from: root});

      assert.withinGas(first, 2 * gas.storage_new, 5000, "should cost about two word stores");

      const second = await moneyMarketHarness.methods.harnessSetAccountSupplyBalance(account, asset, principal + 1, interestIndex + 1).send({from: root});

      assert.withinGas(second, 2 * gas.storage_update, 5000, "should cost about two word updates");
    });
  });

  describe("harnessSupportMarket", async () => {
    it("stores a market support for about the cost of one word stored @gas", async () => {
      const moneyMarketHarness = await MoneyMarketGasHarness.new().send({from: root});

      const asset = assets.OMG;
      const first = await moneyMarketHarness.methods.harnessSupportMarket(asset).send({from: root});

      assert.withinGas(first, gas.storage_new, 5000, "should cost about one word store");

      const second = await moneyMarketHarness.methods.harnessSupportMarket(asset).send({from: root});

      assert.withinGas(second, gas.storage_update, 5000, "should cost about one word update");
    });
  });

  describe("harnessSetMarketDetails", async () => {
    it("stores market details for about the cost of seven words stored @gas", async () => {
      const moneyMarketHarness = await MoneyMarketGasHarness.new().send({from: root});

      const asset = assets.OMG;
      const totalSupply = 1;
      const supplyRateBasisPoints = 2;
      const supplyIndex = 3;
      const totalBorrows = 4;
      const borrowRateBasisPoints = 5;
      const borrowIndex = 6;

      const first = await moneyMarketHarness.methods.harnessSetMarketDetails(asset, totalSupply, supplyRateBasisPoints, supplyIndex, totalBorrows, borrowRateBasisPoints, borrowIndex).send({from: root});

      // TODO: Why did this increase?
      assert.withinGas(first, 7 * gas.storage_new, 6000, "should cost about seven words stored");

      const second = await moneyMarketHarness.methods.harnessSetMarketDetails(asset, totalSupply, supplyRateBasisPoints, supplyIndex, totalBorrows, borrowRateBasisPoints, borrowIndex).send({from: root});

      // TODO: Why did this increase?
      assert.withinGas(second, 7 * gas.storage_update, 6000, "should cost about seven word updates");
    });
  });

  describe('harnessSetAccountSupplyBalanceAndMarketDetails', async () => {
    it("stores market details and supply balance for about nine words stored @gas", async () => {
      const moneyMarketHarness = await MoneyMarketGasHarness.new().send({from: root});

      const account = accounts[0];
      const principal = 55;
      const interestIndex = 100;
      const asset = assets.OMG;
      const totalSupply = 1;
      const supplyRateBasisPoints = 2;
      const supplyIndex = 3;
      const totalBorrows = 4;
      const borrowRateBasisPoints = 5;
      const borrowIndex = 6;

      const first = await moneyMarketHarness.methods.harnessSetAccountSupplyBalanceAndMarketDetails(account, asset, principal, interestIndex, totalSupply, supplyRateBasisPoints, supplyIndex, totalBorrows, borrowRateBasisPoints, borrowIndex).send({from: root});

      assert.withinGas(first, 9 * gas.storage_new, 12000, "should cost about seven words stored");

      const second = await moneyMarketHarness.methods.harnessSetAccountSupplyBalanceAndMarketDetails(account, asset, principal, interestIndex, totalSupply, supplyRateBasisPoints, supplyIndex, totalBorrows, borrowRateBasisPoints, borrowIndex).send({from: root});

      assert.withinGas(second, 9 * gas.storage_update, 8000, "should cost about seven words stored");
    });
  });

  describe('harnessReadAndSetAccountSupplyBalanceAndMarketDetails', async () => {
    it("stores market details and supply balance for about nine words stored @gas", async () => {
      const moneyMarketHarness = await MoneyMarketGasHarness.new().send({from: root});

      const account = accounts[0];
      const principal = 55;
      const interestIndex = 100;
      const asset = assets.OMG;
      const totalSupply = 1;
      const supplyRateBasisPoints = 2;
      const supplyIndex = 3;
      const totalBorrows = 4;
      const borrowRateBasisPoints = 5;
      const borrowIndex = 6;

      const first = await moneyMarketHarness.methods.harnessReadAndSetAccountSupplyBalanceAndMarketDetails(account, asset, principal, interestIndex, totalSupply, supplyRateBasisPoints, supplyIndex, totalBorrows, borrowRateBasisPoints, borrowIndex).send({from: root});

      assert.withinGas(first, 9 * (gas.storage_new + gas.storage_read), 9000, "should cost about nine words stored and read");

      const second = await moneyMarketHarness.methods.harnessReadAndSetAccountSupplyBalanceAndMarketDetails(account, asset, principal, interestIndex, totalSupply, supplyRateBasisPoints, supplyIndex, totalBorrows, borrowRateBasisPoints, borrowIndex).send({from: root});

      // Currently `75891` gas
      assert.withinGas(second, 9 * (gas.storage_update + gas.storage_read), 9000, "should cost about nine words stored and read");
    });
  });

  describe('harnessCalculateInterestIndex', async () => {
    it('uses a small amount of gas @gas', async () => {
      const moneyMarketHarness = await MoneyMarketGasHarness.new().send({from: root});

      const first = await moneyMarketHarness.methods.harnessCalculateInterestIndex(1e18, 1000, 50).send({from: root});

      assert.gasLessThan(first, 5000, "should be a fairly low total gas cost");
    });
  });

});