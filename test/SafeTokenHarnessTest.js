"use strict";

const {gas} = require('./Utils');
const {getContract} = require('./Contract');
const EIP20 = getContract("./test/EIP20Harness.sol");
const EIP20NonCompliant = getContract("./test/EIP20NonCompliantHarness.sol");
const SafeTokenHarness = getContract("./test/SafeTokenHarness.sol");

contract('SafeTokenHarness', function([root, ...accounts]) {

  describe("#checkInboundTransfer", async () => {
    it("abides by sane gas limits @gas", async () => {
      const safeTokenHarness = await SafeTokenHarness.new().send({from: root});
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Transfer token (e.g. via ICO) to some account, say account 1
      // TODO: Maybe set a default on gas?
      await OMG.methods.transfer(accounts[1], 100).send({gas: 1000000, from: root});

      // Account 1 now approves our Money Market (SafeTokenHarness) to spend its value
      await OMG.methods.approve(safeTokenHarness._address, 100).send({from: accounts[1]});

      // Since its now approved, let's let some random caller (account 2) check for a valid transfer via our exposed "checkInboundTransfer" function
      const first = await safeTokenHarness.methods.checkInboundTransfer(OMG._address, accounts[1], 80).send({from: accounts[2]});

      const estimatedExternalCallCost = 2500;
      const unknownCost = 5000; // Unknown extra gas, possibly because of ABI encoding

      assert.withinGas(first,
        ( 5 * gas.storage_read ) +
        ( 2 * estimatedExternalCallCost ) +
        unknownCost, 5000, "should cost about 5 reads");
    });
  });

  describe("#doInboundTransfer", async () => {
    it("abides by sane gas limits @gas", async () => {
      const safeTokenHarness = await SafeTokenHarness.new().send({from: root});
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Transfer token (e.g. via ICO) to some account, say account 1
      // TODO: Maybe set a default on gas?
      await OMG.methods.transfer(accounts[1], 100).send({gas: 1000000, from: root});

      // Account 1 now approves our Money Market (SafeTokenHarness) to spend its value
      await OMG.methods.approve(safeTokenHarness._address, 100).send({from: accounts[1]});

      // Since its now approved, let's let some random caller (account 2) transfer it via our exposed "safeTransfer" function
      const first = await safeTokenHarness.methods.doInboundTransfer(OMG._address, accounts[1], 80).send({from: accounts[2]});

      // Perform a second transfer
      const second = await safeTokenHarness.methods.doInboundTransfer(OMG._address, accounts[1], 10).send({from: accounts[2]});

      // Account 1 now approves our Money Market (SafeTokenHarness) to spend all its value (which does not need to be updated since it stays -1)
      await OMG.methods.approve(safeTokenHarness._address, -1).send({from: accounts[1]});

      // Perform a third transfer
      const third = await safeTokenHarness.methods.doInboundTransfer(OMG._address, accounts[1], 1).send({from: accounts[2]});

      // Verify everything worked as expected
      assert.equal(Number(await OMG.methods.balanceOf(root).call()), 0);
      assert.equal(Number(await OMG.methods.balanceOf(safeTokenHarness._address).call()), 91);

      const estimatedLogCost = 2000;
      const estimatedExternalCallCost = 2500;
      const unknownCost = 5000; // Unknown extra gas, possibly because of ABI encoding

      assert.withinGas(first,
        gas.storage_new +
        ( 2 * gas.storage_update ) +
        ( 5 * gas.storage_read ) +
        estimatedLogCost +
        ( 2 * estimatedExternalCallCost ) +
        unknownCost, 5000, "should cost about one new storage and two updates");

      assert.withinGas(second,
        ( 3 * gas.storage_update ) +
        ( 5 * gas.storage_read ) +
        estimatedLogCost +
        ( 2 * estimatedExternalCallCost ) +
        unknownCost, 5000, "should cost about three storage updates (allowance and two balances)");

      assert.withinGas(third,
        ( 2 * gas.storage_update ) +
        ( 5 * gas.storage_read ) +
        estimatedLogCost +
        ( 2 * estimatedExternalCallCost ) +
        unknownCost, 5000, "should cost about two storage updates (two balances but NOT allowance)");

    });
  });

  describe("#doOutboundTransfer", async () => {
    it("abides by sane gas limits @gas", async () => {
      const safeTokenHarness = await SafeTokenHarness.new().send({from: root});
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});
      await OMG.methods.transfer(safeTokenHarness._address, 100).send({gas: 1000000, from: root});

      // Since its now approved, let's pick some random recipient (account 1) transfer out via our exposed "safeTransfer" function
      const first = await safeTokenHarness.methods.doOutboundTransfer(OMG._address, accounts[2], 80).send({from: accounts[1]});

      // Perform a second transfer
      const second = await safeTokenHarness.methods.doOutboundTransfer(OMG._address, accounts[2], 10).send({from: accounts[1]});

      // Verify everything worked as expected
      assert.equal(Number(await OMG.methods.balanceOf(root).call()), 0);
      assert.equal(Number(await OMG.methods.balanceOf(accounts[1]).call()), 0);
      assert.equal(Number(await OMG.methods.balanceOf(accounts[2]).call()), 90);
      assert.equal(Number(await OMG.methods.balanceOf(safeTokenHarness._address).call()), 10);

      const estimatedLogCost = 2000;
      const estimatedExternalCallCost = 2500;

      assert.withinGas(first,
        gas.storage_new +
        ( 1 * gas.storage_update ) +
        ( 2 * gas.storage_read ) +
        estimatedLogCost +
        ( 1 * estimatedExternalCallCost ), 5000, "should cost about one new storage and one updates");

      assert.withinGas(second,
        ( 2 * gas.storage_update ) +
        ( 2 * gas.storage_read ) +
        estimatedLogCost +
        ( 2 * estimatedExternalCallCost ), 5000, "should cost about two storage updates");
    });
  });

  describe('for a non-compliant (64-byte returning) token', async () => {
    it('reverts on #doTransferIn', async () => {
      const safeTokenHarness = await SafeTokenHarness.new().send({from: root});
      const OMG = await EIP20NonCompliant.new(100, "test omg nc", 18, "omg").send({from: root});

      await assert.revert(safeTokenHarness.methods.doInboundTransfer(OMG._address, accounts[0], 100).call({from: accounts[0]}));
    });

    it('reverts on #doOutboundTransfer', async () => {
      const safeTokenHarness = await SafeTokenHarness.new().send({from: root});
      const OMG = await EIP20NonCompliant.new(100, "test omg nc", 18, "omg").send({from: root});

      await assert.revert(safeTokenHarness.methods.doInboundTransfer(OMG._address, accounts[0], 100).call({from: accounts[0]}));
    });
  });

});
