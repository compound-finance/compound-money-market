"use strict";

const Web3_ = require('web3');
const web3_ = new Web3_(web3.currentProvider);

const {ErrorEnum, FailureInfoEnum} = require('./ErrorReporter');
const {assets, bigNums, checksum, gas, getExpMantissa} = require('./Utils');
const {getContract, readAndExecContract} = require('./Contract');
const MoneyMarketHarness = getContract("./test/MoneyMarketHarness.sol");
const PriceOracleHarness = getContract("./test/PriceOracleHarness.sol");
const EIP20 = getContract("./test/EIP20Harness.sol");
const EIP20NonStandardThrow = getContract("./test/EIP20NonStandardThrowHarness.sol");
const SimpleInterestRateModel = getContract("./test/InterestRateModel/SimpleInterestRateModel.sol");

contract('MoneyMarketHarness', function([root, ...accounts]) {

  describe("_supportMarket", async () => {
    it("fails if not called by admin", async () => {
      const moneyMarket = await MoneyMarketHarness.new().send({from: root});
      const interestRateModel = await SimpleInterestRateModel.new().send({from: root});
      const asset = assets.OMG;
      const price = getExpMantissa(0.5);

      const [errorCode, _tx, _error] = await readAndExecContract(moneyMarket, '_supportMarket', [asset._address, interestRateModel._address], {from: accounts[1]});

      assert.hasErrorCode(errorCode, ErrorEnum.UNAUTHORIZED);
    });

    it("fails if oracle is not set", async () => {
      const moneyMarket = await MoneyMarketHarness.new().send({from: root});
      await moneyMarket.methods.harnessSetOracle(0).send({from: root});
      await moneyMarket.methods.harnessSetUseOracle(true).send({from: root});
      const interestRateModel = await SimpleInterestRateModel.new().send({from: root});
      const asset = assets.OMG;

      const [errorCode, _tx, _error] = await readAndExecContract(moneyMarket, '_supportMarket', [asset._address, interestRateModel._address], {from: root});

      assert.hasErrorCode(errorCode, ErrorEnum.ZERO_ORACLE_ADDRESS);
    });

    it("fails if asset has no price", async () => {
      const moneyMarket = await MoneyMarketHarness.new().send({from: root});
      const interestRateModel = await SimpleInterestRateModel.new().send({from: root});
      const asset = assets.OMG;

      const [errorCode, _tx, _error] = await readAndExecContract(moneyMarket, '_supportMarket', [asset._address, interestRateModel._address], {from: root});

      assert.hasErrorCode(errorCode, ErrorEnum.ASSET_NOT_PRICED);
    });

    it("succeeds and sets market", async () => {
      const moneyMarket = await MoneyMarketHarness.new().send({from: root});
      const interestRateModel = await SimpleInterestRateModel.new().send({from: root});
      const asset = assets.OMG;

      await moneyMarket.methods.harnessSetAssetPriceMantissa(asset, getExpMantissa(0.5)).send({from: root});

      assert.equal(Number(await moneyMarket.methods.getCollateralMarketsLength().call()), 0);

      const [errorCode, tx, _error] = await readAndExecContract(moneyMarket, '_supportMarket', [asset, interestRateModel._address], {from: root});

      assert.noError(errorCode);

      assert.hasLog(tx, 'SupportedMarket', {
        asset: checksum(asset),
        interestRateModel: checksum(interestRateModel._address)
      });

      assert.equal(Number(await moneyMarket.methods.getCollateralMarketsLength().call()), 1);
      assert.equal(await moneyMarket.methods.collateralMarkets(0).call(), asset, "should have collateral market");
    });

    it("succeeds works a second time", async () => {
      const moneyMarket = await MoneyMarketHarness.new().send({from: root});
      const interestRateModel = await SimpleInterestRateModel.new().send({from: root});
      const asset = assets.OMG;
      await moneyMarket.methods.harnessSetAssetPriceMantissa(asset, getExpMantissa(0.5)).send({from: root});

      const [_errorCode, _tx, _error] = await readAndExecContract(moneyMarket, '_supportMarket', [asset, interestRateModel._address], {from: root});
      const [errorCode, tx, _error2] = await readAndExecContract(moneyMarket, '_supportMarket', [asset, interestRateModel._address], {from: root});

      assert.noError(errorCode);

      assert.hasLog(tx, 'SupportedMarket', {
        asset: checksum(asset),
        interestRateModel: checksum(interestRateModel._address)
      });

      assert.equal(Number(await moneyMarket.methods.getCollateralMarketsLength().call()), 1);
      assert.equal(await moneyMarket.methods.collateralMarkets(0).call(), asset, "should have collateral market");
      assert.withinPercentage(1e18, Number(await moneyMarket.methods.harnessGetSupplyIndex(asset).call()), 1e-10, "should have starting supply index");
      assert.withinPercentage(1e18, Number(await moneyMarket.methods.harnessGetBorrowIndex(asset).call()), 1e-10, "should have starting borrow index");
    });

    it("adds two assets", async () => {
      const moneyMarket = await MoneyMarketHarness.new().send({from: root});
      const interestRateModel = await SimpleInterestRateModel.new().send({from: root});
      const omg = await EIP20.new(100, "omg", 18, "omg").send({from: root});
      const drgn = await EIP20.new(100, "drgn", 18, "drgn").send({from: root});
      const price = getExpMantissa(0.5);

      await moneyMarket.methods.harnessSetAssetPriceMantissa(omg._address, price).send({from: root});
      await moneyMarket.methods.harnessSetAssetPriceMantissa(drgn._address, price).send({from: root});

      const [errorCode0, tx0, _error0] = await readAndExecContract(moneyMarket, '_supportMarket', [omg._address, interestRateModel._address], {from: root});
      const [errorCode1, tx1, _error1] = await readAndExecContract(moneyMarket, '_supportMarket', [drgn._address, interestRateModel._address], {from: root});

      assert.noError(errorCode0);
      assert.noError(errorCode1);

      assert.equal(Number(await moneyMarket.methods.getCollateralMarketsLength().call()), 2);
      assert.equal(await moneyMarket.methods.collateralMarkets(0).call(), checksum(omg._address), "should have omg market");
      assert.equal(await moneyMarket.methods.collateralMarkets(1).call(), checksum(drgn._address), "should have drgn market");

      assert.withinPercentage(1e18, Number(await moneyMarket.methods.harnessGetSupplyIndex(omg._address).call()), 1e-10, "omg should have starting supply index");
      assert.withinPercentage(1e18, Number(await moneyMarket.methods.harnessGetSupplyIndex(drgn._address).call()), 1e-10, "drgn should have starting supply index");
    });
  });

  describe("_setMarketInterestRateModel", async () => {
    it("fails if not called by admin", async () => {
      const moneyMarket = await MoneyMarketHarness.new().send({from: root});
      const interestRateModel = await SimpleInterestRateModel.new().send({from: root});
      const asset = assets.OMG;

      const [errorCode, _tx, _error] = await readAndExecContract(moneyMarket, '_setMarketInterestRateModel', [asset, interestRateModel._address], {from: accounts[1]});

      assert.hasErrorCode(errorCode, ErrorEnum.UNAUTHORIZED);

      assert.matchesAddress(await moneyMarket.methods.harnessGetInterestRateModel(asset).call(), "0x0000000000000000000000000000000000000000", "should not have set interest rate model");
    });

    it("succeeds and sets market", async () => {
      const moneyMarket = await MoneyMarketHarness.new().send({from: root});
      const interestRateModel = await SimpleInterestRateModel.new().send({from: root});
      const asset = assets.OMG;

      const [errorCode, tx, _error] = await readAndExecContract(moneyMarket, '_setMarketInterestRateModel', [asset, interestRateModel._address], {from: root});

      assert.noError(errorCode);

      assert.hasLog(tx, 'SetMarketInterestRateModel', {
        asset: checksum(asset),
        interestRateModel: checksum(interestRateModel._address)
      });

      assert.matchesAddress(await moneyMarket.methods.harnessGetInterestRateModel(asset).call(), interestRateModel._address, "should have set interest rate model");
    });
  });

  describe("_withdrawEquity", async () => {
    it('fails if not called by admin', async () => {
      const moneyMarket = await MoneyMarketHarness.new().send({from: root});
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});
      const asset = OMG._address;

      const result = await moneyMarket.methods._withdrawEquity(asset, 1).send({from: accounts[1], gas: 1000000});

      assert.hasFailure(result,
        ErrorEnum.UNAUTHORIZED,
        FailureInfoEnum.EQUITY_WITHDRAWAL_MODEL_OWNER_CHECK
      );
    });

    it('fails if amount requested exceeds equity', async () => {
      const moneyMarket = await MoneyMarketHarness.new().send({from: root});
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});
      const asset = OMG._address;

      // Give protocol cash
      await OMG.methods.harnessSetBalance(moneyMarket._address, 10000).send({from: root});

      // Configure market state for OMG: a supply of 1000, borrows of 2000 and supply and borrow indexes of 1.
      await moneyMarket.methods.harnessSetMarketDetails(OMG._address, 1000, 0, 1, 2000, 0, 1).send({from: root});

      // equity = 10000 + 2000 - 1000 = 11000. Try to withdraw more than equity and should be rejected
      const result = await moneyMarket.methods._withdrawEquity(asset, 11001).send({from: root, gas: 1000000});

      assert.hasFailure(result,
        ErrorEnum.EQUITY_INSUFFICIENT_BALANCE,
        FailureInfoEnum.EQUITY_WITHDRAWAL_AMOUNT_VALIDATION
      );
    });

    it('fails if cash + borrows overflows', async () => {
      const moneyMarket = await MoneyMarketHarness.new().send({from: root});
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});
      const asset = OMG._address;

      // Give protocol cash
      await OMG.methods.harnessSetBalance(moneyMarket._address, 10000).send({from: root});

      // Configure market state for OMG: a supply of 1, borrows of maxUint and supply and borrow indexes of 1.
      await moneyMarket.methods.harnessSetMarketDetails(OMG._address, 1, 0, 1, bigNums.maxUint, 0, 1).send({from: root});

      // cash of 1000 + borrows of maxUint should overflow
      const result = await moneyMarket.methods._withdrawEquity(asset, 10).send({from: root, gas: 1000000});

      assert.hasFailure(result,
        ErrorEnum.INTEGER_OVERFLOW,
        FailureInfoEnum.EQUITY_WITHDRAWAL_CALCULATE_EQUITY
      );
    });

    it('fails if cash + borrows - supply underflows', async () => {
      const moneyMarket = await MoneyMarketHarness.new().send({from: root});
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});
      const asset = OMG._address;

      // Give protocol cash
      await OMG.methods.harnessSetBalance(moneyMarket._address, 10000).send({from: root});

      // Configure market state for OMG: a supply of maxUint, borrows of 0 and supply and borrow indexes of 1.
      await moneyMarket.methods.harnessSetMarketDetails(OMG._address, bigNums.maxUint, 0, 1, 0, 0, 1).send({from: root});

      // cash of 1000 + 0 borrows - maxUint should underflow
      const result = await moneyMarket.methods._withdrawEquity(asset, 10).send({from: root, gas: 1000000});

      assert.hasFailure(result,
        ErrorEnum.INTEGER_UNDERFLOW,
        FailureInfoEnum.EQUITY_WITHDRAWAL_CALCULATE_EQUITY
      );
    });

    it('fails if transfer out fails', async () => {
      const moneyMarket = await MoneyMarketHarness.new().send({from: root});
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});
      const asset = OMG._address;

      // Give protocol cash
      await OMG.methods.harnessSetBalance(moneyMarket._address, 10000).send({from: root});

      // Configure market state for OMG: a supply of 1000, borrows of 2000 and supply and borrow indexes of 1.
      await moneyMarket.methods.harnessSetMarketDetails(OMG._address, 1000, 0, 1, 2000, 0, 1).send({from: root});

      await OMG.methods.harnessSetFailTransferToAddress(root, true).send({from: root});

      // equity = 10000 - (1000 + 2000) = 7000. Try to withdraw only 4500, which should be allowed
      // BUT we have configured the token harness to fail the transfer out
      const result = await moneyMarket.methods._withdrawEquity(asset, 10).send({from: root, gas: 1000000});

      assert.hasFailure(result,
        ErrorEnum.TOKEN_TRANSFER_OUT_FAILED,
        FailureInfoEnum.EQUITY_WITHDRAWAL_TRANSFER_OUT_FAILED
      );
    });

    it('emits log on success', async () => {
      const moneyMarket = await MoneyMarketHarness.new().send({from: root});
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});
      const asset = OMG._address;

      // Give protocol cash
      await OMG.methods.harnessSetBalance(moneyMarket._address, 10000).send({from: root});

      // Configure market state for OMG: a supply of 1000, borrows of 2000 and supply and borrow indexes of 1.
      await moneyMarket.methods.harnessSetMarketDetails(OMG._address, 1000, 0, 1, 2000, 0, 1).send({from: root});

      // equity = 10000 + 2000 - 1000 = 11000. Try to withdraw only 4500, which should be allowed
      const [errorCode, tx, _error] = await readAndExecContract(moneyMarket, '_withdrawEquity', [asset, 4500], {from: root, gas: 1000000});
      assert.noError(errorCode);

      assert.hasLog(tx, "EquityWithdrawn", {
        asset: checksum(asset),
        equityAvailableBefore: '11000',
        amount: '4500',
        owner: checksum(root)
      }
      );
    });
  });

  describe("_suspendMarket", async () => {
    it('emits log on successful state change', async () => {
      const moneyMarket = await MoneyMarketHarness.new().send({from: root});
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});
      const asset = OMG._address;

      await moneyMarket.methods.harnessSetAssetPriceMantissa(asset, getExpMantissa(0.5)).send({from: root});
      await moneyMarket.methods.harnessSupportMarket(asset).send({from: root});

      const [errorCode, tx, _error] = await readAndExecContract(moneyMarket, '_suspendMarket', [asset], {from: root, gas: 1000000});
      assert.noError(errorCode);

      assert.hasLog(tx, "SuspendedMarket", {
          asset: checksum(asset)
        });
    });
  });


  describe("_setRiskParameters", async () => {
    it('emits log on failure due to non-admin caller', async () => {
      const moneyMarket = await MoneyMarketHarness.new().send({from: root});

      const newRatio = getExpMantissa(3.5);
      const newDiscount = getExpMantissa(0.05);

      const result = await moneyMarket.methods._setRiskParameters(newRatio, newDiscount).send({from: accounts[1], gas: 1000000});

      assert.hasFailure(result,
        ErrorEnum.UNAUTHORIZED,
        FailureInfoEnum.SET_RISK_PARAMETERS_OWNER_CHECK
      );
    });

    it('emits log on failure due to invalid collateral ratio', async () => {
      const moneyMarket = await MoneyMarketHarness.new().send({from: root});

      const newRatio = getExpMantissa(1.0);
      const newDiscount = getExpMantissa(0.05);

      const result = await moneyMarket.methods._setRiskParameters(newRatio, newDiscount).send({from: root, gas: 1000000});

      assert.hasFailure(result,
        ErrorEnum.INVALID_COLLATERAL_RATIO,
        FailureInfoEnum.SET_RISK_PARAMETERS_VALIDATION
      );
    });

    it('emits log on failure due to invalid liquidation discount', async () => {
      const moneyMarket = await MoneyMarketHarness.new().send({from: root});

      const newRatio = getExpMantissa(2.3);
      const newDiscount = getExpMantissa(0.11);

      const result = await moneyMarket.methods._setRiskParameters(newRatio, newDiscount).send({from: root, gas: 1000000});

      assert.hasFailure(result,
        ErrorEnum.INVALID_LIQUIDATION_DISCOUNT,
        FailureInfoEnum.SET_RISK_PARAMETERS_VALIDATION
      );
    });

    it('emits log on failure due to collateral ratio = liquidation discount + 1', async () => {
      const moneyMarket = await MoneyMarketHarness.new().send({from: root});

      const newRatio = 11 * 10**17;
      const newDiscount = 10**17;

      const result = await moneyMarket.methods._setRiskParameters(newRatio, newDiscount).send({from: root, gas: 1000000});

      assert.hasFailure(result,
        ErrorEnum.INVALID_COMBINED_RISK_PARAMETERS,
        FailureInfoEnum.SET_RISK_PARAMETERS_VALIDATION
      );
    });

    it('emits log on successful change', async () => {
      const moneyMarket = await MoneyMarketHarness.new().send({from: root});

      const newRatio = getExpMantissa(2.3);
      const newDiscount = getExpMantissa(0.05);

      const [errorCode, tx, _error] = await readAndExecContract(moneyMarket, '_setRiskParameters', [newRatio, newDiscount], {from: root, gas: 1000000});
      assert.noError(errorCode);

      assert.hasLog(tx, "NewRiskParameters", {
        oldCollateralRatioMantissa: getExpMantissa(2.0).toString(),
        newCollateralRatioMantissa: newRatio.toString(),
        oldLiquidationDiscountMantissa: getExpMantissa(0).toString(),
        newLiquidationDiscountMantissa: newDiscount.toString(),
      });
    });
  });

  describe("_setOriginationFee", async () => {
    it('emits log on failure due to non-admin caller', async () => {
      const moneyMarket = await MoneyMarketHarness.new().send({from: root});

      const newRatio = getExpMantissa(3.5);

      const result = await moneyMarket.methods._setOriginationFee(newRatio).send({from: accounts[1]});

      assert.hasFailure(result,
        ErrorEnum.UNAUTHORIZED,
        FailureInfoEnum.SET_ORIGINATION_FEE_OWNER_CHECK
      );
    });

    it('emits log on successful change', async () => {
      const moneyMarket = await MoneyMarketHarness.new().send({from: root});

      const newRatio = getExpMantissa(3.5);

      const [errorCode, tx, _error] = await readAndExecContract(moneyMarket, '_setOriginationFee', [newRatio], {from: root});
      assert.noError(errorCode);

      assert.hasLog(tx, "NewOriginationFee", {
        oldOriginationFeeMantissa: "0",
        newOriginationFeeMantissa: newRatio.toString()
      });
    });
  });

  describe('harnessCalculateInterestIndex', async () => {
    it('calculates correct value for exact value', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      assert.equal(6e18, Number(await moneyMarketHarness.methods.harnessCalculateInterestIndex(1e18, 1000, 50).call()));
    });

    it('calculates correct value for inexact value', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      // 111111111111111111 * ( 1 + 9 * 0.0001)
      assert.withinPercentage(111211111111111089, Number(await moneyMarketHarness.methods.harnessCalculateInterestIndex(111111111111111111, 1, 9).call()), 1e-10);
    });
  });

  // TODO: If we don't specify gas when doing token transfer, it fails with an out of gas excpetion. Why?
  // In other words: Why does the block chain interaction code underestimate the gas cost of the transfer?
  const tokenTransferGas = 54687;

  describe('supply', async () => {
    it('returns error and logs info if contract is paused', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});
      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Transfer token (e.g. via ICO) to customer
      await OMG.methods.transfer(customer, 100).send({gas: tokenTransferGas, from: root});
      // Customer now approves our Money Market to spend its value
      await OMG.methods.approve(moneyMarketHarness._address, 95).send({from: customer});

      await moneyMarketHarness.methods._setPaused(true).send({from: root});

      const result = await moneyMarketHarness.methods.supply(OMG._address, 90).send({from: customer});

      assert.hasFailure(result,
        ErrorEnum.CONTRACT_PAUSED,
        FailureInfoEnum.SUPPLY_CONTRACT_PAUSED
      );
    });

    it('returns error if new supply interest index calculation fails', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Transfer token (e.g. via ICO) to customer
      await OMG.methods.transfer(customer, 100).send({gas: tokenTransferGas, from: root});

      // Customer now approves our Money Market to spend its value
      await OMG.methods.approve(moneyMarketHarness._address, 95).send({from: customer});

      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(OMG._address, getExpMantissa(0.5)).send({from: root});
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});

      // Store a block number that should be HIGHER than the current block number so we'll get an underflow
      // when calculating block delta.
      await moneyMarketHarness.methods.harnessSetMarketBlockNumber(OMG._address, -1).send({from: root});

      const result = await moneyMarketHarness.methods.supply(OMG._address, 90).send({from: customer});

      assert.hasFailure(result,
        ErrorEnum.INTEGER_UNDERFLOW,
        FailureInfoEnum.SUPPLY_NEW_SUPPLY_INDEX_CALCULATION_FAILED
      );
    });

    it('returns error if accumulated balance calculation fails', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Transfer token (e.g. via ICO) to customer
      await OMG.methods.transfer(customer, 100).send({gas: tokenTransferGas, from: root});

      // Customer now approves our Money Market to spend its value
      await OMG.methods.approve(moneyMarketHarness._address, 95).send({from: customer});

      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(OMG._address, getExpMantissa(0.5)).send({from: root});
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});

      // Set zero as the previous supply index for the customer. This should cause div by zero error in balance calc.
      // To reach that we also have to set the previous principal to a non-zero value otherwise we will short circuit.
      await moneyMarketHarness.methods.harnessSetAccountSupplyBalance(customer, OMG._address, 1, 0).send({from: root});

      const result = await moneyMarketHarness.methods.supply(OMG._address, 90).send({from: customer});

      assert.hasFailure(result,
        ErrorEnum.DIVISION_BY_ZERO,
        FailureInfoEnum.SUPPLY_ACCUMULATED_BALANCE_CALCULATION_FAILED
      );
    });

    it('returns error if customer total new balance calculation fails', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(bigNums.maxUint, "test omg", 18, "omg").send({from: root});

      // Transfer token (e.g. via ICO) to customer
      await OMG.methods.transfer(customer, bigNums.maxUint).send({gas: tokenTransferGas, from: root});

      // Customer now approves our Money Market to spend its value
      await OMG.methods.approve(moneyMarketHarness._address, bigNums.maxUint).send({from: customer});

      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(OMG._address, getExpMantissa(0.5)).send({from: root});
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});

      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 10, 0, 1, 0, 0, 1).send({from: root});

      // We are going to supply 1, so give an existing balance of maxUint to cause an overflow.
      await moneyMarketHarness.methods.harnessSetAccountSupplyBalance(customer, OMG._address, bigNums.maxUint, 1).send({from: root});

      const result = await moneyMarketHarness.methods.supply(OMG._address, 1).send({from: customer});

      assert.hasFailure(result,
        ErrorEnum.INTEGER_OVERFLOW,
        FailureInfoEnum.SUPPLY_NEW_TOTAL_BALANCE_CALCULATION_FAILED
      );
    });

    it('returns error if protocol total supply calculation fails', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Transfer token (e.g. via ICO) to customer
      await OMG.methods.transfer(customer, 100).send({gas: tokenTransferGas, from: root});

      // Customer now approves our Money Market to spend its value
      await OMG.methods.approve(moneyMarketHarness._address, 95).send({from: customer});

      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(OMG._address, getExpMantissa(0.5)).send({from: root});
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});

      // Give the protocol a token balance of maxUint so when we calculate adding the new supply to it, it will overflow.
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, bigNums.maxUint, 0, 1, 0, 0, 1).send({from: root});

      const result = await moneyMarketHarness.methods.supply(OMG._address, 1).send({from: customer});

      assert.hasFailure(result,
        ErrorEnum.INTEGER_OVERFLOW,
        FailureInfoEnum.SUPPLY_NEW_TOTAL_SUPPLY_CALCULATION_FAILED
      );
    });

    it('returns error if protocol total cash calculation fails', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(bigNums.maxUint, "test omg", 18, "omg").send({from: root});

      // Transfer token (e.g. via ICO) to customer
      await OMG.methods.transfer(customer, bigNums.maxUint).send({gas: tokenTransferGas, from: root});

      // Customer now approves our Money Market to spend its value
      await OMG.methods.approve(moneyMarketHarness._address, bigNums.maxUint).send({from: customer});

      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(OMG._address, getExpMantissa(0.5)).send({from: root});
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});

      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 10, 0, 1, 0, 0, 1).send({from: root});

      // We are going to supply 1, so fake out protocol current cash as maxUint so when we add the new cash it will overflow.
      await moneyMarketHarness.methods.harnessSetCash(OMG._address, bigNums.maxUint).send({from: root});

      const result = await moneyMarketHarness.methods.supply(OMG._address, 1).send({from: customer});

      assert.hasFailure(result,
        ErrorEnum.INTEGER_OVERFLOW,
        FailureInfoEnum.SUPPLY_NEW_TOTAL_CASH_CALCULATION_FAILED
      );
    });

    it('returns error if new supply rate calculation fails', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Set up FailingInterestModel for OMG market
      const FailableInterestRateModel = getContract("./test/InterestRateModel/FailableInterestRateModel.sol");
      const failableInterestRateModel = await FailableInterestRateModel.new(true, false).send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, failableInterestRateModel._address).send({from: root});

      // Transfer token (e.g. via ICO) to customer
      await OMG.methods.transfer(customer, 100).send({gas: tokenTransferGas, from: root});

      // Customer now approves our Money Market to spend its value
      await OMG.methods.approve(moneyMarketHarness._address, 95).send({from: customer});

      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(OMG._address, getExpMantissa(0.5)).send({from: root});
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});

      const result = await moneyMarketHarness.methods.supply(OMG._address, 90).send({from: customer});

      assert.hasFailure(result,
        ErrorEnum.OPAQUE_ERROR,
        FailureInfoEnum.SUPPLY_NEW_SUPPLY_RATE_CALCULATION_FAILED,
        10
      );
    });

    it('returns error if new borrow interest index calculation fails', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});

      // Transfer token (e.g. via ICO) to customer
      await OMG.methods.transfer(customer, 100).send({gas: tokenTransferGas, from: root});

      // Customer now approves our Money Market to spend its value
      await OMG.methods.approve(moneyMarketHarness._address, 95).send({from: customer});

      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(OMG._address, getExpMantissa(0.5)).send({from: root});
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});

      // Set current borrow interest index to maxUint so when we multiply by it we get an overflow
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 1, 1, 1, 1, 1, bigNums.maxUint).send({from: root});

      const result = await moneyMarketHarness.methods.supply(OMG._address, 90).send({from: customer});

      assert.hasFailure(result,
        ErrorEnum.INTEGER_OVERFLOW,
        FailureInfoEnum.SUPPLY_NEW_BORROW_INDEX_CALCULATION_FAILED
      );
    });

    it('returns error if new borrow rate calculation fails', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Set up FailingInterestModel for OMG market
      const FailableInterestRateModel = getContract("./test/InterestRateModel/FailableInterestRateModel.sol");
      const failableInterestRateModel = await FailableInterestRateModel.new(false, true).send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, failableInterestRateModel._address).send({from: root});

      // Transfer token (e.g. via ICO) to customer
      await OMG.methods.transfer(customer, 100).send({gas: tokenTransferGas, from: root});

      // Customer now approves our Money Market to spend its value
      await OMG.methods.approve(moneyMarketHarness._address, 95).send({from: customer});

      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(OMG._address, getExpMantissa(0.5)).send({from: root});
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});

      const result = await moneyMarketHarness.methods.supply(OMG._address, 90).send({from: customer});

      assert.hasFailure(result,
        ErrorEnum.OPAQUE_ERROR,
        FailureInfoEnum.SUPPLY_NEW_BORROW_RATE_CALCULATION_FAILED,
        20
      );
    });

    it('returns error if token transfer fails', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});

      // Transfer token (e.g. via ICO) to customer
      await OMG.methods.transfer(customer, 100).send({gas: tokenTransferGas, from: root});

      // Customer now approves our Money Market to spend its value
      await OMG.methods.approve(moneyMarketHarness._address, 95).send({from: customer});

      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(OMG._address, getExpMantissa(0.5)).send({from: root});
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});

      await OMG.methods.harnessSetFailTransferFromAddress(customer, true).send({from: root});

      const result = await moneyMarketHarness.methods.supply(OMG._address, 90).send({from: customer});

      assert.hasFailure(result,
        ErrorEnum.TOKEN_TRANSFER_FAILED,
        FailureInfoEnum.SUPPLY_TRANSFER_IN_FAILED
      );
    });

    it('throws if token transfer fails from non-standard', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20NonStandardThrow.new(100, "test omg ns", 18, "omg").send({from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});

      // Transfer token (e.g. via ICO) to customer
      await OMG.methods.transfer(customer, 100).send({gas: tokenTransferGas, from: root});

      // Customer now approves our Money Market to spend its value
      await OMG.methods.approve(moneyMarketHarness._address, 95).send({from: customer});

      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(OMG._address, getExpMantissa(0.5)).send({from: root});
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});

      await OMG.methods.harnessSetFailTransferFromAddress(customer, true).send({from: root});

      await assert.revert(moneyMarketHarness.methods.supply(OMG._address, 90).send({from: customer}));
    });

    it('emits supply event on success', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});

      // Transfer token (e.g. via ICO) to customer
      await OMG.methods.transfer(customer, 100).send({gas: tokenTransferGas, from: root});

      // Customer now approves our Money Market to spend its value
      await OMG.methods.approve(moneyMarketHarness._address, 95).send({from: customer});

      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(OMG._address, getExpMantissa(0.5)).send({from: root});
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});

      const initialInterestIndex = 1;
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 0, 0, initialInterestIndex, 0, 0, initialInterestIndex).send({from: root});
      const result = await moneyMarketHarness.methods.supply(OMG._address, 90).send({from: customer});

      assert.hasLog(result,
        "SupplyReceived",
        {
          account: checksum(customer),
          asset: OMG._address,
          amount: '90',
          startingBalance: '0',
          newBalance: '90',
        }
      );

      const customerTokenBalance = await OMG.methods.balanceOf(customer).call();
      assert.equal(10, customerTokenBalance);

      const customerCompoundBalance = await moneyMarketHarness.methods.supplyBalances(customer, OMG._address).call();
      assert.equal(90, customerCompoundBalance.principal);
      assert.equal(initialInterestIndex, customerCompoundBalance.interestIndex);
    });

    it('allows supply with zero oracle price', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});

      // Transfer token (e.g. via ICO) to customer
      await OMG.methods.transfer(customer, 100).send({gas: tokenTransferGas, from: root});

      // Customer now approves our Money Market to spend its value
      await OMG.methods.approve(moneyMarketHarness._address, 95).send({from: customer});

      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(OMG._address, getExpMantissa(0.5)).send({from: root});
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});
      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(OMG._address, 0).send({from: root});

      const initialInterestIndex = 1;
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 0, 0, initialInterestIndex, 0, 0, initialInterestIndex).send({from: root});
      const result = await moneyMarketHarness.methods.supply(OMG._address, 90).send({from: customer});

      assert.hasLog(result,
        "SupplyReceived",
        {
          account: checksum(customer),
          asset: OMG._address,
          amount: '90',
          startingBalance: '0',
          newBalance: '90',
        }
      );

      const customerTokenBalance = await OMG.methods.balanceOf(customer).call();
      assert.equal(10, customerTokenBalance);

      const customerCompoundBalance = await moneyMarketHarness.methods.supplyBalances(customer, OMG._address).call();
      assert.equal(90, customerCompoundBalance.principal);
      assert.equal(initialInterestIndex, customerCompoundBalance.interestIndex);
    });

    it('succeeds with non-standard token', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20NonStandardThrow.new(100, "test omg ns", 18, "omg").send({from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});

      // Transfer token (e.g. via ICO) to customer
      await OMG.methods.transfer(customer, 100).send({gas: tokenTransferGas, from: root});

      // Customer now approves our Money Market to spend its value
      await OMG.methods.approve(moneyMarketHarness._address, 95).send({from: customer});

      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(OMG._address, getExpMantissa(0.5)).send({from: root});
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});

      const initialInterestIndex = 1;
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 0, 0, initialInterestIndex, 0, 0, initialInterestIndex).send({from: root});
      const result = await moneyMarketHarness.methods.supply(OMG._address, 90).send({from: customer});

      assert.hasLog(result,
        "SupplyReceived",
        {
          account: checksum(customer),
          asset: OMG._address,
          amount: '90',
          startingBalance: '0',
          newBalance: '90',
        }
      );

      const customerTokenBalance = await OMG.methods.balanceOf(customer).call();
      assert.equal(10, customerTokenBalance);

      const customerCompoundBalance = await moneyMarketHarness.methods.supplyBalances(customer, OMG._address).call();
      assert.equal(90, customerCompoundBalance.principal);
      assert.equal(initialInterestIndex, customerCompoundBalance.interestIndex);
    });

    it('loves @gas', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});

      // Transfer token (e.g. via ICO) to customer
      await OMG.methods.transfer(customer, 100).send({gas: tokenTransferGas, from: root});

      // Customer now approves our Money Market to spend its value
      await OMG.methods.approve(moneyMarketHarness._address, 95).send({from: customer});

      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(OMG._address, getExpMantissa(0.5)).send({from: root});
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});

      const initialInterestIndex = 1;
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 0, 0, initialInterestIndex, 0, 0, initialInterestIndex).send({from: root});

      // Warm the pot
      moneyMarketHarness.methods.supply(OMG._address, 1).send({from: customer});

      const result = await moneyMarketHarness.methods.supply(OMG._address, 90).send({from: customer});

      assert.hasLog(result,
        "SupplyReceived",
        {
          account: checksum(customer),
          asset: OMG._address,
          amount: '90'
        }
      );

      assert.withinGas(result, 109e3, 5000, "should be about 109K gas", true);
    });

    it('allows supply of 0 even for customer with no token', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});

      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(OMG._address, getExpMantissa(0.5)).send({from: root});
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});

      const initialInterestIndex = 1;
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 0, 0, initialInterestIndex, 0, 0, initialInterestIndex).send({from: root});
      const result = await moneyMarketHarness.methods.supply(OMG._address, 0).send({from: customer});

      assert.hasLog(result,
        "SupplyReceived",
        {
          account: checksum(customer),
          asset: OMG._address,
          amount: '0',
          startingBalance: '0',
          newBalance: '0',
        }
      );

      const customerTokenBalance = await OMG.methods.balanceOf(customer).call();
      assert.equal(0, customerTokenBalance);

      const customerCompoundBalance = await moneyMarketHarness.methods.supplyBalances(customer, OMG._address).call();
      assert.equal(0, customerCompoundBalance.principal);
      assert.equal(initialInterestIndex, customerCompoundBalance.interestIndex);
    });
  });

  describe('withdraw', async() => {
    it('returns error and logs info if contract is paused', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});
      const customer = accounts[1];
      const OMG = await EIP20.new(10**18, "test omg", 18, "omg").send({from: root});
      // Support market
      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(OMG._address, getExpMantissa(0.5)).send({from: root});
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});
      // Give protocol cash
      await OMG.methods.harnessSetBalance(moneyMarketHarness._address, 500).send({from: root});

      // Give customer some liquidity and an OMG supply balance
      await moneyMarketHarness.methods.harnessSetLiquiditySurplus(customer, 50).send({from: root});
      await moneyMarketHarness.methods.harnessSetAccountSupplyBalance(customer, OMG._address, 100, 1).send({from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});

      // Configure market state for OMG: a supply of 1000 and supply and borrow indexes of 1.
      const initialInterestIndex = 1;
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 1000, 0, initialInterestIndex, 0, 0, initialInterestIndex).send({from: root});

      await moneyMarketHarness.methods._setPaused(true).send({from: root});

      const result = await moneyMarketHarness.methods.withdraw(OMG._address, 1).send({from: customer});

      assert.hasFailure(result,
        ErrorEnum.CONTRACT_PAUSED,
        FailureInfoEnum.WITHDRAW_CONTRACT_PAUSED
      );
    });

    it('returns error and logs info if protocol has insufficient cash for withdrawal', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});
      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});
      // Support market
      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(OMG._address, getExpMantissa(0.5)).send({from: root});
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});

      // Give protocol insufficient cash
      await OMG.methods.harnessSetBalance(moneyMarketHarness._address, 1).send({from: root});

      const [errorCode, tx, _error] = await readAndExecContract(moneyMarketHarness, 'withdraw', [OMG._address, 10], {from: customer});
      assert.hasErrorCode(errorCode, ErrorEnum.TOKEN_INSUFFICIENT_CASH);

      assert.hasLog(tx,
        "Failure",
        {
          error: ErrorEnum.TOKEN_INSUFFICIENT_CASH.toString(),
          info: FailureInfoEnum.WITHDRAW_TRANSFER_OUT_NOT_POSSIBLE.toString(),
          detail: '0'
        }
      );
    });

    it('returns error and logs info if account liquidity calculation fails', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});
      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});
      // Support market
      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(OMG._address, getExpMantissa(0.5)).send({from: root});
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});
      // Give protocol cash
      await OMG.methods.harnessSetBalance(moneyMarketHarness._address, 100).send({from: root});

      // Use harness to ensure desired failure
      await moneyMarketHarness.methods.harnessSetFailLiquidityCheck(customer, true).send({from: root});

      const [errorCode, tx, _error] = await readAndExecContract(moneyMarketHarness, 'withdraw', [OMG._address, 10], {from: customer});
      assert.hasErrorCode(errorCode, ErrorEnum.INTEGER_OVERFLOW);

      assert.hasLog(tx,
        "Failure",
        {
          error: ErrorEnum.INTEGER_OVERFLOW.toString(),
          info: FailureInfoEnum.WITHDRAW_ACCOUNT_LIQUIDITY_CALCULATION_FAILED.toString(),
          detail: '0'
        }
      );
    });

    it('returns error and logs info if account is underwater', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});
      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});
      // Support market
      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(OMG._address, getExpMantissa(0.5)).send({from: root});
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});
      // Give protocol cash
      await OMG.methods.harnessSetBalance(moneyMarketHarness._address, 100).send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 1000, 0, 1, 0, 0, 1).send({from: root});

      // Give customer a balance of OMG but also a liquidity shortfall
      await moneyMarketHarness.methods.harnessSetAccountSupplyBalance(customer, OMG._address, 20, 1).send({from: root});
      await moneyMarketHarness.methods.harnessSetLiquidityShortfall(customer, 10**18).send({from: root});

      const [errorCode, tx, _error] = await readAndExecContract(moneyMarketHarness, 'withdraw', [OMG._address, 10], {from: customer});
      assert.hasErrorCode(errorCode, ErrorEnum.INSUFFICIENT_LIQUIDITY);

      assert.hasLog(tx,
        "Failure",
        {
          error: ErrorEnum.INSUFFICIENT_LIQUIDITY.toString(),
          info: FailureInfoEnum.WITHDRAW_ACCOUNT_SHORTFALL_PRESENT.toString(),
          detail: '0'
        }
      );
    });

    it('returns error and logs info if calculation of eth value of withdrawal fails', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});
      const customer = accounts[1];
      const OMG = await EIP20.new(10**18, "test omg", 18, "omg").send({from: root});
      // Support market
      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(OMG._address, getExpMantissa(0.5)).send({from: root});
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});
      // Give protocol cash
      await OMG.methods.harnessSetBalance(moneyMarketHarness._address, 100).send({from: root});

      // Configure market state for OMG: a supply of 1000 and supply and borrow indexes of 1.
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 1000, 0, 1, 0, 0, 1).send({from: root});

      // Give customer an OMG supply balance
      await moneyMarketHarness.methods.harnessSetAccountSupplyBalance(customer, OMG._address, 100, 1).send({from: root});

      // Give OMG a ridiculous eth value of max int to trigger desired overflow.
      await moneyMarketHarness.methods.harnessSetMaxAssetPrice(OMG._address).send({from: root});

      const [errorCode, tx, _error] = await readAndExecContract(moneyMarketHarness, 'withdraw', [OMG._address, 100], {from: customer});
      assert.hasErrorCode(errorCode, ErrorEnum.INTEGER_OVERFLOW);

      assert.hasLog(tx,
        "Failure",
        {
          error: ErrorEnum.INTEGER_OVERFLOW.toString(),
          info: FailureInfoEnum.WITHDRAW_AMOUNT_VALUE_CALCULATION_FAILED.toString(),
          detail: '0'
        }
      );
    });

    it('returns an error and logs info if withdrawal would put account underwater', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});
      const customer = accounts[1];
      const OMG = await EIP20.new(10**18, "test omg", 18, "omg").send({from: root});
      // Support market
      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(OMG._address, getExpMantissa(0.5)).send({from: root});
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});
      // Give protocol cash
      await OMG.methods.harnessSetBalance(moneyMarketHarness._address, 100).send({from: root});

      // Configure market state for OMG: a supply of 1000 and supply and borrow indexes of 1.
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 1000, 0, 1, 0, 0, 1).send({from: root});

      const liquidity = 10;
      await moneyMarketHarness.methods.harnessSetLiquiditySurplus(customer, liquidity).send({from: root});
      // Make sure customer has enough of the asset to withdraw; what's going to stop is liquidity shortfall of (simulated) loans
      await moneyMarketHarness.methods.harnessSetAccountSupplyBalance(customer, OMG._address, liquidity + 2, 1).send({from: root});

      // set eth price of OMG to 1 so our attempt to withdraw liquidity + 1 will cause a liquidity shortfall
      await moneyMarketHarness.methods.harnessSetAssetPrice(OMG._address, 1, 1).send({from: root});

      const [errorCode, tx, _error] = await readAndExecContract(moneyMarketHarness, 'withdraw', [OMG._address, liquidity + 1], {from: customer});
      assert.hasErrorCode(errorCode, ErrorEnum.INSUFFICIENT_LIQUIDITY);

      assert.hasLog(tx,
        "Failure",
        {
          error: ErrorEnum.INSUFFICIENT_LIQUIDITY.toString(),
          info: FailureInfoEnum.WITHDRAW_AMOUNT_LIQUIDITY_SHORTFALL.toString(),
          detail: '0'
        }
      );
    });

    it('returns error and logs info if new supply interest index calculation fails', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});
      const customer = accounts[1];
      const OMG = await EIP20.new(10**18, "test omg", 18, "omg").send({from: root});
      // Support market
      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(OMG._address, getExpMantissa(0.5)).send({from: root});
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});
      // Give protocol cash
      await OMG.methods.harnessSetBalance(moneyMarketHarness._address, 100).send({from: root});

      // Configure market state for OMG: a supply of 1000 and supply and borrow indexes of 1.
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 1000, 0, 1, 0, 0, 1).send({from: root});

      // Give customer liquidity
      await moneyMarketHarness.methods.harnessSetLiquiditySurplus(customer, 100).send({from: root});

      // Price ETH:OMG at 1:1
      await moneyMarketHarness.methods.harnessSetAssetPrice(OMG._address, 1, 1).send({from: root});

      // Store a block number that should be HIGHER than the current block number so we'll get an underflow
      // when calculating block delta.
      await moneyMarketHarness.methods.harnessSetMarketBlockNumber(OMG._address, -1).send({from: root});

      const [errorCode, tx, _error] = await readAndExecContract(moneyMarketHarness, 'withdraw', [OMG._address, 10], {from: customer});
      assert.hasErrorCode(errorCode, ErrorEnum.INTEGER_UNDERFLOW);

      assert.hasLog(tx,
        "Failure",
        {
          error: ErrorEnum.INTEGER_UNDERFLOW.toString(),
          info: FailureInfoEnum.WITHDRAW_NEW_SUPPLY_INDEX_CALCULATION_FAILED.toString(),
          detail: '0'
        }
      );
    });

    it('returns error and logs info if accumulated balance calculation fails', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});
      const customer = accounts[1];
      const OMG = await EIP20.new(10**18, "test omg", 18, "omg").send({from: root});
      // Support market
      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(OMG._address, getExpMantissa(0.5)).send({from: root});
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});
      // Give protocol cash
      await OMG.methods.harnessSetBalance(moneyMarketHarness._address, 100).send({from: root});

      // Give customer liquidity
      await moneyMarketHarness.methods.harnessSetLiquiditySurplus(customer, 100).send({from: root});

      // Set zero as the previous supply index for the customer. This should cause div by zero error in balance calc.
      // To reach that we also have to set the previous principal to a non-zero value otherwise we will short circuit.
      await moneyMarketHarness.methods.harnessSetAccountSupplyBalance(customer, OMG._address, 100, 0).send({from: root});

      const [errorCode, tx, _error] = await readAndExecContract(moneyMarketHarness, 'withdraw', [OMG._address, 90], {from: customer});
      assert.hasErrorCode(errorCode, ErrorEnum.DIVISION_BY_ZERO);

      assert.hasLog(tx,
        "Failure",
        {
          error: ErrorEnum.DIVISION_BY_ZERO.toString(),
          info: FailureInfoEnum.WITHDRAW_ACCUMULATED_BALANCE_CALCULATION_FAILED.toString(),
          detail: '0'
        }
      );
    });

    it('returns error and logs info if customer total new balance calculation fails', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});
      const customer = accounts[1];
      const OMG = await EIP20.new(10**18, "test omg", 18, "omg").send({from: root});
      // Support market
      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(OMG._address, getExpMantissa(0.5)).send({from: root});
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});
      // Give protocol cash
      await OMG.methods.harnessSetBalance(moneyMarketHarness._address, 100).send({from: root});

      // give customer a liquidity surplus (from imaginary other assets)
      await moneyMarketHarness.methods.harnessSetLiquiditySurplus(customer, 100).send({from: root});

      // give a small balance of asset they are trying to withdraw
      await moneyMarketHarness.methods.harnessSetAccountSupplyBalance(customer, OMG._address, 10, 1).send({from: root});

      // try to withdraw more than is accumulated, which should case INTEGER_UNDERFLOW when calculating customer's new total balance
      const [errorCode, tx, _error] = await readAndExecContract(moneyMarketHarness, 'withdraw', [OMG._address, 90], {from: customer});
      assert.hasErrorCode(errorCode, ErrorEnum.INSUFFICIENT_BALANCE);

      assert.hasLog(tx,
        "Failure",
        {
          error: ErrorEnum.INSUFFICIENT_BALANCE.toString(),
          info: FailureInfoEnum.WITHDRAW_NEW_TOTAL_BALANCE_CALCULATION_FAILED.toString(),
          detail: '0'
        }
      );
    });

    it('returns error and logs info if protocol total supply calculation fails', async () => {
      /*
      This one is tricky to test.
      The customer is withdrawing funds.
      Protocol has to have cash or it will fail out earlier than what we are trying to test.
      What we do is:
      1. Give protocol max uint cash.
      2. Give customer a balance and a giant supply rate
      3. Withdraw only a tiny amount
      This means that the customer balance even after the withdrawal will be larger than what they started with,
      due to the accumulated interest and we will get an INTEGER_OVERFLOW when trying to calculate the protocols'
      new total supply, even when Exponential.addThenSub tries reversing the order of operations as it does when
      the default order yields an overflow.
      */
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});
      const customer = accounts[1];
      const OMG = await EIP20.new(10**18, "test omg", 18, "omg").send({from: root});
      // Support market
      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(OMG._address, getExpMantissa(0.5)).send({from: root});
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});
      // Give protocol cash
      await OMG.methods.harnessSetBalance(moneyMarketHarness._address, 100).send({from: root});

      // Give the customer a balance to accrue that high interest on so that the accumulated interest will be higher than
      // the withdrawal amount
      await moneyMarketHarness.methods.harnessSetAccountSupplyBalance(customer, OMG._address, 10000, 1).send({from: root});

      // give customer a liquidity surplus (from imaginary other assets)
      await moneyMarketHarness.methods.harnessSetLiquiditySurplus(customer, 100).send({from: root});

      // Price ETH:OMG at 1:10
      await moneyMarketHarness.methods.harnessSetAssetPrice(OMG._address, 1, 10).send({from: root});

      // Set total supply of max uint and a supply rate of 50000bps per block so customer accumulates interest on
      // their previous balance that exceeds the amount they are withdrawing (so total supply will go UP)
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, bigNums.maxUint, 50000, 1, 0, 0, 1).send({from: root});

      const [errorCode, tx, _error] = await readAndExecContract(moneyMarketHarness, 'withdraw', [OMG._address, 1], {from: customer});
      assert.hasErrorCode(errorCode, ErrorEnum.INTEGER_OVERFLOW);

      assert.hasLog(tx,
        "Failure",
        {
          error: ErrorEnum.INTEGER_OVERFLOW.toString(),
          info: FailureInfoEnum.WITHDRAW_NEW_TOTAL_SUPPLY_CALCULATION_FAILED.toString(),
          detail: '0'
        }
      );
    });

    it('returns error and logs info if new supply rate calculation fails', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});
      const customer = accounts[1];
      const OMG = await EIP20.new(10**18, "test omg", 18, "omg").send({from: root});
      // Support market
      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(OMG._address, getExpMantissa(0.5)).send({from: root});
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});
      // Give protocol cash
      await OMG.methods.harnessSetBalance(moneyMarketHarness._address, 100).send({from: root});

      // Configure market state for OMG: a supply of 1000 and supply and borrow indexes of 1.
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 1000, 1, 1, 0, 0, 1).send({from: root});

      // Give customer some liquidity and an OMG supply balance
      await moneyMarketHarness.methods.harnessSetLiquiditySurplus(customer, 100).send({from: root});
      await moneyMarketHarness.methods.harnessSetAccountSupplyBalance(customer, OMG._address, 100, 1).send({from: root});

      // Set up FailingInterestModel for OMG market
      const FailableInterestRateModel = getContract("./test/FailableInterestRateModel.sol");
      const failableInterestRateModel = await FailableInterestRateModel.new(true, false).send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, failableInterestRateModel._address).send({from: root});

      const [errorCode, tx, _error] = await readAndExecContract(moneyMarketHarness, 'withdraw', [OMG._address, 5], {from: customer});
      assert.hasErrorCode(errorCode, ErrorEnum.OPAQUE_ERROR);

      assert.hasLog(tx,
        "Failure",
        {
          error: ErrorEnum.OPAQUE_ERROR.toString(),
          info: FailureInfoEnum.WITHDRAW_NEW_SUPPLY_RATE_CALCULATION_FAILED.toString(),
          detail: '10'
        }
      );
    });

    it('returns error and logs info if new borrow interest index calculation fails', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});
      const customer = accounts[1];
      const OMG = await EIP20.new(10**18, "test omg", 18, "omg").send({from: root});
      // Support market
      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(OMG._address, getExpMantissa(0.5)).send({from: root});
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});
      // Give protocol cash
      await OMG.methods.harnessSetBalance(moneyMarketHarness._address, 100).send({from: root});

      // Give customer some liquidity and an OMG supply balance
      await moneyMarketHarness.methods.harnessSetLiquiditySurplus(customer, 50).send({from: root});
      await moneyMarketHarness.methods.harnessSetAccountSupplyBalance(customer, OMG._address, 100, 2).send({from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});

      // Set current borrow interest index to maxUint so when we multiply by it we get an overflow
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 400, 100, 1, 1, 500, bigNums.maxUint).send({from: root});

      const [errorCode, tx, _error] = await readAndExecContract(moneyMarketHarness, 'withdraw', [OMG._address, 1], {from: customer});
      assert.hasErrorCode(errorCode, ErrorEnum.INTEGER_OVERFLOW);

      assert.hasLog(tx,
        "Failure",
        {
          error: ErrorEnum.INTEGER_OVERFLOW.toString(),
          info: FailureInfoEnum.WITHDRAW_NEW_BORROW_INDEX_CALCULATION_FAILED.toString(),
          detail: '0'
        }
      );
    });

    it('returns error and logs info if new borrow rate calculation fails', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});
      const customer = accounts[1];
      const OMG = await EIP20.new(10**18, "test omg", 18, "omg").send({from: root});
      // Support market
      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(OMG._address, getExpMantissa(0.5)).send({from: root});
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});
      // Give protocol cash
      await OMG.methods.harnessSetBalance(moneyMarketHarness._address, 100).send({from: root});

      // Give customer some liquidity and an OMG supply balance
      await moneyMarketHarness.methods.harnessSetLiquiditySurplus(customer, 50).send({from: root});
      await moneyMarketHarness.methods.harnessSetAccountSupplyBalance(customer, OMG._address, 100, 2).send({from: root});

      // Configure market state for OMG: a supply of 1000 and supply and borrow indexes of 1.
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 400, 100, 1, 1, 500, 100).send({from: root});

      // Set up FailingInterestModel for OMG market
      const FailableInterestRateModel = getContract("./test/FailableInterestRateModel.sol");
      const failableInterestRateModel = await FailableInterestRateModel.new(false, true).send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, failableInterestRateModel._address).send({from: root});

      const [errorCode, tx, _error] = await readAndExecContract(moneyMarketHarness, 'withdraw', [OMG._address, 10], {from: customer});
      assert.hasErrorCode(errorCode, ErrorEnum.OPAQUE_ERROR);

      assert.hasLog(tx,
        "Failure",
        {
          error: ErrorEnum.OPAQUE_ERROR.toString(),
          info: FailureInfoEnum.WITHDRAW_NEW_BORROW_RATE_CALCULATION_FAILED.toString(),
          detail: '20'
        }
      );
    });

    it('returns error and logs info if token transfer fails', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});
      const customer = accounts[1];
      const OMG = await EIP20.new(10**18, "test omg", 18, "omg").send({from: root});
      // Support market
      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(OMG._address, getExpMantissa(0.5)).send({from: root});
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});
      // Give protocol cash
      await OMG.methods.harnessSetBalance(moneyMarketHarness._address, 100).send({from: root});

      // Give customer some liquidity and an OMG supply balance
      await moneyMarketHarness.methods.harnessSetLiquiditySurplus(customer, 50).send({from: root});
      await moneyMarketHarness.methods.harnessSetAccountSupplyBalance(customer, OMG._address, 100, 2).send({from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});

      // Configure market state for OMG: a supply of 1000 and supply and borrow indexes of 1.
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 400, 100, 1, 1, 500, 100).send({from: root});

      // Use harness to set up a transfer out error
      await OMG.methods.harnessSetFailTransferToAddress(customer, true).send({from: root});

      const [errorCode, tx, _error] = await readAndExecContract(moneyMarketHarness, 'withdraw', [OMG._address, 1], {from: customer});
      assert.hasErrorCode(errorCode, ErrorEnum.TOKEN_TRANSFER_OUT_FAILED);

      assert.hasLog(tx,
        "Failure",
        {
          error: ErrorEnum.TOKEN_TRANSFER_OUT_FAILED.toString(),
          info: FailureInfoEnum.WITHDRAW_TRANSFER_OUT_FAILED.toString(),
          detail: '0'
        }
      );
    });

    it('reverts if non-standard token transfer fails', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});
      const customer = accounts[1];
      const OMG = await EIP20NonStandardThrow.new(10**18, "test omg ns", 18, "omg").send({from: root});
      // Support market
      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(OMG._address, getExpMantissa(0.5)).send({from: root});
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});
      // Give protocol cash
      await OMG.methods.harnessSetBalance(moneyMarketHarness._address, 100).send({from: root});

      // Give customer some liquidity and an OMG supply balance
      await moneyMarketHarness.methods.harnessSetLiquiditySurplus(customer, 50).send({from: root});
      await moneyMarketHarness.methods.harnessSetAccountSupplyBalance(customer, OMG._address, 100, 2).send({from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});

      // Configure market state for OMG: a supply of 1000 and supply and borrow indexes of 1.
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 400, 100, 1, 1, 500, 100).send({from: root});

      // Use harness to set up a transfer out error
      await OMG.methods.harnessSetFailTransferToAddress(customer, true).send({from: root});

      await assert.revert(moneyMarketHarness.methods.withdraw(OMG._address, 1).send({from: customer}));
    });

    it('emits SupplyWithdrawn event on success', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});
      const customer = accounts[1];
      const OMG = await EIP20.new(10**18, "test omg", 18, "omg").send({from: root});
      // Support market
      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(OMG._address, getExpMantissa(0.5)).send({from: root});
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});
      // Give protocol cash
      await OMG.methods.harnessSetBalance(moneyMarketHarness._address, 500).send({from: root});

      // Give customer some liquidity and an OMG supply balance
      await moneyMarketHarness.methods.harnessSetLiquiditySurplus(customer, 50).send({from: root});
      await moneyMarketHarness.methods.harnessSetAccountSupplyBalance(customer, OMG._address, 100, 1).send({from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});

      // Configure market state for OMG: a supply of 1000 and supply and borrow indexes of 1.
      const initialInterestIndex = 1;
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 1000, 0, initialInterestIndex, 0, 0, initialInterestIndex).send({from: root});

      const [errorCode, tx, _error] = await readAndExecContract(moneyMarketHarness, 'withdraw', [OMG._address, 1], {from: customer});
      assert.hasErrorCode(errorCode, ErrorEnum.NO_ERROR);

      assert.hasLog(tx,
        "SupplyWithdrawn",
        {
          account: checksum(customer),
          asset: OMG._address,
          amount: '1',
          startingBalance: '100',
          newBalance: '99',
        }
      );

      const customerTokenBalance = await OMG.methods.balanceOf(customer).call();
      assert.equal(1, customerTokenBalance);

      const customerCompoundBalance = await moneyMarketHarness.methods.supplyBalances(customer, OMG._address).call();
      assert.equal(99, customerCompoundBalance.principal);
      assert.equal(initialInterestIndex, customerCompoundBalance.interestIndex);
    });

    it('fails withdraw with zero oracle price', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});
      const customer = accounts[1];
      const OMG = await EIP20.new(10**18, "test omg", 18, "omg").send({from: root});
      // Support market
      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(OMG._address, getExpMantissa(0.5)).send({from: root});
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});
      // Give protocol cash
      await OMG.methods.harnessSetBalance(moneyMarketHarness._address, 500).send({from: root});

      // Give customer some liquidity and an OMG supply balance
      await moneyMarketHarness.methods.harnessSetLiquiditySurplus(customer, 50).send({from: root});
      await moneyMarketHarness.methods.harnessSetAccountSupplyBalance(customer, OMG._address, 100, 1).send({from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});

      // Configure market state for OMG: a supply of 1000 and supply and borrow indexes of 1.
      const initialInterestIndex = 1;
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 1000, 0, initialInterestIndex, 0, 0, initialInterestIndex).send({from: root});

      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(OMG._address, 0).send({from: root});

      const [errorCode, tx, _error] = await readAndExecContract(moneyMarketHarness, 'withdraw', [OMG._address, 1], {from: customer});
      assert.hasErrorCode(errorCode, ErrorEnum.MISSING_ASSET_PRICE);

      assert.hasLog(tx,
        "Failure",
        {
          error: ErrorEnum.MISSING_ASSET_PRICE.toString(),
          info: FailureInfoEnum.WITHDRAW_AMOUNT_VALUE_CALCULATION_FAILED.toString(),
          detail: '0'
        }
      );

      const customerTokenBalance = await OMG.methods.balanceOf(customer).call();
      assert.equal(0, customerTokenBalance);

      const customerCompoundBalance = await moneyMarketHarness.methods.supplyBalances(customer, OMG._address).call();
      assert.equal(100, customerCompoundBalance.principal);
    });

    it('emits SupplyWithdrawn event on non-standard token success', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});
      const customer = accounts[1];
      const OMG = await EIP20NonStandardThrow.new(10**18, "test omg ns", 18, "omg").send({from: root});
      // Support market
      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(OMG._address, getExpMantissa(0.5)).send({from: root});
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});
      // Give protocol cash
      await OMG.methods.harnessSetBalance(moneyMarketHarness._address, 500).send({from: root});

      // Give customer some liquidity and an OMG supply balance
      await moneyMarketHarness.methods.harnessSetLiquiditySurplus(customer, 50).send({from: root});
      await moneyMarketHarness.methods.harnessSetAccountSupplyBalance(customer, OMG._address, 100, 1).send({from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});

      // Configure market state for OMG: a supply of 1000 and supply and borrow indexes of 1.
      const initialInterestIndex = 1;
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 1000, 0, initialInterestIndex, 0, 0, initialInterestIndex).send({from: root});

      const [errorCode, tx, _error] = await readAndExecContract(moneyMarketHarness, 'withdraw', [OMG._address, 1], {from: customer});
      assert.hasErrorCode(errorCode, ErrorEnum.NO_ERROR);

      assert.hasLog(tx,
        "SupplyWithdrawn",
        {
          account: checksum(customer),
          asset: OMG._address,
          amount: '1',
          startingBalance: '100',
          newBalance: '99',
        }
      );

      const customerTokenBalance = await OMG.methods.balanceOf(customer).call();
      assert.equal(1, customerTokenBalance);

      const customerCompoundBalance = await moneyMarketHarness.methods.supplyBalances(customer, OMG._address).call();
      assert.equal(99, customerCompoundBalance.principal);
      assert.equal(initialInterestIndex, customerCompoundBalance.interestIndex);
    });

    it('loves @gas', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});
      const customer = accounts[1];
      const OMG = await EIP20.new(10**18, "test omg", 18, "omg").send({from: root});
      // Support market
      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(OMG._address, getExpMantissa(0.5)).send({from: root});
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});
      // Give protocol cash
      await OMG.methods.harnessSetBalance(moneyMarketHarness._address, 500).send({from: root});

      // Give customer some liquidity and an OMG supply balance
      await moneyMarketHarness.methods.harnessSetLiquiditySurplus(customer, 50).send({from: root});
      await moneyMarketHarness.methods.harnessSetAccountSupplyBalance(customer, OMG._address, 100, 1).send({from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});

      // Configure market state for OMG: a supply of 1000 and supply and borrow indexes of 1.
      const initialInterestIndex = 1;
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 1000, 0, initialInterestIndex, 0, 0, initialInterestIndex).send({from: root});

      // Warm the pot
      await readAndExecContract(moneyMarketHarness, 'withdraw', [OMG._address, 1], {from: customer});

      const [errorCode, tx, _error] = await readAndExecContract(moneyMarketHarness, 'withdraw', [OMG._address, 1], {from: customer});
      assert.hasErrorCode(errorCode, ErrorEnum.NO_ERROR);

      assert.hasLog(tx,
        "SupplyWithdrawn",
        {
          account: checksum(customer),
          asset: OMG._address,
          amount: '1'
        }
      );

      assert.withinGas(tx, 101e3, 5000, "should be about 101K gas", true);
    });

    it('allows withdraw when market is not supported', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});
      const customer = accounts[1];
      const OMG = await EIP20.new(10**18, "test omg", 18, "omg").send({from: root});
      // Support market
      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(OMG._address, getExpMantissa(0.5)).send({from: root});
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});
      // Give protocol cash
      await OMG.methods.harnessSetBalance(moneyMarketHarness._address, 500).send({from: root});

      // Give customer some liquidity and an OMG supply balance
      await moneyMarketHarness.methods.harnessSetLiquiditySurplus(customer, 50).send({from: root});
      await moneyMarketHarness.methods.harnessSetAccountSupplyBalance(customer, OMG._address, 100, 1).send({from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});

      // Configure market state for OMG: a supply of 1000 and supply and borrow indexes of 1.
      const initialInterestIndex = 1;
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 1000, 0, initialInterestIndex, 0, 0, initialInterestIndex).send({from: root});

      // now suspend OMG market before we attempt withdrawal
      await moneyMarketHarness.methods._suspendMarket(OMG._address).send({from: root});

      const [errorCode, tx, _error] = await readAndExecContract(moneyMarketHarness, 'withdraw', [OMG._address, 1], {from: customer});
      assert.hasErrorCode(errorCode, ErrorEnum.NO_ERROR);

      assert.hasLog(tx,
        "SupplyWithdrawn",
        {
          account: checksum(customer),
          asset: OMG._address,
          amount: '1',
          startingBalance: '100',
          newBalance: '99',
        }
      );

      const customerTokenBalance = await OMG.methods.balanceOf(customer).call();
      assert.equal(1, customerTokenBalance);

      const customerCompoundBalance = await moneyMarketHarness.methods.supplyBalances(customer, OMG._address).call();
      assert.equal(99, customerCompoundBalance.principal);
      assert.equal(initialInterestIndex, customerCompoundBalance.interestIndex);
    });

    it('special withdraw max value allows all tokens when customer has no borrows', async () => {
      // all tokens can be withdrawn
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});
      const customer = accounts[1];
      const OMG = await EIP20.new(10**18, "test omg", 18, "omg").send({from: root});
      // Support market
      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(OMG._address, getExpMantissa(0.5)).send({from: root});
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});
      // Give protocol cash
      await OMG.methods.harnessSetBalance(moneyMarketHarness._address, 500).send({from: root});

      // Give customer some liquidity and an OMG supply balance
      await moneyMarketHarness.methods.harnessSetLiquiditySurplus(customer, 100).send({from: root});
      await moneyMarketHarness.methods.harnessSetAccountSupplyBalance(customer, OMG._address, 100, 1).send({from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});

      // Configure market state for OMG: a supply of 1000 and supply and borrow indexes of 1.
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 1000, 0, 1, 0, 0, 1).send({from: root});
      await moneyMarketHarness.methods.harnessSetAssetPrice(OMG._address, 1, 1).send({from: root});

      const [errorCode, tx, _error] = await readAndExecContract(moneyMarketHarness, 'withdraw', [OMG._address, -1], {from: customer});
      assert.hasErrorCode(errorCode, ErrorEnum.NO_ERROR);

      assert.hasLog(tx,
        "SupplyWithdrawn",
        {
          account: checksum(customer),
          asset: OMG._address,
          amount: '100',
          startingBalance: '100',
          newBalance: '0',
        }
      );

      const customerTokenBalance = await OMG.methods.balanceOf(customer).call();
      assert.equal(100, customerTokenBalance);

      const customerCompoundBalance = await moneyMarketHarness.methods.supplyBalances(customer, OMG._address).call();
      assert.equal(0, customerCompoundBalance.principal);

    });

    it('special withdraw max value allows partial token withdrawal when customer has limited liquidity', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});
      const customer = accounts[1];
      const OMG = await EIP20.new(10**18, "test omg", 18, "omg").send({from: root});
      // Support market
      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(OMG._address, getExpMantissa(0.5)).send({from: root});
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});
      // Give protocol cash
      await OMG.methods.harnessSetBalance(moneyMarketHarness._address, 500).send({from: root});

      // Give customer some liquidity and an OMG supply balance
      await moneyMarketHarness.methods.harnessSetLiquiditySurplus(customer, 35).send({from: root});
      await moneyMarketHarness.methods.harnessSetAccountSupplyBalance(customer, OMG._address, 100, 1).send({from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});

      // Configure market state for OMG: a supply of 1000 and supply and borrow indexes of 1.
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 1000, 0, 1, 0, 0, 1).send({from: root});
      await moneyMarketHarness.methods.harnessSetAssetPrice(OMG._address, 1, 1).send({from: root});

      // Customer has a liquidity surplus of 35 and we've priced OMG equal to ETH, so only 35 should be withdrawn.
      const [errorCode, tx, _error] = await readAndExecContract(moneyMarketHarness, 'withdraw', [OMG._address, -1], {from: customer});
      assert.hasErrorCode(errorCode, ErrorEnum.NO_ERROR);

      assert.hasLog(tx,
        "SupplyWithdrawn",
        {
          account: checksum(customer),
          asset: OMG._address,
          amount: '35',
          startingBalance: '100',
          newBalance: '65',
        }
      );

      const customerTokenBalance = await OMG.methods.balanceOf(customer).call();
      assert.equal(35, customerTokenBalance);

      const customerCompoundBalance = await moneyMarketHarness.methods.supplyBalances(customer, OMG._address).call();
      assert.equal(65, customerCompoundBalance.principal);
    });

    it('special withdraw max value returns an error if withdraw capacity calculation fails', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});
      const customer = accounts[1];
      const OMG = await EIP20.new(10**18, "test omg", 18, "omg").send({from: root});
      // Support market
      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(OMG._address, getExpMantissa(0.5)).send({from: root});
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});
      // Give protocol cash
      await OMG.methods.harnessSetBalance(moneyMarketHarness._address, 500).send({from: root});

      // Give customer some liquidity and an OMG supply balance
      await moneyMarketHarness.methods.harnessSetLiquiditySurplus(customer, 35).send({from: root});
      await moneyMarketHarness.methods.harnessSetAccountSupplyBalance(customer, OMG._address, 100, 1).send({from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});

      // Configure market state for OMG: a supply of 1000 and supply and borrow indexes of 1.
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 1000, 0, 1, 0, 0, 1).send({from: root});

      // setting the price of OMG to 0 will cause a division by zero error when calculating the withdraw capacity
      await moneyMarketHarness.methods.harnessSetAssetPrice(OMG._address, 0, 1).send({from: root});

      const [errorCode, tx, _error] = await readAndExecContract(moneyMarketHarness, 'withdraw', [OMG._address, -1], {from: customer});
      assert.hasErrorCode(errorCode, ErrorEnum.DIVISION_BY_ZERO);

      assert.hasLog(tx,
        "Failure",
        {
          error: ErrorEnum.DIVISION_BY_ZERO.toString(),
          info: FailureInfoEnum.WITHDRAW_CAPACITY_CALCULATION_FAILED.toString(),
          detail: '0'
        }
      );

      const customerTokenBalance = await OMG.methods.balanceOf(customer).call();
      assert.equal(0, customerTokenBalance);

      const customerCompoundBalance = await moneyMarketHarness.methods.supplyBalances(customer, OMG._address).call();
      assert.equal(100, customerCompoundBalance.principal);
    });

    it('allows withdraw of zero for customer with positive liquidity and 0 shortfall', async() => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});
      const customer = accounts[1];
      const OMG = await EIP20.new(10**18, "test omg", 18, "omg").send({from: root});
      // Support market
      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(OMG._address, getExpMantissa(0.5)).send({from: root});
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});
      // Give protocol cash
      await OMG.methods.harnessSetBalance(moneyMarketHarness._address, 500).send({from: root});

      // Give customer some liquidity and an OMG supply balance
      await moneyMarketHarness.methods.harnessSetLiquiditySurplus(customer, 50).send({from: root});
      await moneyMarketHarness.methods.harnessSetAccountSupplyBalance(customer, OMG._address, 100, 1).send({from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});

      // Configure market state for OMG: a supply of 1000 and supply and borrow indexes of 1.
      const initialInterestIndex = 1;
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 1000, 0, initialInterestIndex, 0, 0, initialInterestIndex).send({from: root});

      const [errorCode, tx, _error] = await readAndExecContract(moneyMarketHarness, 'withdraw', [OMG._address, 0], {from: customer});
      assert.hasErrorCode(errorCode, ErrorEnum.NO_ERROR);

      assert.hasLog(tx,
        "SupplyWithdrawn",
        {
          account: checksum(customer),
          asset: OMG._address,
          amount: '0',
          startingBalance: '100',
          newBalance: '100',
        }
      );

      const customerTokenBalance = await OMG.methods.balanceOf(customer).call();
      assert.equal(0, customerTokenBalance);

      const customerCompoundBalance = await moneyMarketHarness.methods.supplyBalances(customer, OMG._address).call();
      assert.equal(100, customerCompoundBalance.principal);
      assert.equal(initialInterestIndex, customerCompoundBalance.interestIndex);
    });

    it('allows withdraw of zero for customer with 0 liquidity and 0 shortfall', async() => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});
      const customer = accounts[1];
      const OMG = await EIP20.new(10**18, "test omg", 18, "omg").send({from: root});
      // Support market
      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(OMG._address, getExpMantissa(0.5)).send({from: root});
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});
      // Give protocol cash
      await OMG.methods.harnessSetBalance(moneyMarketHarness._address, 500).send({from: root});

      // Give customer 0 liquidity, 0 shortfall (just to make this test setup explicit) and an OMG supply balance
      await moneyMarketHarness.methods.harnessSetLiquiditySurplus(customer, 0).send({from: root});
      await moneyMarketHarness.methods.harnessSetLiquidityShortfall(customer, 0).send({from: root});
      await moneyMarketHarness.methods.harnessSetAccountSupplyBalance(customer, OMG._address, 100, 1).send({from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});

      // Configure market state for OMG: a supply of 1000 and supply and borrow indexes of 1.
      const initialInterestIndex = 1;
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 1000, 0, initialInterestIndex, 0, 0, initialInterestIndex).send({from: root});

      const [errorCode, tx, _error] = await readAndExecContract(moneyMarketHarness, 'withdraw', [OMG._address, 0], {from: customer});
      assert.hasErrorCode(errorCode, ErrorEnum.NO_ERROR);

      assert.hasLog(tx,
        "SupplyWithdrawn",
        {
          account: checksum(customer),
          asset: OMG._address,
          amount: '0',
          startingBalance: '100',
          newBalance: '100',
        }
      );

      const customerTokenBalance = await OMG.methods.balanceOf(customer).call();
      assert.equal(0, customerTokenBalance);

      const customerCompoundBalance = await moneyMarketHarness.methods.supplyBalances(customer, OMG._address).call();
      assert.equal(100, customerCompoundBalance.principal);
      assert.equal(initialInterestIndex, customerCompoundBalance.interestIndex);
    });

    it('disallows withdraw of zero for customer with a positive shortfall', async() => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});
      const customer = accounts[1];
      const OMG = await EIP20.new(10**18, "test omg", 18, "omg").send({from: root});
      // Support market
      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(OMG._address, getExpMantissa(0.5)).send({from: root});
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});
      // Give protocol cash
      await OMG.methods.harnessSetBalance(moneyMarketHarness._address, 500).send({from: root});

      // Give customer a liquidity shortfall and an OMG supply balance
      await moneyMarketHarness.methods.harnessSetLiquidityShortfall(customer, 35).send({from: root});
      await moneyMarketHarness.methods.harnessSetAccountSupplyBalance(customer, OMG._address, 100, 1).send({from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});

      // Configure market state for OMG: a supply of 1000 and supply and borrow indexes of 1.
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 1000, 0, 1, 0, 0, 1).send({from: root});
      await moneyMarketHarness.methods.harnessSetAssetPrice(OMG._address, 1, 1).send({from: root});

      // Customer has a liquidity shortfall of 35 so withdraw 0 should be blocked
      const [errorCode, tx, _error] = await readAndExecContract(moneyMarketHarness, 'withdraw', [OMG._address, 0], {from: customer});
      assert.hasErrorCode(errorCode, ErrorEnum.INSUFFICIENT_LIQUIDITY);

      assert.hasLog(tx,
        "Failure",
        {
          error: ErrorEnum.INSUFFICIENT_LIQUIDITY.toString(),
          info: FailureInfoEnum.WITHDRAW_ACCOUNT_SHORTFALL_PRESENT.toString(),
          detail: '0'
        })
    });

  });

  describe('getSupplyBalance', async () => {
    it('returns balance in happy path when there is no interest to accumulate', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});

      // We cause 0 interest by setting customerInterestIndex = supplyIndex, and supplyRateBasisPoints = 0
      const principal = 55;
      const customerInterestIndex = 1;
      const asset = OMG._address;
      const totalSupply = 1;
      const supplyRateBasisPoints = 0;
      const supplyIndex = 1;
      const totalBorrows = 0;
      const borrowRateBasisPoints = 0;
      const borrowIndex = 1;

      await moneyMarketHarness.methods.harnessSetAccountSupplyBalanceAndMarketDetails(customer, asset, principal, customerInterestIndex,
        totalSupply, supplyRateBasisPoints, supplyIndex, totalBorrows, borrowRateBasisPoints, borrowIndex).send({from: root});

      const customerBalance = await moneyMarketHarness.methods.getSupplyBalance(customer, asset).call();

      assert.equal(customerBalance, principal);
    });

    it('returns balance in happy path when there IS interest to accumulate', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});

      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});

      // We cause the principal to be quadrupled by setting supplyIndex = 2 * customerInterestIndex, and supplyRateBasisPoints = 10000
      // One block of 100% interest causes supplyIndex of 2 to be doubled to 4.
      // We calculate new balance by multiplying customer balance by 4/1.  55*4 = 220.
      const principal = 55;
      const customerInterestIndex = 1;
      const asset = OMG._address;
      const totalSupply = 1;
      const supplyRateBasisPoints = 10000;
      const supplyIndex = 2;
      const totalBorrows = 0;
      const borrowRateBasisPoints = 0;
      const borrowIndex = 1;

      await moneyMarketHarness.methods.harnessSetAccountSupplyBalanceAndMarketDetails(customer, asset, principal, customerInterestIndex,
        totalSupply, supplyRateBasisPoints, supplyIndex, totalBorrows, borrowRateBasisPoints, borrowIndex).send({from: root});

      const customerBalance = await moneyMarketHarness.methods.getSupplyBalance(customer, asset).call();
      assert.equal(customerBalance, 220);
    });

    it('returns 0 on an unsupported market', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      const customerBalance = await moneyMarketHarness.methods.getSupplyBalance(customer, OMG._address).call();
      assert.equal(customerBalance, 0);
    });

    it('returns 0 balance for supported market where customer has no balance', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer1 = accounts[1];
      const customer2 = accounts[2];

      // We set up customer1 with a balance so there is data in the system but then check the balance of customer2.
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});

      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});
      const principal = 55;
      const customerInterestIndex = 1;
      const asset = OMG._address;
      const totalSupply = 1;
      const supplyRateBasisPoints = 10000;
      const supplyIndex = 2;
      const totalBorrows = 0;
      const borrowRateBasisPoints = 0;
      const borrowIndex = 1;

      await moneyMarketHarness.methods.harnessSetAccountSupplyBalanceAndMarketDetails(customer1, asset, principal, customerInterestIndex,
        totalSupply, supplyRateBasisPoints, supplyIndex, totalBorrows, borrowRateBasisPoints, borrowIndex).send({from: root});

      const customerBalance = await moneyMarketHarness.methods.getSupplyBalance(customer2, asset).call();
      assert.equal(customerBalance, 0);
    });
  });

  describe('getBorrowBalance', async () => {
    it('returns balance in happy path when there is no interest to accumulate', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});

      // We cause 0 interest by setting customerInterestIndex = borrowIndex, and borrowRateBasisPoints = 0
      const principal = 55;
      const customerInterestIndex = 1;
      const asset = OMG._address;
      const totalBorrow = 1;
      const borrowRateBasisPoints = 0;
      const borrowIndex = 1;
      const totalBorrows = 0;
      const supplyRateBasisPoints = 0;
      const supplyIndex = 1;

      await moneyMarketHarness.methods.harnessSetAccountBorrowBalanceAndMarketDetails(customer, asset, principal, customerInterestIndex,
        totalBorrow, supplyRateBasisPoints, supplyIndex, totalBorrows, borrowRateBasisPoints, borrowIndex).send({from: root});

      const customerBalance = await moneyMarketHarness.methods.getBorrowBalance(customer, asset).call();

      assert.equal(customerBalance, principal);
    });

    it('returns balance in happy path when there IS interest to accumulate', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});

      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});

      // We cause the principal to be quadrupled by setting borrowIndex = 2 * customerInterestIndex, and borrowRateBasisPoints = 10000
      // One block of 100% interest causes borrowIndex of 2 to be doubled to 4.
      // We calculate new balance by multiplying customer balance by 4/1.  55*4 = 220.
      const principal = 55;
      const customerInterestIndex = 1;
      const asset = OMG._address;
      const totalBorrow = 1;
      const borrowRateBasisPoints = 10000;
      const borrowIndex = 2;
      const totalBorrows = 0;
      const supplyRateBasisPoints = 0;
      const supplyIndex = 1;

      await moneyMarketHarness.methods.harnessSetAccountBorrowBalanceAndMarketDetails(customer, asset, principal, customerInterestIndex,
        totalBorrow, borrowRateBasisPoints, borrowIndex, totalBorrows, borrowRateBasisPoints, borrowIndex).send({from: root});

      const customerBalance = await moneyMarketHarness.methods.getBorrowBalance(customer, asset).call();
      assert.equal(customerBalance, 220);
    });

    it('returns 0 on an unsupported market', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      const customerBalance = await moneyMarketHarness.methods.getBorrowBalance(customer, OMG._address).call();
      assert.equal(customerBalance, 0);
    });

    it('returns 0 balance for supported market where customer has no balance', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer1 = accounts[1];
      const customer2 = accounts[2];

      // We set up customer1 with a balance so there is data in the system but then check the balance of customer2.
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});

      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});
      const principal = 55;
      const customerInterestIndex = 1;
      const asset = OMG._address;
      const totalBorrow = 1;
      const borrowRateBasisPoints = 10000;
      const borrowIndex = 2;
      const totalBorrows = 0;
      const supplyRateBasisPoints = 0;
      const supplyIndex = 1;

      await moneyMarketHarness.methods.harnessSetAccountBorrowBalanceAndMarketDetails(customer1, asset, principal, customerInterestIndex,
        totalBorrow, borrowRateBasisPoints, borrowIndex, totalBorrows, borrowRateBasisPoints, borrowIndex).send({from: root});

      const customerBalance = await moneyMarketHarness.methods.getBorrowBalance(customer2, asset).call();
      assert.equal(customerBalance, 0);
    });
  });

  describe('harnessCalculateAccountLiquidity', async () => {
    // For simplicity, we'll use the same basis points and interest indexes for all
    // assets under test.
    let account;
    let collateralRatio;
    let supplyInterestIndex;
    let borrowInterestIndex;
    let supplyRateBasisPoints;
    let borrowRateBasisPoints;

    before(async () => {
      account = accounts[0];
      collateralRatio = 2;
      supplyInterestIndex = 1;
      borrowInterestIndex = 1;
      supplyRateBasisPoints = 2;
      borrowRateBasisPoints = 5;
    });

    // List of scenarios we will run for various token balances
    // and expected errors, liquidity &shortfalls.
    [
      {
        name: 'Nothing supplied or borrowed',
        tokens: {},
        balances: {},
        expected: {liquidity: 0.0, shortfall: 0.0}
      },
      {
        name: 'Single supply',
        tokens: {ETH: 1.0},
        balances: {supply: {ETH: 1}},
        expected: {liquidity: 1.0, shortfall: 0}
      },
      {
        name: 'Single borrow', // should not be possible but still
        tokens: {OMG: 0.5},
        balances: {borrow: {OMG: 1}},
        expected: {liquidity: 0.0, shortfall: 1.0}
      },
      {
        name: 'Supply of 2 assets',
        tokens: {ETH: 1.0, OMG: 0.5},
        balances: {supply: {ETH: 1, OMG: 5}},
        expected: {liquidity: 3.5, shortfall: 0.0}
      },
      {
        name: 'Borrow of 2 assets', // again should not be possible
        tokens: {ETH: 1.0, OMG: 0.5},
        balances: {borrow: {ETH: 1, OMG: 5}},
        expected: {liquidity: 0.0, shortfall: 7.0}
      },
      {
        name: 'Single supply, single borrow cancel out (collatRatio = 2)',
        tokens: {ETH: 1.0, OMG: 1.0},
        balances: {supply: {ETH: 2}, borrow: {OMG: 1}},
        expected: {liquidity: 0.0, shortfall: 0.0}
      },
      {
        name: 'Supply 1 OMG Wei, Borrow 1 ETH Wei. Prices (ETH: 1.0, OMG: 0.5)',
        tokens: {ETH: 1.0, OMG: 0.5},
        balances: {supply: {OMG: 1}, borrow: {ETH: 1}},
        expected: {liquidity: 0.0, shortfall: 1.5}
      },
      { // 500 OMG @ 0.018206 = 9.103 ETH Supplies (actual Eth, not Eth Wei)
        // 9.103 - 2(1 ETH) = 7.13 ETH liquidity
        name: 'Supply 500 OMG, Borrow 1 ETH. Prices (ETH: 1.0, OMG: 0.018206)',
        tokens: {ETH: 1.0, OMG: 0.018206},
        balances: {supply: {OMG: 500e18}, borrow: {ETH: 1e18}},
        expected: {liquidity: 7.103e18, shortfall: 0.0}
      },
      { // 500 OMG @ 0.018206 = 9.103 ETH Supplies (actual Eth, not Eth Wei)
        // 9.103 - 2(5 ETH) = 7.13 ETH shortfall
        name: 'Supply 500 OMG, Borrow 5 ETH. Prices (ETH: 1.0, OMG: 0.018206)',
        tokens: {ETH: 1.0, OMG: 0.018206},
        balances: {supply: {OMG: 500e18}, borrow: {ETH: 5e18}},
        expected: {liquidity: 0.0, shortfall: 0.897e18}
      },
      {
        name: 'Supply 1 OMG Wei, Borrow 1 ETH Wei. Prices (ETH: 1.0, OMG: 0.5) & collatRatio = 1',
        tokens: {ETH: 1.0, OMG: 0.5},
        balances: {supply: {OMG: 1}, borrow: {ETH: 1}},
        collateralRatio: 1.0,
        expected: {liquidity: 0.0, shortfall: 0.5}
      },
      { // 75 OMG @ 0.018206 = 1.36545 ETH Supplies (actual Eth, not Eth Wei)
        // 1.36545 - 1.5(1.5) ETH) = 0.88455 ETH shortfall
        name: 'Supply 75 OMG, Borrow 1.5 ETH. Prices (ETH: 1.0, OMG: 0.018206) & collatRatio = 1.5',
        tokens: {ETH: 1.0, OMG: 0.018206},
        balances: {supply: {OMG: 75e18}, borrow: {ETH: 1.5e18}},
        collateralRatio: 1.5,
        expected: {liquidity: 0.0, shortfall: 0.88455e18}
      },
      { // 8 ETH @ 1 = 8 ETH Supplies (actual Eth, not Eth Wei)
        // 100 OMG @ 0.018206 = 1.8206 ETH Borrows
        // 8 - 3(1.8206) ETH) = 2.5382 ETH liquidity
        name: 'Supply 8 ETH, Borrow 100 OMG. Prices (ETH: 1.0, OMG: 0.018206) & collatRatio = 3',
        tokens: {ETH: 1.0, OMG: 0.018206},
        balances: {supply: {ETH: 8e18}, borrow: {OMG: 100e18}},
        collateralRatio: 3.0,
        expected: {liquidity: 2.5382e18, shortfall: 0.0}
      }
    ].forEach((args) => {

      it(args['name'], async () => {
        const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

        const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});

        // Default collateral ratio = 2, unless scenario specifies.
        if (args.hasOwnProperty('collateralRatio')) {
          await moneyMarketHarness.methods.harnessSetCollateralRatio(getExpMantissa(args['collateralRatio']), getExpMantissa(1)).send({from: root});
        } else {
          await moneyMarketHarness.methods.harnessSetCollateralRatio(2, 1).send({from: root});
        }

        // Add collateral assets and then set the asset prices
        Object.entries(args['tokens']).forEach(([key, value]) => {
          assert.isTrue(assets.hasOwnProperty(key), 'Token key must exist in assets: ' + JSON.stringify(args));

          // Set the interest model
          moneyMarketHarness.methods.harnessSetMarketInterestRateModel(assets[key], simpleInterestRateModel._address).send({from: root});

          // Add the collateral market
          moneyMarketHarness.methods.harnessAddCollateralMarket(assets[key]).send({from: root});

          // Set the prices
          moneyMarketHarness.methods.harnessSetAssetPrice(assets[key], getExpMantissa(value), getExpMantissa(1)).send({from: root});
        });

        // Set the balances and add up supply/balance totals for each market so we can set them also
        let marketSupplyTotals = {};
        let marketBorrowTotals = {};
        await Promise.all(Object.entries(args['balances']).map(([balanceKey, balanceValue]) => {
          if (balanceKey === 'supply' || balanceKey === 'borrow') {
            return Promise.all(Object.entries(balanceValue).map(([assetKey, assetAmount]) => {
              assert.isTrue(assets.hasOwnProperty(assetKey), 'Balance key must exist in assets: ' + JSON.stringify(args));

              // Add an entry for both running sums if we haven't already
              if (!marketSupplyTotals.hasOwnProperty(assetKey)) {
                marketSupplyTotals[assetKey] = 0;
              }
              if (!marketBorrowTotals.hasOwnProperty(assetKey)) {
                marketBorrowTotals[assetKey] = 0;
              }

              if (balanceKey === 'supply') {
                marketSupplyTotals[assetKey] += assetAmount;

                return moneyMarketHarness.methods.harnessSetAccountSupplyBalance(account, assets[assetKey], assetAmount, supplyInterestIndex).send({from: root});
              } else {
                marketBorrowTotals[assetKey] += assetAmount;

                return moneyMarketHarness.methods.harnessSetAccountBorrowBalance(account, assets[assetKey], assetAmount, borrowInterestIndex).send({from: root});
              }
            }));
          }
        }));

        // Lastly, set the market details with our supply/borrow totals
        // Using a for of here to allow us to await setting the money market details.
        for (let assetKey of Object.keys(marketSupplyTotals)) {
          await moneyMarketHarness.methods.harnessSetMarketDetails(assets[assetKey],
                                                     marketSupplyTotals[assetKey],
                                                     supplyRateBasisPoints,
                                                     supplyInterestIndex,
                                                     marketBorrowTotals[assetKey],
                                                     borrowRateBasisPoints,
                                                     borrowInterestIndex).send({from: root});
        }

        const result = await moneyMarketHarness.methods.harnessCalculateAccountLiquidity(account).call();

        assert.noError(result[0]);
        assert.withinPercentage(getExpMantissa(args['expected']['liquidity']), result[1], 10e-10, 'Expected liquidity not within percentage for scenario: ' + JSON.stringify(args));
        assert.withinPercentage(getExpMantissa(args['expected']['shortfall']), result[2], 10e-10, 'Expected shortfall not within percentage  for scenario: ' + JSON.stringify(args));

        const liquidity = Number(await moneyMarketHarness.methods.getAccountLiquidity(account).call());
        const expLiq = args['expected']['liquidity'] - args['expected']['shortfall'];

        assert.withinPercentage(Math.trunc(expLiq), liquidity, 10e-10, 'Expected total account liquidity not within percentage for scenario: ' + JSON.stringify(args));
      });
    })

    it('returns account liquidity when there IS Supply interest to accumulate', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      await moneyMarketHarness.methods.harnessSetCollateralRatio(2, 1).send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});
      const ETH = await EIP20.new(100, "eth", 18, "eth").send({from: root});

      // Set up SimpleInterestRateModel for OMG & ETH markets
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});

      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(ETH._address, simpleInterestRateModel._address).send({from: root});

      // Add the collateral market
      await moneyMarketHarness.methods.harnessAddCollateralMarket(OMG._address).send({from: root});
      await moneyMarketHarness.methods.harnessAddCollateralMarket(ETH._address).send({from: root});

      // Set the prices (ETH = 1.0, OMG = 0.01908530)
      await moneyMarketHarness.methods.harnessSetAssetPrice(OMG._address, getExpMantissa(0.01908530), getExpMantissa(1)).send({from: root});
      await moneyMarketHarness.methods.harnessSetAssetPrice(ETH._address, 1, 1).send({from: root});

      // First test is to have supplied 75 OMG @ Supply Rate of 50% and Borrow 1 ETH @ Rate of 0%
      const omgSupplied = 75e18;
      const ethBorrowed = 1e18;
      const customerSupplyInterestIndex = 1;
      const supplyRateBasisPoints = 5000;
      const supplyIndex = 2;
      const customerBorrowInterestIndex = 1;
      const borrowRateBasisPoints = 0;
      const borrowIndex = 1;

      // Setup OMG balances (causes 2 blocks to be mined)
      await moneyMarketHarness.methods.harnessSetAccountSupplyBalance(account, OMG._address, omgSupplied, customerSupplyInterestIndex).send({from: root});
      await moneyMarketHarness.methods.harnessSetAccountBorrowBalance(account, OMG._address, 0, customerBorrowInterestIndex).send({from: root});

      // Setup ETH balances (causes 2 more blocks to be mined)
      await moneyMarketHarness.methods.harnessSetAccountSupplyBalance(account, ETH._address, 0, customerSupplyInterestIndex).send({from: root});
      await moneyMarketHarness.methods.harnessSetAccountBorrowBalance(account, ETH._address, ethBorrowed, customerBorrowInterestIndex).send({from: root});

      // Here is the tricky part. Interest is calculated by using the delta for the current
      // block and the block number stored in the market. So we need to make sure we know
      // how many blocks are mined from now until the calculateLiquidity call. (2 blocks)
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address,
                                                     omgSupplied,
                                                     supplyRateBasisPoints,
                                                     supplyIndex,
                                                     0,
                                                     0,
                                                     borrowIndex).send({from: root});

      await moneyMarketHarness.methods.harnessSetMarketDetails(ETH._address,
                                                     0,
                                                     0,
                                                     supplyIndex,
                                                     ethBorrowed,
                                                     borrowRateBasisPoints,
                                                     borrowIndex).send({from: root});

      /** We cause the OMG supply principal to be quadrupled by setting supplyIndex = 2 * customerInterestIndex, and supplyRateBasisPoints = 5000
        * Two blocks of 50% interest causes supplyIndex of 2 to be doubled to 4.
        * We calculate new OMG supply balance by multiplying principal by 4/1.  75e18*4 = 300e18.
        *
        * We keep the ETH borrow principal constant by setting supplyIndex = 1 = customerInterestInterestIndex, and borrowRateBasisPoints = 0
        *
        * Finally, with a collateral ratio of 2, we expect the following liquidity results:
        * 300 OMG @ 0.01908530 = 5.72559 ETH Supplies (actual Eth, not Eth Wei)
        * 5.72559 - 2(1) ETH) = 3.72559 ETH liquidity
        */
      const result = await moneyMarketHarness.methods.harnessCalculateAccountLiquidity(account).call();

      assert.noError(result[0]);
      assert.withinPercentage(getExpMantissa(3.72559e18), result[1], 10e-10, 'Calculated liquidity was incorrect');
      assert.withinPercentage(0, result[2], 10e-10, 'should not have any value for shortfall');
    });

    it('returns account shortfall when there IS Borrow interest to accumulate', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      await moneyMarketHarness.methods.harnessSetCollateralRatio(2, 1).send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});
      const ETH = await EIP20.new(100, "eth", 18, "eth").send({from: root});

      // Set up SimpleInterestRateModel for OMG & ETH markets
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});

      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(ETH._address, simpleInterestRateModel._address).send({from: root});

      // Add the collateral market
      await moneyMarketHarness.methods.harnessAddCollateralMarket(OMG._address).send({from: root});
      await moneyMarketHarness.methods.harnessAddCollateralMarket(ETH._address).send({from: root});

      // Set the prices (ETH = 1.0, OMG = 0.01908530)
      await moneyMarketHarness.methods.harnessSetAssetPrice(OMG._address, getExpMantissa(0.01908530), getExpMantissa(1)).send({from: root});
      await moneyMarketHarness.methods.harnessSetAssetPrice(ETH._address, 1, 1).send({from: root});

      // First test is to have supplied 125 OMG @ Supply Rate of 0% and Borrow 3 ETH @ Rate of 25%
      const omgSupplied = 125e18;
      const ethBorrowed = 3e18;
      const customerSupplyInterestIndex = 1;
      const supplyRateBasisPoints = 0;
      const supplyIndex = 1;
      const customerBorrowInterestIndex = 1;
      const borrowRateBasisPoints = 2500;
      const borrowIndex = 2;

      // Setup OMG balances (causes 2 blocks to be mined)
      await moneyMarketHarness.methods.harnessSetAccountSupplyBalance(account, OMG._address, omgSupplied, customerSupplyInterestIndex).send({from: root});
      await moneyMarketHarness.methods.harnessSetAccountBorrowBalance(account, OMG._address, 0, customerBorrowInterestIndex).send({from: root});

      // Setup ETH balances (causes 2 more blocks to be mined)
      await moneyMarketHarness.methods.harnessSetAccountSupplyBalance(account, ETH._address, 0, customerSupplyInterestIndex).send({from: root});
      await moneyMarketHarness.methods.harnessSetAccountBorrowBalance(account, ETH._address, ethBorrowed, customerBorrowInterestIndex).send({from: root});

      // Here is the tricky part. Interest is calculated by using the delta for the current
      // block and the block number stored in the market. So we need to make sure we know
      // how many blocks are mined from now until the calculateLiquidity call. (2 blocks)
      await moneyMarketHarness.methods.harnessSetMarketDetails(ETH._address,
                                                     0,
                                                     0,
                                                     supplyIndex,
                                                     ethBorrowed,
                                                     borrowRateBasisPoints,
                                                     borrowIndex).send({from: root});

      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address,
                                                     omgSupplied,
                                                     supplyRateBasisPoints,
                                                     supplyIndex,
                                                     0,
                                                     0,
                                                     borrowIndex).send({from: root});

      /** We cause the ETH borrow principal to be 1.5x by setting borrowIndex = 2 * customerInterestIndex, and borrowRateBasisPoints = 2500
        * Two blocks of 25% interest causes borrowIndex of 2 to become 3, i.e. 2 * (1 + 0.5) = 2 * (1.5) = 3
        * We calculate new ETH borrow balance by multiplying principal by 3/1.  3e18*3 = 9e18.
        *
        * We keep the OMG supply principal constant by setting supplyIndex = 1 = customerInterestInterestIndex, and supplyRateBasisPoints = 0
        *
        * Finally, with a collateral ratio of 2, we expect the following shortfall results:
        * 125 OMG @ 0.01908530 = 2.3856625 ETH Supplies (actual Eth, not Eth Wei)
        * 2.3856625 - 2(9) ETH) = 15.6143375 ETH shortfall
        */
      const result = await moneyMarketHarness.methods.harnessCalculateAccountLiquidity(account).call();

      assert.noError(result[0]);
      assert.withinPercentage(0, result[1], 10e-10, 'should not have any value for liquidity');
      assert.withinPercentage(getExpMantissa(15.6143375e18), result[2], 10e-10, 'Calculated shortfall was incorrect');
    });
  });

  describe('repayBorrow', async () => {
    it('returns error and logs info if contract is paused', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});
      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Transfer token (e.g. via ICO) to customer
      await OMG.methods.transfer(customer, 100).send({gas: tokenTransferGas, from: root});

      // Customer now approves our Money Market to spend its value
      await OMG.methods.approve(moneyMarketHarness._address, 95).send({from: customer});

      await moneyMarketHarness.methods._setPaused(true).send({from: root});

      const result = await moneyMarketHarness.methods.repayBorrow(OMG._address, 90).send({from: customer});

      assert.hasFailure(result,
        ErrorEnum.CONTRACT_PAUSED,
        FailureInfoEnum.REPAY_BORROW_CONTRACT_PAUSED
      );
    });

    it('returns error if new borrow interest index calculation fails', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Transfer token (e.g. via ICO) to customer
      await OMG.methods.transfer(customer, 100).send({gas: tokenTransferGas, from: root});

      // Customer now approves our Money Market to spend its value
      await OMG.methods.approve(moneyMarketHarness._address, 95).send({from: customer});

      // Store a block number that should be HIGHER than the current block number so we'll get an underflow
      // when calculating block delta.
      await moneyMarketHarness.methods.harnessSetMarketBlockNumber(OMG._address, -1).send({from: root});

      const result = await moneyMarketHarness.methods.repayBorrow(OMG._address, 90).send({from: customer});

      assert.hasFailure(result,
        ErrorEnum.INTEGER_UNDERFLOW,
        FailureInfoEnum.REPAY_BORROW_NEW_BORROW_INDEX_CALCULATION_FAILED
      );
    });

    it('returns error if accumulated balance calculation fails', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Transfer token (e.g. via ICO) to customer
      await OMG.methods.transfer(customer, 100).send({gas: tokenTransferGas, from: root});

      // Customer now approves our Money Market to spend its value
      await OMG.methods.approve(moneyMarketHarness._address, 95).send({from: customer});

      // Set zero as the previous borrow index for the customer. This should cause div by zero error in balance calc.
      // To reach that we also have to set the previous principal to a non-zero value otherwise we will short circuit.
      await moneyMarketHarness.methods.harnessSetAccountBorrowBalance(customer, OMG._address, 1, 0).send({from: root});

      const result = await moneyMarketHarness.methods.repayBorrow(OMG._address, 90).send({from: customer});

      assert.hasFailure(result,
        ErrorEnum.DIVISION_BY_ZERO,
        FailureInfoEnum.REPAY_BORROW_ACCUMULATED_BALANCE_CALCULATION_FAILED
      );
    });

    it('returns error if customer total new balance calculation fails', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(bigNums.maxUint, "test omg", 18, "omg").send({from: root});

      // Transfer token (e.g. via ICO) to customer
      await OMG.methods.transfer(customer, bigNums.maxUint).send({gas: tokenTransferGas, from: root});

      // Customer now approves our Money Market to spend its value
      await OMG.methods.approve(moneyMarketHarness._address, bigNums.maxUint).send({from: customer});

      // We are going to repay 1 borrow, so give an existing balance of maxUint to cause an overflow.
      await moneyMarketHarness.methods.harnessSetAccountBorrowBalance(customer, OMG._address, 0, 1).send({from: root});

      const result = await moneyMarketHarness.methods.repayBorrow(OMG._address, 1).send({from: customer});

      assert.hasFailure(result,
        ErrorEnum.INTEGER_UNDERFLOW,
        FailureInfoEnum.REPAY_BORROW_NEW_TOTAL_BALANCE_CALCULATION_FAILED
      );
    });

    it('returns error if protocol total borrow calculation fails via overflow', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Transfer token (e.g. via ICO) to customer
      await OMG.methods.transfer(customer, 100).send({gas: tokenTransferGas, from: root});

      // Customer now approves our Money Market to spend its value
      await OMG.methods.approve(moneyMarketHarness._address, 95).send({from: customer});

      // Give user some balance
      await moneyMarketHarness.methods.harnessSetAccountBorrowBalance(customer, OMG._address, 10, 1).send({from: root});

      // Give the protocol a token balance of 0 so when we calculate subtract the new borrow from it, it will underflow.
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 0, 0, 1, 0, 0, 1).send({from: root});

      const result = await moneyMarketHarness.methods.repayBorrow(OMG._address, 1).send({from: customer});

      assert.hasFailure(result,
        ErrorEnum.INTEGER_UNDERFLOW,
        FailureInfoEnum.REPAY_BORROW_NEW_TOTAL_BORROW_CALCULATION_FAILED
      );
    });

    it('returns error if protocol total cash calculation fails', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(bigNums.maxUint, "test omg", 18, "omg").send({from: root});

      // Transfer token (e.g. via ICO) to customer
      await OMG.methods.transfer(customer, bigNums.maxUint).send({gas: tokenTransferGas, from: root});

      // Customer now approves our Money Market to spend its value
      await OMG.methods.approve(moneyMarketHarness._address, bigNums.maxUint).send({from: customer});

      // Give user some balance
      await moneyMarketHarness.methods.harnessSetAccountBorrowBalance(customer, OMG._address, 10, 1).send({from: root});

      // Have sufficient borrows outstanding
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 0, 0, 1, 10, 0, 1).send({from: root});

      // We are going to pay borrow of 1, so fake out protocol current cash as maxUint so when we add the new cash it will overflow.
      await moneyMarketHarness.methods.harnessSetCash(OMG._address, bigNums.maxUint).send({from: root});

      const result = await moneyMarketHarness.methods.repayBorrow(OMG._address, 1).send({from: customer});

      assert.hasFailure(result,
        ErrorEnum.INTEGER_OVERFLOW,
        FailureInfoEnum.REPAY_BORROW_NEW_TOTAL_CASH_CALCULATION_FAILED
      );
    });

    it('returns error if new supply rate calculation fails', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Set up FailingInterestModel for OMG market
      const FailableInterestRateModel = getContract("./test/InterestRateModel/FailableInterestRateModel.sol");
      const failableInterestRateModel = await FailableInterestRateModel.new(true, false).send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, failableInterestRateModel._address).send({from: root});

      // Transfer token (e.g. via ICO) to customer
      await OMG.methods.transfer(customer, 100).send({gas: tokenTransferGas, from: root});

      // Customer now approves our Money Market to spend its value
      await OMG.methods.approve(moneyMarketHarness._address, 95).send({from: customer});

      // Give user some balance
      await moneyMarketHarness.methods.harnessSetAccountBorrowBalance(customer, OMG._address, 100, 1).send({from: root});

      // Have sufficient borrows outstanding
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 0, 0, 1, 100, 0, 1).send({from: root});

      const result = await moneyMarketHarness.methods.repayBorrow(OMG._address, 90).send({from: customer});

      assert.hasFailure(result,
        ErrorEnum.OPAQUE_ERROR,
        FailureInfoEnum.REPAY_BORROW_NEW_SUPPLY_RATE_CALCULATION_FAILED,
        10
      );
    });

    it('returns error if new supply interest index calculation fails', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});

      // Transfer token (e.g. via ICO) to customer
      await OMG.methods.transfer(customer, 100).send({gas: tokenTransferGas, from: root});

      // Customer now approves our Money Market to spend its value
      await OMG.methods.approve(moneyMarketHarness._address, 95).send({from: customer});

      // Give user some balance
      await moneyMarketHarness.methods.harnessSetAccountBorrowBalance(customer, OMG._address, 100, 2).send({from: root});

      // Set current borrow interest index to maxUint so when we multiply by it we get an overflow
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 0, 0, bigNums.maxUint, 1000, 0, 2).send({from: root});

      const result = await moneyMarketHarness.methods.repayBorrow(OMG._address, 90).send({from: customer});

      assert.hasFailure(result,
        ErrorEnum.INTEGER_OVERFLOW,
        FailureInfoEnum.REPAY_BORROW_NEW_SUPPLY_INDEX_CALCULATION_FAILED
      );
    });

    it('returns error if new borrow rate calculation fails', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Set up FailingInterestModel for OMG market
      const FailableInterestRateModel = getContract("./test/InterestRateModel/FailableInterestRateModel.sol");
      const failableInterestRateModel = await FailableInterestRateModel.new(false, true).send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, failableInterestRateModel._address).send({from: root});

      // Transfer token (e.g. via ICO) to customer
      await OMG.methods.transfer(customer, 100).send({gas: tokenTransferGas, from: root});

      // Customer now approves our Money Market to spend its value
      await OMG.methods.approve(moneyMarketHarness._address, 95).send({from: customer});

      // Give user some balance
      await moneyMarketHarness.methods.harnessSetAccountBorrowBalance(customer, OMG._address, 100, 1).send({from: root});

      // Have sufficient borrows outstanding
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 0, 0, 1, 100, 0, 1).send({from: root});

      const result = await moneyMarketHarness.methods.repayBorrow(OMG._address, 90).send({from: customer});

      assert.hasFailure(result,
        ErrorEnum.OPAQUE_ERROR,
        FailureInfoEnum.REPAY_BORROW_NEW_BORROW_RATE_CALCULATION_FAILED,
        20
      );
    });

    it('returns error if token transfer fails', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});

      // Transfer token (e.g. via ICO) to customer
      await OMG.methods.transfer(customer, 100).send({gas: tokenTransferGas, from: root});

      // Customer now approves our Money Market to spend its value
      await OMG.methods.approve(moneyMarketHarness._address, 95).send({from: customer});

      // Give user some balance
      await moneyMarketHarness.methods.harnessSetAccountBorrowBalance(customer, OMG._address, 100, 1).send({from: root});

      // Have sufficient borrows outstanding
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 0, 0, 1, 100, 0, 1).send({from: root});

      await OMG.methods.harnessSetFailTransferFromAddress(customer, true).send({from: root});

      const result = await moneyMarketHarness.methods.repayBorrow(OMG._address, 90).send({from: customer});

      assert.hasFailure(result,
        ErrorEnum.TOKEN_TRANSFER_FAILED,
        FailureInfoEnum.REPAY_BORROW_TRANSFER_IN_FAILED
      );
    });

    it('reverts if non-standrd token transfer fails', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20NonStandardThrow.new(100, "test omg ns", 18, "omg").send({from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});

      // Transfer token (e.g. via ICO) to customer
      await OMG.methods.transfer(customer, 100).send({gas: tokenTransferGas, from: root});

      // Customer now approves our Money Market to spend its value
      await OMG.methods.approve(moneyMarketHarness._address, 95).send({from: customer});

      // Give user some balance
      await moneyMarketHarness.methods.harnessSetAccountBorrowBalance(customer, OMG._address, 100, 1).send({from: root});

      // Have sufficient borrows outstanding
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 0, 0, 1, 100, 0, 1).send({from: root});

      await OMG.methods.harnessSetFailTransferFromAddress(customer, true).send({from: root});

      await assert.revert(moneyMarketHarness.methods.repayBorrow(OMG._address, 90).send({from: customer}));
    });

    it('emits borrow repaid event on success', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});

      // Transfer token (e.g. via ICO) to customer
      await OMG.methods.transfer(customer, 100).send({gas: tokenTransferGas, from: root});

      // Customer now approves our Money Market to spend its value
      await OMG.methods.approve(moneyMarketHarness._address, 95).send({from: customer});

      // Give user some balance
      await moneyMarketHarness.methods.harnessSetAccountBorrowBalance(customer, OMG._address, 100, 1).send({from: root});

      // Have sufficient borrows outstanding
      const initialInterestIndex = 1;
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 0, 0, initialInterestIndex, 100, 0, initialInterestIndex).send({from: root});
      const result = await moneyMarketHarness.methods.repayBorrow(OMG._address, 90).send({from: customer});

      assert.hasLog(result,
        "BorrowRepaid",
        {
          account: checksum(customer),
          asset: OMG._address,
          amount: '90',
          startingBalance: '100',
          newBalance: '10',
        }
      );

      const customerTokenBalance = await OMG.methods.balanceOf(customer).call();
      assert.equal(10, customerTokenBalance);

      const customerCompoundBalance = await moneyMarketHarness.methods.borrowBalances(customer, OMG._address).call();
      assert.equal(10, customerCompoundBalance.principal);
      assert.equal(initialInterestIndex, customerCompoundBalance.interestIndex);
    });

    it('allows repay with zero oracle price', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});

      // Transfer token (e.g. via ICO) to customer
      await OMG.methods.transfer(customer, 100).send({gas: tokenTransferGas, from: root});

      // Customer now approves our Money Market to spend its value
      await OMG.methods.approve(moneyMarketHarness._address, 95).send({from: customer});

      // Give user some balance
      await moneyMarketHarness.methods.harnessSetAccountBorrowBalance(customer, OMG._address, 100, 1).send({from: root});

      // Set oracle price to zero
      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(OMG._address, 0).send({from: root});

      // Have sufficient borrows outstanding
      const initialInterestIndex = 1;
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 0, 0, initialInterestIndex, 100, 0, initialInterestIndex).send({from: root});
      const result = await moneyMarketHarness.methods.repayBorrow(OMG._address, 90).send({from: customer});

      assert.hasLog(result,
        "BorrowRepaid",
        {
          account: checksum(customer),
          asset: OMG._address,
          amount: '90',
          startingBalance: '100',
          newBalance: '10',
        }
      );

      const customerTokenBalance = await OMG.methods.balanceOf(customer).call();
      assert.equal(10, customerTokenBalance);

      const customerCompoundBalance = await moneyMarketHarness.methods.borrowBalances(customer, OMG._address).call();
      assert.equal(10, customerCompoundBalance.principal);
      assert.equal(initialInterestIndex, customerCompoundBalance.interestIndex);
    });

    it('emits borrow repaid event on non-standard success', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20NonStandardThrow.new(100, "test omg ns", 18, "omg").send({from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});

      // Transfer token (e.g. via ICO) to customer
      await OMG.methods.transfer(customer, 100).send({gas: tokenTransferGas, from: root});

      // Customer now approves our Money Market to spend its value
      await OMG.methods.approve(moneyMarketHarness._address, 95).send({from: customer});

      // Give user some balance
      await moneyMarketHarness.methods.harnessSetAccountBorrowBalance(customer, OMG._address, 100, 1).send({from: root});

      // Have sufficient borrows outstanding
      const initialInterestIndex = 1;
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 0, 0, initialInterestIndex, 100, 0, initialInterestIndex).send({from: root});
      const result = await moneyMarketHarness.methods.repayBorrow(OMG._address, 90).send({from: customer});

      assert.hasLog(result,
        "BorrowRepaid",
        {
          account: checksum(customer),
          asset: OMG._address,
          amount: '90',
          startingBalance: '100',
          newBalance: '10',
        }
      );

      const customerTokenBalance = await OMG.methods.balanceOf(customer).call();
      assert.equal(10, customerTokenBalance);

      const customerCompoundBalance = await moneyMarketHarness.methods.borrowBalances(customer, OMG._address).call();
      assert.equal(10, customerCompoundBalance.principal);
      assert.equal(initialInterestIndex, customerCompoundBalance.interestIndex);
    });

    it('loves @gas', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});

      // Transfer token (e.g. via ICO) to customer
      await OMG.methods.transfer(customer, 100).send({gas: tokenTransferGas, from: root});

      // Customer now approves our Money Market to spend its value
      await OMG.methods.approve(moneyMarketHarness._address, 95).send({from: customer});

      // Give user some balance
      await moneyMarketHarness.methods.harnessSetAccountBorrowBalance(customer, OMG._address, 100, 1).send({from: root});

      // Have sufficient borrows outstanding
      const initialInterestIndex = 1;
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 0, 0, initialInterestIndex, 100, 0, initialInterestIndex).send({from: root});

      // Warm the pot
      await moneyMarketHarness.methods.repayBorrow(OMG._address, 1).send({from: customer});

      const result = await moneyMarketHarness.methods.repayBorrow(OMG._address, 90).send({from: customer});

      assert.hasLog(result,
        "BorrowRepaid",
        {
          account: checksum(customer),
          asset: OMG._address,
          amount: '90'
        }
      );

      assert.withinGas(result, 108e3, 5000, "should be about 108K gas", true);
    });

    it('handles special pay max value when customer token balance exceeds borrow balance', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});

      // Transfer token (e.g. via ICO) to customer
      await OMG.methods.transfer(customer, 100).send({gas: tokenTransferGas, from: root});

      // Customer now approves our Money Market to spend its value
      await OMG.methods.approve(moneyMarketHarness._address, 95).send({from: customer});

      // Give user some balance
      await moneyMarketHarness.methods.harnessSetAccountBorrowBalance(customer, OMG._address, 80, 1).send({from: root});

      // Have sufficient borrows outstanding
      const initialInterestIndex = 1;
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 0, 0, initialInterestIndex, 100, 0, initialInterestIndex).send({from: root});
      const result = await moneyMarketHarness.methods.repayBorrow(OMG._address, -1).send({from: customer});

      assert.hasLog(result,
        "BorrowRepaid",
        {
          account: checksum(customer),
          asset: OMG._address,
          amount: '80',
          startingBalance: '80',
          newBalance: '0',
        }
      );

      const customerTokenBalance = await OMG.methods.balanceOf(customer).call();
      assert.equal(20, customerTokenBalance);

      const customerCompoundBalance = await moneyMarketHarness.methods.borrowBalances(customer, OMG._address).call();
      assert.equal(0, customerCompoundBalance.principal);
      assert.equal(initialInterestIndex, customerCompoundBalance.interestIndex);
    });

    it('handles special pay max value when borrow balance exceeds customer token balance', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});

      // Transfer token (e.g. via ICO) to customer
      await OMG.methods.transfer(customer, 100).send({gas: tokenTransferGas, from: root});

      // Customer now approves our Money Market to spend its value
      await OMG.methods.approve(moneyMarketHarness._address, 100).send({from: customer});

      // Give user some balance
      await moneyMarketHarness.methods.harnessSetAccountBorrowBalance(customer, OMG._address, 120, 1).send({from: root});

      // Have sufficient borrows outstanding
      const initialInterestIndex = 1;
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 0, 0, initialInterestIndex, 100, 0, initialInterestIndex).send({from: root});
      const result = await moneyMarketHarness.methods.repayBorrow(OMG._address, -1).send({from: customer});

      assert.hasLog(result,
        "BorrowRepaid",
        {
          account: checksum(customer),
          asset: OMG._address,
          amount: '100',
          startingBalance: '120',
          newBalance: '20',
        }
      );

      const customerTokenBalance = await OMG.methods.balanceOf(customer).call();
      assert.equal(0, customerTokenBalance);

      const customerCompoundBalance = await moneyMarketHarness.methods.borrowBalances(customer, OMG._address).call();
      assert.equal(20, customerCompoundBalance.principal);
      assert.equal(initialInterestIndex, customerCompoundBalance.interestIndex);
    });
  });

  const liquidationSetup = {
    totalTokenAmount: 200,
    initialTokenBalanceLiquidator: 100, // liquidator holds this much outside of protocol
    initialTokenBalanceOtherSupplier: 100, // otherSupplier supplies this much, so we have cash for the target user's borrow
    initialCollateralAmount: 10, // target user supplies this as collateral when its price is high
    initialBorrowAmount: 10 // target user borrows this much when the collateral price is high
  };

  async function setupValidLiquidation(nonStandard=false) {
    // borrower supplies OMG and borrows DRGN
    // liquidator repays borrowed loan and seizes collateral collateral
    const borrower = accounts[1];
    const liquidator = accounts[2];
    const otherSupplier = accounts[3];
    const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

    let collateral;
    let borrowed;

    if (nonStandard) {
      collateral = await EIP20NonStandardThrow.new(liquidationSetup.totalTokenAmount, "test omg ns", 18, "omg").send({from: root});
      borrowed = await EIP20NonStandardThrow.new(liquidationSetup.totalTokenAmount, "test drgn ns", 18, "drgn").send({from: root});
    } else {
      collateral = await EIP20.new(liquidationSetup.totalTokenAmount, "test omg", 18, "omg").send({from: root});
      borrowed = await EIP20.new(liquidationSetup.totalTokenAmount, "test drgn", 18, "drgn").send({from: root});
    }


    // Support markets
    // Set price of collateral to 10:1 to start with so borrower can create borrow. We'll move it down later to put them underwater.
    await moneyMarketHarness.methods.harnessSetAssetPrice(collateral._address, 10, 1).send({from: root});
    // Set price of borrowed to 1:1
    await moneyMarketHarness.methods.harnessSetAssetPrice(borrowed._address, 1, 1).send({from: root});
    await moneyMarketHarness.methods.harnessSupportMarket(collateral._address).send({from: root});
    await moneyMarketHarness.methods.harnessSupportMarket(borrowed._address).send({from: root});

    // Add collateral market for omg & drgn
    await moneyMarketHarness.methods.harnessAddCollateralMarket(collateral._address).send({from: root});
    await moneyMarketHarness.methods.harnessAddCollateralMarket(borrowed._address).send({from: root});

    // Set up SimpleInterestRateModel for collateral and borrowed market. borrow rate is 50% per block
    const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});

    await moneyMarketHarness.methods._supportMarket(collateral._address, simpleInterestRateModel._address).send({from: root});
    await moneyMarketHarness.methods._supportMarket(borrowed._address, simpleInterestRateModel._address).send({from: root});

    // Set a required collateral ratio of 2:1
    await moneyMarketHarness.methods.harnessSetCollateralRatio(2, 1).send({from: root});

    // Give liquidator an approved balance of the borrowed token, borrowed, so he can repay part of the underwater loan
    await borrowed.methods.transfer(liquidator, liquidationSetup.initialTokenBalanceLiquidator).send({gas: tokenTransferGas, from: root});
    await borrowed.methods.approve(moneyMarketHarness._address, liquidationSetup.initialTokenBalanceLiquidator).send({from: liquidator});

    // Give the other supplier some borrow asset and supply it to compound.
    // This is what will fund the borrow.
    await borrowed.methods.transfer(otherSupplier, liquidationSetup.initialTokenBalanceOtherSupplier).send({from: root});
    await borrowed.methods.approve(moneyMarketHarness._address, liquidationSetup.initialTokenBalanceOtherSupplier).send({from: otherSupplier});
    const deliverBorrowAssetResult = await moneyMarketHarness.methods.supply(borrowed._address, liquidationSetup.initialTokenBalanceOtherSupplier).send({from: otherSupplier});

    // Give borrower some collateral and supply it to compound
    await collateral.methods.transfer(borrower, liquidationSetup.initialCollateralAmount).send({from: root});
    await collateral.methods.approve(moneyMarketHarness._address, liquidationSetup.initialCollateralAmount).send({from: borrower});
    const collateralSupplyResult = await moneyMarketHarness.methods.supply(collateral._address, liquidationSetup.initialCollateralAmount).send({from: borrower});

    // Track and return this so callers can accurately calculate accrued interest on the collateral supply if they so desire.
    const supplyCollateralBlock = collateralSupplyResult.blockNumber;

    const borrowerCollateralBalance = await moneyMarketHarness.methods.supplyBalances(borrower, collateral._address).call();
    assert.equal(liquidationSetup.initialCollateralAmount, borrowerCollateralBalance.principal);
    // 10**18 is MoneyMarket.initialInterestIndex
    assert.equal(10**18, borrowerCollateralBalance.interestIndex);

    // Create the borrow
    const borrowResult = await moneyMarketHarness.methods.borrow(borrowed._address, liquidationSetup.initialBorrowAmount).send({from: borrower});
    // Track and return this so callers can accurately calculate accrued interest on the borrow if they so desire.
    const borrowBlock = borrowResult.blockNumber;
    // Verify that 4 blocks passed between supply of borrowed asset to when it was actually borrowed.
    // We need this for the interestIndex
    assert.equal(borrowBlock - deliverBorrowAssetResult.blockNumber, 4);

    const borrowBalance = await moneyMarketHarness.methods.borrowBalances(borrower, borrowed._address).call();
    assert.equal(liquidationSetup.initialBorrowAmount, borrowBalance.principal);
    const expectedInterestIndex = 3*10**18; // ((4 blocks * 50%) + 1) * 10**18 (initial interest index)
    assert.equal(borrowBalance.interestIndex, expectedInterestIndex);

    // Set price of collateral to 1:1 (down from 10:1) so borrower has a shortfall
    await moneyMarketHarness.methods.harnessSetAssetPrice(collateral._address, 1, 1).send({from: root});

    return {
      borrower: borrower,
      liquidator: liquidator,
      moneyMarketHarness: moneyMarketHarness,
      collateral: collateral,
      borrowed: borrowed,
      supplyCollateralBlock: supplyCollateralBlock,
      borrowBlock: borrowBlock
    }
  }

  // This uses harness methods for setup to make it easier to trigger certain error conditions.
  async function setupLiquidationWithHarnessForFailureTest() {
    // borrower supplies OMG and borrows DRGN
    // liquidator repays borrowed loan and seizes collateral collateral
    const borrower = accounts[1];
    const liquidator = accounts[2];
    const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});
    const collateral = await EIP20.new(liquidationSetup.totalTokenAmount, "test omg", 18, "omg").send({from: root});
    const borrowed = await EIP20.new(liquidationSetup.totalTokenAmount, "test drgn", 18, "drgn").send({from: root});

    // Support markets
    await moneyMarketHarness.methods.harnessSupportMarket(collateral._address).send({from: root});
    await moneyMarketHarness.methods.harnessSupportMarket(borrowed._address).send({from: root});

    // Add collateral market for omg & drgn
    await moneyMarketHarness.methods.harnessAddCollateralMarket(collateral._address).send({from: root});
    await moneyMarketHarness.methods.harnessAddCollateralMarket(borrowed._address).send({from: root});

    // Set price of collateral to 1:1
    await moneyMarketHarness.methods.harnessSetAssetPrice(collateral._address, 1, 1).send({from: root});

    // Set price of borrowed to 1:1
    await moneyMarketHarness.methods.harnessSetAssetPrice(borrowed._address, 1, 1).send({from: root});

    // Set a required collateral ratio of 2:1
    await moneyMarketHarness.methods.harnessSetCollateralRatio(2, 1).send({from: root});

    // Set up SimpleInterestRateModel for collateral and borrowed market
    const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});
    await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(collateral._address, simpleInterestRateModel._address).send({from: root});
    await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(borrowed._address, simpleInterestRateModel._address).send({from: root});

    // Create collateral and borrow balances so that the borrower is underwater.
    // collateral ratio 2:1, prices identical, balances identical, so all of the borrow should be liquidatable
    // collateral omg
    await moneyMarketHarness.methods.harnessSetAccountSupplyBalance(borrower, collateral._address, liquidationSetup.initialCollateralAmount, 1).send({from: root});
    // Borrow drgn
    await moneyMarketHarness.methods.harnessSetAccountBorrowBalance(borrower, borrowed._address, liquidationSetup.initialBorrowAmount, 1).send({from: root});

    // Set market details
    await moneyMarketHarness.methods.harnessSetMarketDetails(borrowed._address, 0, 0, 1, 10, 0, 1).send({from: root});
    await moneyMarketHarness.methods.harnessSetMarketDetails(collateral._address, 100, 0, 1, 0, 0, 1).send({from: root});

    // Give liquidator an approved balance of the borrowed token, borrowed, so he can repay part of the underwater loan
    await borrowed.methods.transfer(liquidator, liquidationSetup.initialTokenBalanceLiquidator).send({gas: tokenTransferGas, from: root});
    await borrowed.methods.approve(moneyMarketHarness._address, liquidationSetup.initialTokenBalanceLiquidator).send({from: liquidator});

    return {
      borrower: borrower,
      liquidator: liquidator,
      moneyMarketHarness: moneyMarketHarness,
      collateral: collateral,
      borrowed: borrowed
    }
  }

  // Validates info from `setupValidLiquidation` given that the liquidation did NOT occur.
  async function validateFailedLiquidation(result, moneyMarketHarness, borrower, borrowed, collateral, liquidator, error, failureInfo) {
    assert.hasFailure(result,
      error,
      failureInfo
    );

    // Started with 100, should still have 100
    const liquidatorTokenBalance = await borrowed.methods.balanceOf(liquidator).call();
    assert.equal(liquidationSetup.initialTokenBalanceLiquidator, liquidatorTokenBalance);

    // No collateral was seized
    const liquidatorCollateralBalance = await moneyMarketHarness.methods.supplyBalances(liquidator, collateral._address).call();
    assert.equal(0, liquidatorCollateralBalance.principal);

    const borrowerBorrowBalance = await moneyMarketHarness.methods.borrowBalances(borrower, borrowed._address).call();

    assert.equal(liquidationSetup.initialBorrowAmount, borrowerBorrowBalance.principal);

    const borrowerCollateralBalance = await moneyMarketHarness.methods.supplyBalances(borrower, collateral._address).call();
    assert.equal(liquidationSetup.initialCollateralAmount, borrowerCollateralBalance.principal);
  }

  async function validateMarket(moneyMarketHarness, asset, prefix, expected) {

    const market = await moneyMarketHarness.methods.markets(asset).call();
    assert.equal(market.blockNumber, expected.blockNumber, `${prefix}: blockNumber`);
    assert.equal(market.totalSupply, expected.totalSupply, `${prefix}: totalSupply`);
    assert.equal(market.supplyRateMantissa, expected.supplyRateMantissa, `${prefix}: supplyRateMantissa`);
    assert.equal(market.supplyIndex, expected.supplyIndex, `${prefix}: supplyIndex`);
    assert.equal(market.totalBorrows, expected.totalBorrows, `${prefix}: totalBorrows`);
    assert.equal(market.borrowRateMantissa, expected.borrowRateMantissa, `${prefix}: borrowRateMantissa`);
    assert.equal(market.borrowIndex, expected.borrowIndex, `${prefix}: borrowIndex`);
  }

  const simpleSupplyRateMantissa = 10**17; // SimpleInterestRateModel has fixed supply rate mantissa
  const simpleBorrowRateMantissa =  5 * 10**17; // SimpleInterestRateModel has fixed borrow rate mantissa

  describe('liquidateBorrow', async () => {
    it('returns error and logs info if contract is paused', async () => {
      const {moneyMarketHarness, borrower, liquidator, borrowed, collateral, supplyCollateralBlock, borrowBlock} = await setupValidLiquidation();

      await moneyMarketHarness.methods._setPaused(true).send({from: root});

      const liquidateResult = await moneyMarketHarness.methods.liquidateBorrow(borrower, borrowed._address, collateral._address, 6).send({from: liquidator});

      assert.hasFailure(liquidateResult,
        ErrorEnum.CONTRACT_PAUSED,
        FailureInfoEnum.LIQUIDATE_CONTRACT_PAUSED
      );
    });

    it('handles a valid liquidation', async () => {
      const {moneyMarketHarness, borrower, liquidator, borrowed, collateral, supplyCollateralBlock, borrowBlock} = await setupValidLiquidation();

      /////////// Call function.  All could be liquidated, but let's only liquidate some of it.
      const liquidateResult = await moneyMarketHarness.methods.liquidateBorrow(borrower, borrowed._address, collateral._address, 6).send({from: liquidator});

      /////////// Validate
      // First let's make sure the environment is setup as we expected; otherwise we might get a successful test for the wrong reason.
      // We expect 3 blocks of supply interest at 10% per block, so make sure 3 blocks have passed since the supply of collateral was received.
      // 3 blocks comes from 2 blocks in setupValidLiquidation() and then 1 block here to do the liquidation.
      assert.equal(supplyCollateralBlock+3, liquidateResult.blockNumber);

      // We expect 2 blocks of borrow interest at 50% per block so make sure 2 blocks have passed since the borrow was created.
      // 2 blocks comes from 1 block in setupValidLiquidation() and then 1 block here to do the liquidation.
      assert.equal(borrowBlock+2, liquidateResult.blockNumber);

      const expectedAccumulatedBorrowBalance_TargetUserBorrowed = 20; // 10 + ( 2 blocks * 50%/block * 10) = 10 + 10 = 20
      const expectedAmountRepaid = 6;
      const expectedBorrowBalanceAfter_TargetUserBorrowed = expectedAccumulatedBorrowBalance_TargetUserBorrowed - expectedAmountRepaid;

      const expectedAccumulatedSupplyBalance_TargetUserCollateral = 13; // 10 + (3 blocks * 10%/block * 10) = 10 + 3 = 13
      const expectedSupplyIndex_Collateral = 1.3 * 10**18; // ((3 blocks * 10%) + 1) * 10**18 (initial interest index)
      const expectedAmountSeized = 6;
      const expectedSupplyBalanceAfter_TargetUserCollateral = expectedAccumulatedSupplyBalance_TargetUserCollateral - expectedAmountSeized;

      assert.hasLog(liquidateResult,
        "BorrowLiquidated",
        {
          targetAccount: checksum(borrower),
          assetBorrow: borrowed._address,
          borrowBalanceBefore: liquidationSetup.initialBorrowAmount.toString(),
          borrowBalanceAccumulated: expectedAccumulatedBorrowBalance_TargetUserBorrowed.toString(),
          amountRepaid: expectedAmountRepaid.toString(),
          borrowBalanceAfter: expectedBorrowBalanceAfter_TargetUserBorrowed.toString(),
          liquidator: checksum(liquidator),
          assetCollateral: collateral._address,
          collateralBalanceBefore: liquidationSetup.initialCollateralAmount.toString(),
          collateralBalanceAccumulated: expectedAccumulatedSupplyBalance_TargetUserCollateral.toString(),
          amountSeized: expectedAmountSeized.toString(),
          collateralBalanceAfter: expectedSupplyBalanceAfter_TargetUserCollateral.toString()
        }
      );

      // Liquidator's off-protocol token balance should have declined by the amount used to reduce the target user's borrow
      const liquidatorTokenBalance = await borrowed.methods.balanceOf(liquidator).call();
      assert.equal(liquidatorTokenBalance, liquidationSetup.initialTokenBalanceLiquidator - expectedAmountRepaid);

      // Seized collateral goes to the liquidator's protocol account
      const liquidatorCollateralBalance = await moneyMarketHarness.methods.supplyBalances(liquidator, collateral._address).call();
      assert.equal(liquidatorCollateralBalance.principal, expectedAmountSeized);
      assert.equal(liquidatorCollateralBalance.interestIndex, expectedSupplyIndex_Collateral);

      const borrowerBorrowBalance = await moneyMarketHarness.methods.borrowBalances(borrower, borrowed._address).call();
      assert.equal(borrowerBorrowBalance.principal, expectedBorrowBalanceAfter_TargetUserBorrowed);
      const expectedBorrowIndexBorrowedAsset = 6 * 10**18; //  ((2 blocks * 50%) + 1) * (3 * 10**18) (previous interest index)
      assert.equal(borrowerBorrowBalance.interestIndex, expectedBorrowIndexBorrowedAsset);

      const borrowerCollateralBalance = await moneyMarketHarness.methods.supplyBalances(borrower, collateral._address).call();
      assert.equal(borrowerCollateralBalance.principal, expectedSupplyBalanceAfter_TargetUserCollateral);
      assert.equal(borrowerCollateralBalance.interestIndex, expectedSupplyIndex_Collateral);

      await validateMarket(moneyMarketHarness, borrowed._address, "handles a valid liquidation: borrowed", {
        blockNumber: liquidateResult.blockNumber,
        totalSupply: liquidationSetup.initialTokenBalanceOtherSupplier,
        supplyRateMantissa: simpleSupplyRateMantissa,
        supplyIndex: 1.4*1.2 * 10**18, // initial 10e18, multiplied by (1 + 4 * 0.1) at borrow and then (1 + 2 * 0.1) at liquidate
        totalBorrows: expectedBorrowBalanceAfter_TargetUserBorrowed,
        borrowRateMantissa: simpleBorrowRateMantissa,
        borrowIndex: expectedBorrowIndexBorrowedAsset
      });

      await validateMarket(moneyMarketHarness, collateral._address, "handles a valid liquidation: collateral", {
        blockNumber: liquidateResult.blockNumber,
        totalSupply: expectedAccumulatedSupplyBalance_TargetUserCollateral, // though now it is split across target user and liquidator
        supplyRateMantissa: simpleSupplyRateMantissa,
        supplyIndex: expectedSupplyIndex_Collateral,
        totalBorrows: 0,
        borrowRateMantissa: simpleBorrowRateMantissa,
        borrowIndex: 2.5 * 10**18 // initial 10e18 when supplied, multiplied by (1 + 3*0.5) at liquidate
      });
    });

    it('handles a valid non-standard liquidation', async () => {
      const {moneyMarketHarness, borrower, liquidator, borrowed, collateral, supplyCollateralBlock, borrowBlock} = await setupValidLiquidation(true);

      /////////// Call function.  All could be liquidated, but let's only liquidate some of it.
      const liquidateResult = await moneyMarketHarness.methods.liquidateBorrow(borrower, borrowed._address, collateral._address, 6).send({from: liquidator});

      /////////// Validate
      // First let's make sure the environment is setup as we expected; otherwise we might get a successful test for the wrong reason.
      // We expect 3 blocks of supply interest at 10% per block, so make sure 3 blocks have passed since the supply of collateral was received.
      // 3 blocks comes from 2 blocks in setupValidLiquidation() and then 1 block here to do the liquidation.
      assert.equal(supplyCollateralBlock+3, liquidateResult.blockNumber);

      // We expect 2 blocks of borrow interest at 50% per block so make sure 2 blocks have passed since the borrow was created.
      // 2 blocks comes from 1 block in setupValidLiquidation() and then 1 block here to do the liquidation.
      assert.equal(borrowBlock+2, liquidateResult.blockNumber);

      const expectedAccumulatedBorrowBalance_TargetUserBorrowed = 20; // 10 + ( 2 blocks * 50%/block * 10) = 10 + 10 = 20
      const expectedAmountRepaid = 6;
      const expectedBorrowBalanceAfter_TargetUserBorrowed = expectedAccumulatedBorrowBalance_TargetUserBorrowed - expectedAmountRepaid;

      const expectedAccumulatedSupplyBalance_TargetUserCollateral = 13; // 10 + (3 blocks * 10%/block * 10) = 10 + 3 = 13
      const expectedSupplyIndex_Collateral = 1.3 * 10**18; // ((3 blocks * 10%) + 1) * 10**18 (initial interest index)
      const expectedAmountSeized = 6;
      const expectedSupplyBalanceAfter_TargetUserCollateral = expectedAccumulatedSupplyBalance_TargetUserCollateral - expectedAmountSeized;

      assert.hasLog(liquidateResult,
        "BorrowLiquidated",
        {
          targetAccount: checksum(borrower),
          assetBorrow: borrowed._address,
          borrowBalanceBefore: liquidationSetup.initialBorrowAmount.toString(),
          borrowBalanceAccumulated: expectedAccumulatedBorrowBalance_TargetUserBorrowed.toString(),
          amountRepaid: expectedAmountRepaid.toString(),
          borrowBalanceAfter: expectedBorrowBalanceAfter_TargetUserBorrowed.toString(),
          liquidator: checksum(liquidator),
          assetCollateral: collateral._address,
          collateralBalanceBefore: liquidationSetup.initialCollateralAmount.toString(),
          collateralBalanceAccumulated: expectedAccumulatedSupplyBalance_TargetUserCollateral.toString(),
          amountSeized: expectedAmountSeized.toString(),
          collateralBalanceAfter: expectedSupplyBalanceAfter_TargetUserCollateral.toString()
        }
      );

      // Liquidator's off-protocol token balance should have declined by the amount used to reduce the target user's borrow
      const liquidatorTokenBalance = await borrowed.methods.balanceOf(liquidator).call();
      assert.equal(liquidatorTokenBalance, liquidationSetup.initialTokenBalanceLiquidator - expectedAmountRepaid);

      // Seized collateral goes to the liquidator's protocol account
      const liquidatorCollateralBalance = await moneyMarketHarness.methods.supplyBalances(liquidator, collateral._address).call();
      assert.equal(liquidatorCollateralBalance.principal, expectedAmountSeized);
      assert.equal(liquidatorCollateralBalance.interestIndex, expectedSupplyIndex_Collateral);

      const borrowerBorrowBalance = await moneyMarketHarness.methods.borrowBalances(borrower, borrowed._address).call();
      assert.equal(borrowerBorrowBalance.principal, expectedBorrowBalanceAfter_TargetUserBorrowed);
      const expectedBorrowIndexBorrowedAsset = 6 * 10**18; //  ((2 blocks * 50%) + 1) * (3 * 10**18) (previous interest index)
      assert.equal(borrowerBorrowBalance.interestIndex, expectedBorrowIndexBorrowedAsset);

      const borrowerCollateralBalance = await moneyMarketHarness.methods.supplyBalances(borrower, collateral._address).call();
      assert.equal(borrowerCollateralBalance.principal, expectedSupplyBalanceAfter_TargetUserCollateral);
      assert.equal(borrowerCollateralBalance.interestIndex, expectedSupplyIndex_Collateral);

      await validateMarket(moneyMarketHarness, borrowed._address, "handles a valid liquidation: borrowed", {
        blockNumber: liquidateResult.blockNumber,
        totalSupply: liquidationSetup.initialTokenBalanceOtherSupplier,
        supplyRateMantissa: simpleSupplyRateMantissa,
        supplyIndex: 1.4*1.2 * 10**18, // initial 10e18, multiplied by (1 + 4 * 0.1) at borrow and then (1 + 2 * 0.1) at liquidate
        totalBorrows: expectedBorrowBalanceAfter_TargetUserBorrowed,
        borrowRateMantissa: simpleBorrowRateMantissa,
        borrowIndex: expectedBorrowIndexBorrowedAsset
      });

      await validateMarket(moneyMarketHarness, collateral._address, "handles a valid liquidation: collateral", {
        blockNumber: liquidateResult.blockNumber,
        totalSupply: expectedAccumulatedSupplyBalance_TargetUserCollateral, // though now it is split across target user and liquidator
        supplyRateMantissa: simpleSupplyRateMantissa,
        supplyIndex: expectedSupplyIndex_Collateral,
        totalBorrows: 0,
        borrowRateMantissa: simpleBorrowRateMantissa,
        borrowIndex: 2.5 * 10**18 // initial 10e18 when supplied, multiplied by (1 + 3*0.5) at liquidate
      });
    });

    it('handles max for a supported market', async () => {
      const {moneyMarketHarness, borrower, liquidator, borrowed, collateral, supplyCollateralBlock, borrowBlock} = await setupValidLiquidation();

      /////////// Call function.  liquidate max by specifying -1
      const liquidateResult = await moneyMarketHarness.methods.liquidateBorrow(borrower, borrowed._address, collateral._address, -1).send({from: liquidator});

      /////////// Validate
      // First let's make sure the environment is setup as we expected; otherwise we might get a successful test for the wrong reason.
      // We expect 3 blocks of supply interest at 10% per block, so make sure 3 blocks have passed since the supply of collateral was received.
      // 3 blocks comes from 2 blocks in setupValidLiquidation() and then 1 block here to do the liquidation.
      assert.equal(supplyCollateralBlock+3, liquidateResult.blockNumber);

      // We expect 2 blocks of borrow interest at 50% per block so make sure 2 blocks have passed since the borrow was created.
      // 2 blocks comes from 1 block in setupValidLiquidation() and then 1 block here to do the liquidation.
      assert.equal(borrowBlock+2, liquidateResult.blockNumber);

      const expectedAccumulatedBorrowBalance_TargetUserBorrowed = 20; // 10 + ( 2 blocks * 50%/block * 10) = 10 + 10 = 20;
      const expectedAmountRepaid = 13; // We could close the entire accrued borrow of 20 but there's only 13 of the collateral.
      const expectedBorrowBalanceAfter_TargetUserBorrowed = expectedAccumulatedBorrowBalance_TargetUserBorrowed - expectedAmountRepaid;

      const expectedAccumulatedSupplyBalance_TargetUserCollateral = 13; // 10 + (3 blocks * 10%/block * 10 = 10 + 3 = 13;
      const expectedSupplyIndex_Collateral = 1.3 * 10**18; // ((3 blocks * 10%) + 1) * 10**18 (initial interest index)
      const expectedShortfall = 27; // (2 * 20) - 13 = 40 - 13 = 27;
      // Recall that we have borrow asset and collateral asset at the same price.
      const expectedAmountSeized = expectedAmountRepaid; // See comment re expectedAmountRepaid
      const expectedSupplyBalanceAfter_TargetUserCollateral = expectedAccumulatedSupplyBalance_TargetUserCollateral - expectedAmountSeized; // See comment re expectedAmountRepaid

      assert.hasLog(liquidateResult,
        "BorrowLiquidated",
        {
          targetAccount: checksum(borrower),
          assetBorrow: borrowed._address,
          borrowBalanceBefore: liquidationSetup.initialBorrowAmount.toString(),
          borrowBalanceAccumulated: expectedAccumulatedBorrowBalance_TargetUserBorrowed.toString(),
          amountRepaid: expectedAmountRepaid.toString(),
          borrowBalanceAfter: expectedBorrowBalanceAfter_TargetUserBorrowed.toString(),
          liquidator: checksum(liquidator),
          assetCollateral: collateral._address,
          collateralBalanceBefore: liquidationSetup.initialCollateralAmount.toString(),
          collateralBalanceAccumulated: expectedAccumulatedSupplyBalance_TargetUserCollateral.toString(),
          amountSeized: expectedAmountSeized.toString(),
          collateralBalanceAfter: expectedSupplyBalanceAfter_TargetUserCollateral.toString()
        }
      );

      // Liquidator's off-protocol token balance should have declined by the amount used to reduce the target user's borrow
      const liquidatorTokenBalance = await borrowed.methods.balanceOf(liquidator).call();
      assert.equal(liquidatorTokenBalance, liquidationSetup.initialTokenBalanceLiquidator - expectedAmountRepaid);

      // Seized collateral goes to the liquidator's protocol account
      const liquidatorCollateralBalance = await moneyMarketHarness.methods.supplyBalances(liquidator, collateral._address).call();
      assert.equal(liquidatorCollateralBalance.principal, expectedAmountSeized);
      assert.equal(liquidatorCollateralBalance.interestIndex, expectedSupplyIndex_Collateral);

      const borrowerBorrowBalance = await moneyMarketHarness.methods.borrowBalances(borrower, borrowed._address).call();
      assert.equal(borrowerBorrowBalance.principal, expectedBorrowBalanceAfter_TargetUserBorrowed);
      const expectedBorrowIndexBorrowedAsset = 6 * 10**18; // ((2 blocks * 50%) + 1) * (3 * 10**18) (previous interest index)
      assert.equal(borrowerBorrowBalance.interestIndex, expectedBorrowIndexBorrowedAsset);

      const borrowerCollateralBalance = await moneyMarketHarness.methods.supplyBalances(borrower, collateral._address).call();
      assert.equal(borrowerCollateralBalance.principal, expectedSupplyBalanceAfter_TargetUserCollateral);
      assert.equal(borrowerCollateralBalance.interestIndex, expectedSupplyIndex_Collateral);

      await validateMarket(moneyMarketHarness, borrowed._address, "handles max for a supported market: borrowed", {
        blockNumber: liquidateResult.blockNumber,
        totalSupply: liquidationSetup.initialTokenBalanceOtherSupplier,
        supplyRateMantissa: simpleSupplyRateMantissa,
        supplyIndex: 1.4*1.2 * 10**18, // initial 10e18, multiplied by (1 + 4 * 0.1) at borrow and then (1 + 2 * 0.1) at liquidate
        totalBorrows: expectedBorrowBalanceAfter_TargetUserBorrowed,
        borrowRateMantissa: simpleBorrowRateMantissa,
        borrowIndex: expectedBorrowIndexBorrowedAsset
      });

      await validateMarket(moneyMarketHarness, collateral._address, "handles max for a supported market: collateral", {
        blockNumber: liquidateResult.blockNumber,
        totalSupply: expectedAccumulatedSupplyBalance_TargetUserCollateral, // though now it is split across target user and liquidator
        supplyRateMantissa: simpleSupplyRateMantissa,
        supplyIndex: expectedSupplyIndex_Collateral,
        totalBorrows: 0,
        borrowRateMantissa: simpleBorrowRateMantissa,
        borrowIndex: 2.5 * 10**18 // initial 10e18 when supplied, multiplied by (1 + 3*0.5) at liquidate
      });
    });

    it('handles max for an unsupported market', async () => {
      const {moneyMarketHarness, borrower, liquidator, borrowed, collateral, supplyCollateralBlock, borrowBlock} = await setupValidLiquidation();
      // Set market to unsupported
      await moneyMarketHarness.methods.harnessUnsupportMarket(borrowed._address).send({from: root});
      // Make borrower's collateral more valuable, so if the market were supported, the borrow would not be eligible for liquidation.
      // Set price of collateral to 3:1
      await moneyMarketHarness.methods.harnessSetAssetPrice(collateral._address, 3, 1).send({from: root});

      /////////// Call function.  liquidate max by specifying -1
      const liquidateResult = await moneyMarketHarness.methods.liquidateBorrow(borrower, borrowed._address, collateral._address, -1).send({from: liquidator});

      /////////// Validate
      // First let's make sure the environment is setup as we expected; otherwise we might get a successful test for the wrong reason.
      // We expect 5 blocks of supply interest at 10% per block, so make sure 5 blocks have passed since the supply of collateral was received.
      // 5 blocks comes from 2 blocks in setupValidLiquidation() and then 3 blocks here to unsupport market, change price, and do liquidation.
      assert.equal(supplyCollateralBlock+5, liquidateResult.blockNumber);

      // We expect 4 blocks of borrow interest at 50% per block so make sure 4 blocks have passed since the borrow was created.
      // 4 blocks comes from 1 block in setupValidLiquidation() and then 3 blocks here to unsupport market, change price, and do liquidation.
      assert.equal(borrowBlock+4, liquidateResult.blockNumber);

      const expectedAccumulatedBorrowBalance_TargetUserBorrowed = 30; // 10 + (4 blocks * 50% per block * 10) = 10 + 20 = 30
      const expectedAmountRepaid = 30; // We expect all of the unsupported asset to be repaid
      const expectedBorrowBalanceAfter_TargetUserBorrowed = expectedAccumulatedBorrowBalance_TargetUserBorrowed - expectedAmountRepaid;

      const expectedAccumulatedSupplyBalance_TargetUserCollateral = 15; // 10 + (5 blocks * 10%/block * 10) = 10 + 5 = 15
      const expectedSupplyIndex_Collateral = 1.5 * 10**18; // ((5 blocks * 10%) + 1) * 10**18 (initial interest index)
      const expectedAmountSeized = 10; // min(15 accrued, 10 derived from borrow) (30 borrow/ 3 collateral to borrow price ratio) = 10
      const expectedSupplyBalanceAfter_TargetUserCollateral = expectedAccumulatedSupplyBalance_TargetUserCollateral - expectedAmountSeized;

      assert.hasLog(liquidateResult,
        "BorrowLiquidated",
        {
          targetAccount: checksum(borrower),
          assetBorrow: borrowed._address,
          borrowBalanceBefore: liquidationSetup.initialBorrowAmount.toString(),
          borrowBalanceAccumulated: expectedAccumulatedBorrowBalance_TargetUserBorrowed.toString(),
          amountRepaid: expectedAmountRepaid.toString(),
          borrowBalanceAfter: expectedBorrowBalanceAfter_TargetUserBorrowed.toString(),
          liquidator: checksum(liquidator),
          assetCollateral: collateral._address,
          collateralBalanceBefore: liquidationSetup.initialCollateralAmount.toString(),
          collateralBalanceAccumulated: expectedAccumulatedSupplyBalance_TargetUserCollateral.toString(),
          amountSeized: expectedAmountSeized.toString(),
          collateralBalanceAfter: expectedSupplyBalanceAfter_TargetUserCollateral.toString()
        }
      );

      // Liquidator's off-protocol token balance should have declined by the amount used to reduce the target user's borrow
      const liquidatorTokenBalance = await borrowed.methods.balanceOf(liquidator).call();
      assert.equal(liquidatorTokenBalance, liquidationSetup.initialTokenBalanceLiquidator - expectedAmountRepaid);

      // Seized collateral goes to the liquidator's protocol account
      const liquidatorCollateralBalance = await moneyMarketHarness.methods.supplyBalances(liquidator, collateral._address).call();
      assert.equal(liquidatorCollateralBalance.principal, expectedAmountSeized);
      assert.equal(liquidatorCollateralBalance.interestIndex, expectedSupplyIndex_Collateral);

      const borrowerBorrowBalance = await moneyMarketHarness.methods.borrowBalances(borrower, borrowed._address).call();
      assert.equal(borrowerBorrowBalance.principal, expectedBorrowBalanceAfter_TargetUserBorrowed);

      const expectedBorrowIndexBorrowedAsset = 9 * 10**18; // ((4 blocks * 50%) + 1) * (3 * 10**18) (previous interest index)
      assert.equal(borrowerBorrowBalance.interestIndex, expectedBorrowIndexBorrowedAsset);

      const borrowerCollateralBalance = await moneyMarketHarness.methods.supplyBalances(borrower, collateral._address).call();
      assert.equal(borrowerCollateralBalance.principal, expectedSupplyBalanceAfter_TargetUserCollateral);
      assert.equal(borrowerCollateralBalance.interestIndex, expectedSupplyIndex_Collateral);

      await validateMarket(moneyMarketHarness, borrowed._address, "handles max for an unsupported market: borrowed", {
        blockNumber: liquidateResult.blockNumber,
        totalSupply: liquidationSetup.initialTokenBalanceOtherSupplier,
        supplyRateMantissa: simpleSupplyRateMantissa,
        supplyIndex: 1.96 * 10**18, // initial 10e18, multiplied by (1 + 4 * 0.1) at borrow and then (1 + 4 * 0.1) at liquidate
        totalBorrows: expectedBorrowBalanceAfter_TargetUserBorrowed,
        borrowRateMantissa: simpleBorrowRateMantissa,
        borrowIndex: expectedBorrowIndexBorrowedAsset
      });

      await validateMarket(moneyMarketHarness, collateral._address, "handles max for an unsupported market: collateral", {
        blockNumber: liquidateResult.blockNumber,
        totalSupply: expectedAccumulatedSupplyBalance_TargetUserCollateral, // though now it is split across target user and liquidator
        supplyRateMantissa: simpleSupplyRateMantissa,
        supplyIndex: expectedSupplyIndex_Collateral,
        totalBorrows: 0,
        borrowRateMantissa: simpleBorrowRateMantissa,
        borrowIndex: 3.5 * 10**18 // initial 10e18 when supplied, multiplied by (1 + 5*0.5) at liquidate
      });
    });

    it('allows max for liquidation of 0', async () => {
      const {moneyMarketHarness, borrower, liquidator, borrowed, collateral, supplyCollateralBlock, borrowBlock} = await setupValidLiquidation();

      // Make borrower's collateral more valuable so the borrow is not eligible for liquidation.
      // Set price of collateral to 4:1
      await moneyMarketHarness.methods.harnessSetAssetPrice(collateral._address, 4, 1).send({from: root});

      /////////// Call function. liquidate max by specifying -1
      const liquidateResult = await moneyMarketHarness.methods.liquidateBorrow(borrower, borrowed._address, collateral._address, -1).send({from: liquidator});

      /////////// Validate
      // First let's make sure the environment is setup as we expected; otherwise we might get a successful test for the wrong reason.
      // We expect 4 blocks of supply interest at 10% per block, so make sure 4 blocks have passed since the supply of collateral was received.
      // 4 blocks comes from 2 blocks in setupValidLiquidation() and then 2 blocks here to do the price change and liquidation.
      assert.equal(supplyCollateralBlock+4, liquidateResult.blockNumber);

      // We expect 3 blocks of borrow interest at 50% per block so make sure 3 blocks have passed since the borrow was created.
      // 3 blocks comes from 1 block in setupValidLiquidation() and then 2 blocks here to do the price change and liquidation.
      assert.equal(borrowBlock+3, liquidateResult.blockNumber);

      const expectedAccumulatedBorrowBalance_TargetUserBorrowed = 25; // 10 + ( 3 blocks * 50%/block * 10) = 10 + 15 = 25;
      const expectedAmountRepaid = 0; // Collateral price is very high so there is no shortfall.
      const expectedBorrowBalanceAfter_TargetUserBorrowed = expectedAccumulatedBorrowBalance_TargetUserBorrowed - expectedAmountRepaid;

      const expectedAccumulatedSupplyBalance_TargetUserCollateral = 14; // 10 + (4 blocks * 10%/block * 10 = 10 + 4 = 14;
      const expectedSupplyIndex_Collateral = 1.4 * 10**18; // ((4 blocks * 10%) + 1) * 10**18 (initial interest index)
      const expectedAmountSeized = 0; // Collateral price is very high so there is no shortfall.
      const expectedSupplyBalanceAfter_TargetUserCollateral = expectedAccumulatedSupplyBalance_TargetUserCollateral - expectedAmountSeized; // See comment re expectedAmountRepaid

      assert.hasLog(liquidateResult,
        "BorrowLiquidated",
        {
          targetAccount: checksum(borrower),
          assetBorrow: borrowed._address,
          borrowBalanceBefore: liquidationSetup.initialBorrowAmount.toString(),
          borrowBalanceAccumulated: expectedAccumulatedBorrowBalance_TargetUserBorrowed.toString(),
          amountRepaid: expectedAmountRepaid.toString(),
          borrowBalanceAfter: expectedBorrowBalanceAfter_TargetUserBorrowed.toString(),
          liquidator: checksum(liquidator),
          assetCollateral: collateral._address,
          collateralBalanceBefore: liquidationSetup.initialCollateralAmount.toString(),
          collateralBalanceAccumulated: expectedAccumulatedSupplyBalance_TargetUserCollateral.toString(),
          amountSeized: expectedAmountSeized.toString(),
          collateralBalanceAfter: expectedSupplyBalanceAfter_TargetUserCollateral.toString()
        }
      );

      // Liquidator's off-protocol token balance should have declined by the amount used to reduce the target user's borrow
      const liquidatorTokenBalance = await borrowed.methods.balanceOf(liquidator).call();
      assert.equal(liquidatorTokenBalance, liquidationSetup.initialTokenBalanceLiquidator - expectedAmountRepaid);

      // Seized collateral goes to the liquidator's protocol account
      const liquidatorCollateralBalance = await moneyMarketHarness.methods.supplyBalances(liquidator, collateral._address).call();
      assert.equal(liquidatorCollateralBalance.principal, expectedAmountSeized);
      assert.equal(liquidatorCollateralBalance.interestIndex, expectedSupplyIndex_Collateral); // ((4 blocks * 10%) + 1) * 10**18 (initial interest index)

      const borrowerBorrowBalance = await moneyMarketHarness.methods.borrowBalances(borrower, borrowed._address).call();
      const expectedBorrowIndexBorrowedAsset = 7.5 * 10**18; // ((3 blocks * 50%) + 1) * (3 * 10**18) (previous interest index)
      assert.equal(borrowerBorrowBalance.principal, expectedBorrowBalanceAfter_TargetUserBorrowed);
      assert.equal(borrowerBorrowBalance.interestIndex, expectedBorrowIndexBorrowedAsset);

      const borrowerCollateralBalance = await moneyMarketHarness.methods.supplyBalances(borrower, collateral._address).call();
      assert.equal(borrowerCollateralBalance.principal, expectedSupplyBalanceAfter_TargetUserCollateral);
      assert.equal(borrowerCollateralBalance.interestIndex, expectedSupplyIndex_Collateral);

      await validateMarket(moneyMarketHarness, borrowed._address, "allows max for liquidation of 0: borrowed", {
        blockNumber: liquidateResult.blockNumber,
        totalSupply: liquidationSetup.initialTokenBalanceOtherSupplier,
        supplyRateMantissa: simpleSupplyRateMantissa,
        supplyIndex: 1.82 * 10**18, //initial 10**18 * (1 + 4*0.1) * (1 + 3*0.1)
        totalBorrows: expectedBorrowBalanceAfter_TargetUserBorrowed,
        borrowRateMantissa: simpleBorrowRateMantissa,
        borrowIndex: expectedBorrowIndexBorrowedAsset
      });

      await validateMarket(moneyMarketHarness, collateral._address, "allows max for liquidation of 0: collateral", {
        blockNumber: liquidateResult.blockNumber,
        totalSupply: expectedAccumulatedSupplyBalance_TargetUserCollateral, // though now it is split across target user and liquidator
        supplyRateMantissa: simpleSupplyRateMantissa,
        supplyIndex: expectedSupplyIndex_Collateral,
        totalBorrows: 0,
        borrowRateMantissa: simpleBorrowRateMantissa,
        borrowIndex: 3 * 10**18 // initial 10e18 when supplied, multiplied by (1 + 4*0.5) at liquidate
      });
    });

    it('handles unset price oracle', async () => {
      // We start with a valid setup then tweak as necessary to hit the desired error condition.
      const {moneyMarketHarness, borrower, liquidator, borrowed, collateral} = await setupValidLiquidation();

      // SETUP DESIRED FAILURE:
      // Set current borrow interest index to maxUint so when we multiply by it we get an overflow
      await moneyMarketHarness.methods.harnessSetOracle(0).send({from: root});
      await moneyMarketHarness.methods.harnessSetUseOracle(true).send({from: root});

      /////////// Call function
      const liquidateResult = await moneyMarketHarness.methods.liquidateBorrow(borrower, borrowed._address, collateral._address, 1).send({from: liquidator});

      await validateFailedLiquidation(liquidateResult, moneyMarketHarness, borrower, borrowed, collateral, liquidator,
        ErrorEnum.ZERO_ORACLE_ADDRESS, FailureInfoEnum.LIQUIDATE_FETCH_ASSET_PRICE_FAILED);
    });

    it('fails with zero oracle price (borrowed)', async () => {
      // We start with a valid setup then tweak as necessary to hit the desired error condition.
      const {moneyMarketHarness, borrower, liquidator, borrowed, collateral} = await setupValidLiquidation();

      // Set oracle price to zero for borrowed
      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(borrowed._address, 0).send({from: root});

      /////////// Call function
      const liquidateResult = await moneyMarketHarness.methods.liquidateBorrow(borrower, borrowed._address, collateral._address, 1).send({from: liquidator});

      await validateFailedLiquidation(liquidateResult, moneyMarketHarness, borrower, borrowed, collateral, liquidator,
        ErrorEnum.DIVISION_BY_ZERO, FailureInfoEnum.LIQUIDATE_BORROW_DENOMINATED_COLLATERAL_CALCULATION_FAILED);
    });

    it('fails with zero oracle price (collateral)', async () => {
      // We start with a valid setup then tweak as necessary to hit the desired error condition.
      const {moneyMarketHarness, borrower, liquidator, borrowed, collateral} = await setupValidLiquidation();

      // Set oracle price to zero for borrowed
      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(collateral._address, 0).send({from: root});

      /////////// Call function
      const liquidateResult = await moneyMarketHarness.methods.liquidateBorrow(borrower, borrowed._address, collateral._address, 1).send({from: liquidator});

      await validateFailedLiquidation(liquidateResult, moneyMarketHarness, borrower, borrowed, collateral, liquidator,
        ErrorEnum.MISSING_ASSET_PRICE, FailureInfoEnum.LIQUIDATE_DISCOUNTED_REPAY_TO_EVEN_AMOUNT_CALCULATION_FAILED);
    });

    it('handles failure to calculate new borrow index for borrowed asset', async () => {
      // We start with a valid setup then tweak as necessary to hit the desired error condition.
      const {moneyMarketHarness, borrower, liquidator, borrowed, collateral, supplyCollateralBlock, borrowBlock} = await setupValidLiquidation();

      // SETUP DESIRED FAILURE:
      // Set current borrow interest index to maxUint so when we multiply by it we get an overflow
      await moneyMarketHarness.methods.harnessSetMarketDetails(borrowed._address, 0, 0, 1, 10, 0, bigNums.maxUint).send({from: root});

      /////////// Call function
      const liquidateResult = await moneyMarketHarness.methods.liquidateBorrow(borrower, borrowed._address, collateral._address, 1).send({from: liquidator});

      await validateFailedLiquidation(liquidateResult, moneyMarketHarness, borrower, borrowed, collateral, liquidator,
        ErrorEnum.INTEGER_OVERFLOW, FailureInfoEnum.LIQUIDATE_NEW_BORROW_INDEX_CALCULATION_FAILED_BORROWED_ASSET);
    });

    it('handles failure to calculate new borrow balance for borrowed asset', async () => {
      // We start with a valid setup then tweak as necessary to hit the desired error condition.
      const {moneyMarketHarness, borrower, liquidator, borrowed, collateral} = await setupValidLiquidation();

      // SETUP DESIRED FAILURE:
      // Set zero as the previous borrow index for the customer's borrow. This should cause div by zero error in balance calc.
      await moneyMarketHarness.methods.harnessSetAccountBorrowBalance(borrower, borrowed._address, 10, 0).send({from: root});

      /////////// Call function
      const result = await moneyMarketHarness.methods.liquidateBorrow(borrower, borrowed._address, collateral._address, 1).send({from: liquidator});

      await validateFailedLiquidation(result, moneyMarketHarness, borrower, borrowed, collateral, liquidator,
        ErrorEnum.DIVISION_BY_ZERO, FailureInfoEnum.LIQUIDATE_ACCUMULATED_BORROW_BALANCE_CALCULATION_FAILED);
    });

    it('handles failure to calculate new supply index for collateral asset', async () => {
      // We start with a valid setup then tweak as necessary to hit the desired error condition.
      const {moneyMarketHarness, borrower, liquidator, borrowed, collateral} = await setupValidLiquidation();

      // SETUP DESIRED FAILURE:
      // Set current borrow interest index to maxUint so when we multiply by it we get an overflow
      await moneyMarketHarness.methods.harnessSetMarketDetails(collateral._address, 100, 0, bigNums.maxUint, 0, 0, 1).send({from: root});

      /////////// Call function
      const result = await moneyMarketHarness.methods.liquidateBorrow(borrower, borrowed._address, collateral._address, 1).send({from: liquidator});

      await validateFailedLiquidation(result, moneyMarketHarness, borrower, borrowed, collateral, liquidator,
        ErrorEnum.INTEGER_OVERFLOW, FailureInfoEnum.LIQUIDATE_NEW_SUPPLY_INDEX_CALCULATION_FAILED_COLLATERAL_ASSET);
    });

    it('handles failure to calculate new supply index for borrower collateral asset', async () => {
      // We start with a valid setup then tweak as necessary to hit the desired error condition.
      const {moneyMarketHarness, borrower, liquidator, borrowed, collateral} = await setupValidLiquidation();

      // SETUP DESIRED FAILURE:
      // Set zero as the previous supply index for the borrower's collateral. This should cause div by zero error in balance calc.
      await moneyMarketHarness.methods.harnessSetAccountSupplyBalance(borrower, collateral._address, 10, 0).send({from: root});

      /////////// Call function
      const result = await moneyMarketHarness.methods.liquidateBorrow(borrower, borrowed._address, collateral._address, 1).send({from: liquidator});

      await validateFailedLiquidation(result, moneyMarketHarness, borrower, borrowed, collateral, liquidator,
        ErrorEnum.DIVISION_BY_ZERO, FailureInfoEnum.LIQUIDATE_ACCUMULATED_SUPPLY_BALANCE_CALCULATION_FAILED_BORROWER_COLLATERAL_ASSET);
    });

    it('handles failure to calculate new supply index for liquidator collateral asset', async () => {
      // We start with a valid setup then tweak as necessary to hit the desired error condition.
      const {moneyMarketHarness, borrower, liquidator, borrowed, collateral} = await setupValidLiquidation();

      // SETUP DESIRED FAILURE:
      // Set zero as the previous supply index for the liquidator's collateral. This should cause div by zero error in balance calc.
      // NOTE: We also have to give the liquidator a previous balance of collateral to avoid short circuit.
      // This means we can't use the standard failed liquidation validator below.
      await moneyMarketHarness.methods.harnessSetAccountSupplyBalance(liquidator, collateral._address, 1, 0).send({from: root});

      /////////// Call function
      const result = await moneyMarketHarness.methods.liquidateBorrow(borrower, borrowed._address, collateral._address, 1).send({from: liquidator});

      assert.hasFailure(result,
        ErrorEnum.DIVISION_BY_ZERO,
        FailureInfoEnum.LIQUIDATE_ACCUMULATED_SUPPLY_BALANCE_CALCULATION_FAILED_LIQUIDATOR_COLLATERAL_ASSET
      );

      // Started with 100, should still have 100
      const liquidatorTokenBalance = await borrowed.methods.balanceOf(liquidator).call();
      assert.equal(100, liquidatorTokenBalance);

      // No collateral was seized, but we had to give liquidator an existing balance of 1 in order to hit the error
      const liquidatorCollateralBalance = await moneyMarketHarness.methods.supplyBalances(liquidator, collateral._address).call();
      assert.equal(1, liquidatorCollateralBalance.principal);

      // should be unchanged from original 10
      const borrowerBorrowBalance = await moneyMarketHarness.methods.borrowBalances(borrower, borrowed._address).call();
      assert.equal(10, borrowerBorrowBalance.principal);

      // should be unchanged from original 10
      const borrowerCollateralBalance = await moneyMarketHarness.methods.supplyBalances(borrower, collateral._address).call();
      assert.equal(10, borrowerCollateralBalance.principal);
    });

    it('handles failure to calculate new total supply balance from borrower collateral asset', async () => {
      // We start with a valid setup then tweak as necessary to hit the desired error condition.
      const {moneyMarketHarness, borrower, liquidator, borrowed, collateral} = await setupValidLiquidation();

      // SETUP DESIRED FAILURE:
      // Give the protocol a token balance of maxUint so when we calculate adding the borrower's accumulated supply to it, it will overflow.
      await moneyMarketHarness.methods.harnessSetMarketDetails(collateral._address, bigNums.maxUint, 0, 10**18, 0, 0, 10**18).send({from: root});

      /////////// Call function
      const result = await moneyMarketHarness.methods.liquidateBorrow(borrower, borrowed._address, collateral._address, 1).send({from: liquidator});

      await validateFailedLiquidation(result, moneyMarketHarness, borrower, borrowed, collateral, liquidator,
        ErrorEnum.INTEGER_OVERFLOW, FailureInfoEnum.LIQUIDATE_NEW_TOTAL_SUPPLY_BALANCE_CALCULATION_FAILED_BORROWER_COLLATERAL_ASSET);
    });

    it('handles failure to calculate new total supply balance from liquidator collateral asset', async () => {
      // We start with a valid setup then tweak as necessary to hit the desired error condition.
      const {moneyMarketHarness, borrower, liquidator, borrowed, collateral} = await setupValidLiquidation();

      // SETUP DESIRED FAILURE:
      // Give the liquidator a supply balance of maxUint so when we add it to the total supply as of the borrower's accumulated collateral, it will overflow
      // This means we can't use the standard failed liquidation validator below.
      await moneyMarketHarness.methods.harnessSetAccountSupplyBalance(liquidator, collateral._address, bigNums.maxUint, 1).send({from: root});
      // Give protocol 11 and interest rate zero so we don't overflow earlier in the process
      await moneyMarketHarness.methods.harnessSetMarketDetails(collateral._address, 11, 0, 1, 0, 0, 1).send({from: root});

      /////////// Call function
      const result = await moneyMarketHarness.methods.liquidateBorrow(borrower, borrowed._address, collateral._address, 1).send({from: liquidator});

      assert.hasFailure(result,
        ErrorEnum.INTEGER_OVERFLOW,
        FailureInfoEnum.LIQUIDATE_NEW_TOTAL_SUPPLY_BALANCE_CALCULATION_FAILED_LIQUIDATOR_COLLATERAL_ASSET
      );

      // Started with 100, should still have 100
      const liquidatorTokenBalance = await borrowed.methods.balanceOf(liquidator).call();
      assert.equal(100, liquidatorTokenBalance);

      // No collateral was seized, but we had to give liquidator an existing balance of max uint in order to hit the error
      const liquidatorCollateralBalance = await moneyMarketHarness.methods.supplyBalances(liquidator, collateral._address).call();
      assert.bigNumEquals(bigNums.maxUint, liquidatorCollateralBalance.principal);

      // should be unchanged from original 10
      const borrowerBorrowBalance = await moneyMarketHarness.methods.borrowBalances(borrower, borrowed._address).call();
      assert.equal(10, borrowerBorrowBalance.principal);

      // should be unchanged from original 10
      const borrowerCollateralBalance = await moneyMarketHarness.methods.supplyBalances(borrower, collateral._address).call();
      assert.equal(10, borrowerCollateralBalance.principal);
    });

    it('handles failure to calculate borrower liquidity', async () => {
      // We start with a valid setup then tweak as necessary to hit the desired error condition.
      const {moneyMarketHarness, borrower, liquidator, borrowed, collateral} = await setupValidLiquidation();

      // SETUP DESIRED FAILURE:
      // Use harness to ensure desired failure
      await moneyMarketHarness.methods.harnessSetFailLiquidityCheck(borrower, true).send({from: root});

      /////////// Call function
      const result = await moneyMarketHarness.methods.liquidateBorrow(borrower, borrowed._address, collateral._address, 1).send({from: liquidator});

      await validateFailedLiquidation(result, moneyMarketHarness, borrower, borrowed, collateral, liquidator,
        ErrorEnum.INTEGER_OVERFLOW, FailureInfoEnum.LIQUIDATE_DISCOUNTED_REPAY_TO_EVEN_AMOUNT_CALCULATION_FAILED);
    });

    it('handles failure to calculate discounted borrow-denominated shortfall', async () => {
      // We start with a valid setup then tweak as necessary to hit the desired error condition.
      const {moneyMarketHarness, borrower, liquidator, borrowed, collateral} = await setupValidLiquidation();

      // SETUP DESIRED FAILURE:
      // Trigger a division by zero in `calculateDiscountedRepayToEvenAmount`:
      // Set price of borrowed to min exp and set a large liquidation discount.
      // Thus, the discounted price is zero and when we divide the shortfall by it, we get the error.
      // Note: We also have to set the collateral price low or we won't have anything eligible for liquidation.
      await moneyMarketHarness.methods.harnessSetAssetPrice(borrowed._address, 1, 10**18).send({from: root});
      await moneyMarketHarness.methods.harnessSetAssetPrice(collateral._address, 1, 10**18).send({from: root});
      await moneyMarketHarness.methods.harnessSetLiquidationDiscount(999000000000000000).send({from: root}); // .999

      /////////// Call function
      const result = await moneyMarketHarness.methods.liquidateBorrow(borrower, borrowed._address, collateral._address, 1).send({from: liquidator});

      await validateFailedLiquidation(result, moneyMarketHarness, borrower, borrowed, collateral, liquidator,
        ErrorEnum.DIVISION_BY_ZERO, FailureInfoEnum.LIQUIDATE_DISCOUNTED_REPAY_TO_EVEN_AMOUNT_CALCULATION_FAILED);
    });

    it('handles failure to calculate discounted borrow-denominated collateral', async () => {
      // We start with a valid setup then tweak as necessary to hit the desired error condition.
      const {moneyMarketHarness, borrower, liquidator, borrowed, collateral} = await setupValidLiquidation();

      // SETUP DESIRED FAILURE:
      // use harness method to flag method for failure
      await moneyMarketHarness.methods.harnessSetFailBorrowDenominatedCollateralCalculation(true).send({from: root});

      /////////// Call function
      const result = await moneyMarketHarness.methods.liquidateBorrow(borrower, borrowed._address, collateral._address, 1).send({from: liquidator});

      await validateFailedLiquidation(result, moneyMarketHarness, borrower, borrowed, collateral, liquidator,
        ErrorEnum.INTEGER_OVERFLOW, FailureInfoEnum.LIQUIDATE_BORROW_DENOMINATED_COLLATERAL_CALCULATION_FAILED);
    });

    it('handles case of liquidator requesting to close too much of borrow', async () => {
      // We start with a valid setup then tweak as necessary to hit the desired error condition.
      const {moneyMarketHarness, borrower, liquidator, borrowed, collateral} = await setupValidLiquidation();

      /////////// Call function with a requested amount that is too high
      const result = await moneyMarketHarness.methods.liquidateBorrow(borrower, borrowed._address, collateral._address, 30).send({from: liquidator});

      await validateFailedLiquidation(result, moneyMarketHarness, borrower, borrowed, collateral, liquidator,
        ErrorEnum.INVALID_CLOSE_AMOUNT_REQUESTED, FailureInfoEnum.LIQUIDATE_CLOSE_AMOUNT_TOO_HIGH);
    });

    it('handles failure to calculate amount of borrow to seize', async () => {
      // We start with a valid setup then tweak as necessary to hit the desired error condition.
      const {moneyMarketHarness, borrower, liquidator, borrowed, collateral} = await setupValidLiquidation();

      // SETUP DESIRED FAILURE:
      // use harness method to flag method for failure
      await  moneyMarketHarness.methods.harnessSetFailCalculateAmountSeize(true).send({from: root});

      /////////// Call function
      const result = await moneyMarketHarness.methods.liquidateBorrow(borrower, borrowed._address, collateral._address, 1).send({from: liquidator});

      await validateFailedLiquidation(result, moneyMarketHarness, borrower, borrowed, collateral, liquidator,
        ErrorEnum.INTEGER_OVERFLOW, FailureInfoEnum.LIQUIDATE_AMOUNT_SEIZE_CALCULATION_FAILED);
    });

    it('handles failure to calculate new supply index for the collateral asset', async () => {
      // We start with a valid setup then tweak as necessary to hit the desired error condition.
      const {moneyMarketHarness, borrower, liquidator, borrowed, collateral} = await setupValidLiquidation();

      // SETUP DESIRED FAILURE:
      // Store a block number that should be HIGHER than the current block number so we'll get an underflow
      // when calculating block delta.
      await moneyMarketHarness.methods.harnessSetMarketBlockNumber(collateral._address, -1).send({from: root});

      /////////// Call function
      const result = await moneyMarketHarness.methods.liquidateBorrow(borrower, borrowed._address, collateral._address, 1).send({from: liquidator});

      await validateFailedLiquidation(result, moneyMarketHarness, borrower, borrowed, collateral, liquidator,
        ErrorEnum.INTEGER_UNDERFLOW, FailureInfoEnum.LIQUIDATE_NEW_SUPPLY_INDEX_CALCULATION_FAILED_COLLATERAL_ASSET);
    });

    it('handles failure to calculate new borrow index for the collateral asset', async () => {
      // We start with a valid setup then tweak as necessary to hit the desired error condition.
      const {moneyMarketHarness, borrower, liquidator, borrowed, collateral} = await setupLiquidationWithHarnessForFailureTest();

      // SETUP DESIRED FAILURE:
      // Set current borrow interest index to maxUint so when we multiply by it we get an overflow
      await moneyMarketHarness.methods.harnessSetMarketDetails(collateral._address, 0, 0, 1, 10, 0, bigNums.maxUint).send({from: root});

      /////////// Call function
      const result = await moneyMarketHarness.methods.liquidateBorrow(borrower, borrowed._address, collateral._address, 1).send({from: liquidator});

      await validateFailedLiquidation(result, moneyMarketHarness, borrower, borrowed, collateral, liquidator,
        ErrorEnum.INTEGER_OVERFLOW, FailureInfoEnum.LIQUIDATE_NEW_BORROW_INDEX_CALCULATION_FAILED_COLLATERAL_ASSET);
    });

    it('handles failure to calculate new supply rate for the borrowed asset', async () => {
      // We start with a valid setup then tweak as necessary to hit the desired error condition.
      const {moneyMarketHarness, borrower, liquidator, borrowed, collateral} = await setupValidLiquidation();

      // SETUP DESIRED FAILURE:
      // Set up FailingInterestModel for borrowed market
      const FailableInterestRateModel = getContract("./test/InterestRateModel/FailableInterestRateModel.sol");
      const failableInterestRateModel = await FailableInterestRateModel.new(true, false).send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(borrowed._address, failableInterestRateModel._address).send({from: root});

      /////////// Call function
      const result = await moneyMarketHarness.methods.liquidateBorrow(borrower, borrowed._address, collateral._address, 1).send({from: liquidator});

      await validateFailedLiquidation(result, moneyMarketHarness, borrower, borrowed, collateral, liquidator,
        ErrorEnum.OPAQUE_ERROR, FailureInfoEnum.LIQUIDATE_NEW_SUPPLY_RATE_CALCULATION_FAILED_BORROWED_ASSET);
    });

    it('handles failure to calculate new borrow rate for the borrowed asset', async () => {
      // We start with a valid setup then tweak as necessary to hit the desired error condition.
      const {moneyMarketHarness, borrower, liquidator, borrowed, collateral} = await setupValidLiquidation();

      // SETUP DESIRED FAILURE:
      // Set up FailingInterestModel for borrowed market
      const FailableInterestRateModel = getContract("./test/InterestRateModel/FailableInterestRateModel.sol");
      const failableInterestRateModel = await FailableInterestRateModel.new(false, true).send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(borrowed._address, failableInterestRateModel._address).send({from: root});

      /////////// Call function
      const result = await moneyMarketHarness.methods.liquidateBorrow(borrower, borrowed._address, collateral._address, 1).send({from: liquidator});

      await validateFailedLiquidation(result, moneyMarketHarness, borrower, borrowed, collateral, liquidator,
        ErrorEnum.OPAQUE_ERROR, FailureInfoEnum.LIQUIDATE_NEW_BORROW_RATE_CALCULATION_FAILED_BORROWED_ASSET);
    });

    it('handles failure to calculate new supply index for the borrowed asset', async () => {
      // We start with a valid setup then tweak as necessary to hit the desired error condition.
      const {moneyMarketHarness, borrower, liquidator, borrowed, collateral} = await setupLiquidationWithHarnessForFailureTest();

      // SETUP DESIRED FAILURE:
      // Set current borrow interest index to maxUint so when we multiply by it we get an overflow
      await moneyMarketHarness.methods.harnessSetMarketDetails(borrowed._address, 0, 0, bigNums.maxUint, 1000, 0, 2).send({from: root});

      /////////// Call function
      const result = await moneyMarketHarness.methods.liquidateBorrow(borrower, borrowed._address, collateral._address, 1).send({from: liquidator});

      await validateFailedLiquidation(result, moneyMarketHarness, borrower, borrowed, collateral, liquidator,
        ErrorEnum.INTEGER_OVERFLOW, FailureInfoEnum.LIQUIDATE_NEW_SUPPLY_INDEX_CALCULATION_FAILED_BORROWED_ASSET);
    });

    it('handles failure to calculate new total borrow for the borrowed asset', async () => {
      // We start with a valid setup then tweak as necessary to hit the desired error condition.
      const {moneyMarketHarness, borrower, liquidator, borrowed, collateral} = await setupLiquidationWithHarnessForFailureTest();

      // SETUP DESIRED FAILURE:
      // Give the protocol a token balance of 0 so when we subtract the new borrow from it, it will underflow.
      await moneyMarketHarness.methods.harnessSetMarketDetails(borrowed._address, 0, 0, 1, 0, 0, 1).send({from: root});

      /////////// Call function
      const result = await moneyMarketHarness.methods.liquidateBorrow(borrower, borrowed._address, collateral._address, 1).send({from: liquidator});

      await validateFailedLiquidation(result, moneyMarketHarness, borrower, borrowed, collateral, liquidator,
        ErrorEnum.INTEGER_UNDERFLOW, FailureInfoEnum.LIQUIDATE_NEW_TOTAL_BORROW_CALCULATION_FAILED_BORROWED_ASSET);
    });

    it('handles failure to calculate new total cash for the borrowed asset', async () => {
      // We start with a valid setup then tweak as necessary to hit the desired error condition.
      const {moneyMarketHarness, borrower, liquidator, borrowed, collateral} = await setupValidLiquidation();

      // SETUP DESIRED FAILURE:
      // We are going to repay 1, so fake out protocol current cash as maxUint so when we add the new cash it will overflow.
      await moneyMarketHarness.methods.harnessSetCash(borrowed._address, bigNums.maxUint).send({from: root});

      /////////// Call function
      const result = await moneyMarketHarness.methods.liquidateBorrow(borrower, borrowed._address, collateral._address, 1).send({from: liquidator});

      await validateFailedLiquidation(result, moneyMarketHarness, borrower, borrowed, collateral, liquidator,
        ErrorEnum.INTEGER_OVERFLOW, FailureInfoEnum.LIQUIDATE_NEW_TOTAL_CASH_CALCULATION_FAILED_BORROWED_ASSET);
    });

    it('handles failed transfer in of borrowed asset from liquidator', async () => {
      // We start with a valid setup then tweak as necessary to hit the desired error condition.
      const {moneyMarketHarness, borrower, liquidator, borrowed, collateral} = await setupValidLiquidation();

      // SETUP DESIRED FAILURE:
      // set up the token harness to fail transfer in from the liquidator
      await borrowed.methods.harnessSetFailTransferFromAddress(liquidator, true).send({from: root});

      /////////// Call function
      const result = await moneyMarketHarness.methods.liquidateBorrow(borrower, borrowed._address, collateral._address, 1).send({from: liquidator});

      await validateFailedLiquidation(result, moneyMarketHarness, borrower, borrowed, collateral, liquidator,
        ErrorEnum.TOKEN_TRANSFER_FAILED, FailureInfoEnum.LIQUIDATE_TRANSFER_IN_FAILED);
    });

    it('raises when failed transfer in of borrowed non-standard asset from liquidator', async () => {
      // We start with a valid setup then tweak as necessary to hit the desired error condition.
      const {moneyMarketHarness, borrower, liquidator, borrowed, collateral} = await setupValidLiquidation(true);

      // SETUP DESIRED FAILURE:
      // set up the token harness to fail transfer in from the liquidator
      await borrowed.methods.harnessSetFailTransferFromAddress(liquidator, true).send({from: root});

      /////////// Call function
      await assert.revert(moneyMarketHarness.methods.liquidateBorrow(borrower, borrowed._address, collateral._address, 1).send({from: liquidator}));
    });

    it('handles liquidator failure to approve borrowed asset for transfer in to protocol', async () => {
      // We start with a valid setup then tweak as necessary to hit the desired error condition.
      const {moneyMarketHarness, borrower, liquidator, borrowed, collateral} = await setupValidLiquidation();

      // SETUP DESIRED FAILURE:
      // remove liquidator's approval for borrowed asset
      await borrowed.methods.approve(moneyMarketHarness._address, 0).send({from: liquidator});

      /////////// Call function
      const result = await moneyMarketHarness.methods.liquidateBorrow(borrower, borrowed._address, collateral._address, 1).send({from: liquidator});

      await validateFailedLiquidation(result, moneyMarketHarness, borrower, borrowed, collateral, liquidator,
        ErrorEnum.TOKEN_INSUFFICIENT_ALLOWANCE, FailureInfoEnum.LIQUIDATE_TRANSFER_IN_NOT_POSSIBLE);
    });
  });

  describe('borrow', async () => {
    it('returns error and logs info if contract is paused', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});
      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      await moneyMarketHarness.methods._setPaused(true).send({from: root});

      const result = await moneyMarketHarness.methods.borrow(OMG._address, 90).send({from: customer});

      assert.hasFailure(result,
        ErrorEnum.CONTRACT_PAUSED,
        FailureInfoEnum.BORROW_CONTRACT_PAUSED
      );
    });

    it('fails if market not supported', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});
      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      const result = await moneyMarketHarness.methods.borrow(OMG._address, 90).send({from: customer});

      assert.hasFailure(result,
          ErrorEnum.MARKET_NOT_SUPPORTED,
          FailureInfoEnum.BORROW_MARKET_NOT_SUPPORTED
      );
    });

    it('returns error if new supply interest index calculation fails', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Support market
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});

      // Store a block number that should be HIGHER than the current block number so we'll get an underflow
      // when calculating block delta.
      await moneyMarketHarness.methods.harnessSetMarketBlockNumber(OMG._address, -1).send({from: root});

      const result = await moneyMarketHarness.methods.borrow(OMG._address, 90).send({from: customer});

      assert.hasFailure(result,
          ErrorEnum.INTEGER_UNDERFLOW,
          FailureInfoEnum.BORROW_NEW_BORROW_INDEX_CALCULATION_FAILED
      );
    });

    it('returns error if accumulated balance calculation fails', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Support market
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});

      // Set zero as the previous supply index for the customer. This should cause div by zero error in balance calc.
      // To reach that we also have to set the previous principal to a non-zero value otherwise we will short circuit.
      await moneyMarketHarness.methods.harnessSetAccountBorrowBalance(customer, OMG._address, 1, 0).send({from: root});

      const result = await moneyMarketHarness.methods.borrow(OMG._address, 90).send({from: customer});

      assert.hasFailure(result,
          ErrorEnum.DIVISION_BY_ZERO,
          FailureInfoEnum.BORROW_ACCUMULATED_BALANCE_CALCULATION_FAILED
      );
    });

    it('returns error if borrow fee calculation fails', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Support market
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});

      // Set origination fee to 1000%
      await moneyMarketHarness.methods._setOriginationFee(getExpMantissa(10)).send({from: root});

      // Borrow max uint, which will overflow with origination fee
      const result = await moneyMarketHarness.methods.borrow(OMG._address, bigNums.maxUint).send({from: customer});

      assert.hasFailure(result,
          ErrorEnum.INTEGER_OVERFLOW,
          FailureInfoEnum.BORROW_ORIGINATION_FEE_CALCULATION_FAILED
      );
    });

    it('returns error if customer account liquidity calculation fails', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(bigNums.maxUint, "test omg", 18, "omg").send({from: root});

      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});

      await moneyMarketHarness.methods.harnessSetFailLiquidityCheck(customer, true).send({from: root});

      const result = await moneyMarketHarness.methods.borrow(OMG._address, 1).send({from: customer});

      assert.hasFailure(result,
        ErrorEnum.INTEGER_OVERFLOW,
        FailureInfoEnum.BORROW_ACCOUNT_LIQUIDITY_CALCULATION_FAILED
      );
    });

    it('returns an error if borrow amount value calcuation fails', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});
      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Support market
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});

      // Set origination fee to 0%
      await moneyMarketHarness.methods._setOriginationFee(getExpMantissa(0)).send({from: root});

      // Set price of OMG to 10:1
      await moneyMarketHarness.methods.harnessSetAssetPrice(OMG._address, 10, 1).send({from: root});

      // Borrow max uint, which will overflow borrow amount
      const result = await moneyMarketHarness.methods.borrow(OMG._address, bigNums.maxUint).send({from: customer});

      assert.hasFailure(result,
        ErrorEnum.INTEGER_OVERFLOW,
        FailureInfoEnum.BORROW_AMOUNT_VALUE_CALCULATION_FAILED
      );
    });

    it('fails with liquidity shortfall present', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});
      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Support market
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});

      // Set origination fee to 0%
      await moneyMarketHarness.methods._setOriginationFee(getExpMantissa(0)).send({from: root});

      // Set price of OMG to 1:1
      await moneyMarketHarness.methods.harnessSetAssetPrice(OMG._address, 1, 1).send({from: root});

      // Set a required collateral ratio of 2:1
      await moneyMarketHarness.methods.harnessSetCollateralRatio(2, 1).send({from: root});

      // Set a shortfall
      await moneyMarketHarness.methods.harnessSetLiquidityShortfall(customer, 100).send({from: root});

      // Try to borrow when account has shortfall
      const result = await moneyMarketHarness.methods.borrow(OMG._address, 5).send({from: customer});

      assert.hasFailure(result,
        ErrorEnum.INSUFFICIENT_LIQUIDITY,
        FailureInfoEnum.BORROW_ACCOUNT_SHORTFALL_PRESENT
      );
    });

    it('fails with liquidity shortfall present sans harness', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});
      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});
      const DRGN = await EIP20.new(100, "test drgn", 18, "drgn").send({from: root});

      // Support market
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});

      // Add collateral market for drgn to get shortfall
      await moneyMarketHarness.methods.harnessAddCollateralMarket(DRGN._address).send({from: root});

      // Set origination fee to 0%
      await moneyMarketHarness.methods._setOriginationFee(getExpMantissa(0)).send({from: root});

      // Set price of OMG to 1:1
      await moneyMarketHarness.methods.harnessSetAssetPrice(OMG._address, 1, 1).send({from: root});

      // Set price of DRGN to 1:1
      await moneyMarketHarness.methods.harnessSetAssetPrice(DRGN._address, 1, 1).send({from: root});

      // Set a required collateral ratio of 2:1
      await moneyMarketHarness.methods.harnessSetCollateralRatio(2, 1).send({from: root});

      // Borrow drgn
      await moneyMarketHarness.methods.harnessSetAccountBorrowBalance(customer, DRGN._address, 10, 1).send({from: root});

      // Set market details
      await moneyMarketHarness.methods.harnessSetMarketDetails(DRGN._address, 0, 0, 1, 0, 0, 1).send({from: root});

      // Try to borrow when account has shortfall
      const result = await moneyMarketHarness.methods.borrow(OMG._address, 5).send({from: customer});

      assert.hasFailure(result,
        ErrorEnum.INSUFFICIENT_LIQUIDITY,
        FailureInfoEnum.BORROW_ACCOUNT_SHORTFALL_PRESENT
      );
    });

    it('fails with insufficient liquidity', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});
      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Support market
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});

      // Set origination fee to 0%
      await moneyMarketHarness.methods._setOriginationFee(getExpMantissa(0)).send({from: root});

      // Set price of OMG to 1:1
      await moneyMarketHarness.methods.harnessSetAssetPrice(OMG._address, 1, 1).send({from: root});

      await moneyMarketHarness.methods.harnessSetCollateralRatio(2, 1).send({from: root});

      // Try to borrow when account has insufficient liquidity
      const result = await moneyMarketHarness.methods.borrow(OMG._address, 5).send({from: customer});

      assert.hasFailure(result,
        ErrorEnum.INSUFFICIENT_LIQUIDITY,
        FailureInfoEnum.BORROW_AMOUNT_LIQUIDITY_SHORTFALL
      );
    });

    it('returns error if customer total new balance calculation fails', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(bigNums.maxUint, "test omg", 18, "omg").send({from: root});

      // Support market
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});

      // Set price of OMG to 1:1
      await moneyMarketHarness.methods.harnessSetAssetPrice(OMG._address, 1, 1).send({from: root});

      // Clear out collateral ratio so user can borrow
      await moneyMarketHarness.methods.harnessSetCollateralRatio(0, 1).send({from: root});

      // We are going to borrow 1, so give an existing balance of maxUint to cause an overflow.
      await moneyMarketHarness.methods.harnessSetAccountBorrowBalance(customer, OMG._address, bigNums.maxUint, 1).send({from: root});

      // Set market details
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 0, 0, 1, 0, 0, 1).send({from: root});

      const result = await moneyMarketHarness.methods.borrow(OMG._address, 1).send({from: customer});

      assert.hasFailure(result,
          ErrorEnum.INTEGER_OVERFLOW,
          FailureInfoEnum.BORROW_NEW_TOTAL_BALANCE_CALCULATION_FAILED
      );
    });

    it('returns error if protocol total borrow calculation fails via underflow', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(bigNums.maxUint, "test omg", 18, "omg").send({from: root});

      // Support market
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});

      // Set price of OMG to 1:1
      await moneyMarketHarness.methods.harnessSetAssetPrice(OMG._address, 1, 1).send({from: root});

      // Clear out collateral ratio so user can borrow
      await moneyMarketHarness.methods.harnessSetCollateralRatio(0, 1).send({from: root});

      // We are going to borrow 1, so give an existing balance of maxUint to cause an overflow.
      await moneyMarketHarness.methods.harnessSetAccountBorrowBalance(customer, OMG._address, bigNums.maxUint, 1).send({from: root});

      const result = await moneyMarketHarness.methods.borrow(OMG._address, 1).send({from: customer});

      assert.hasFailure(result,
          ErrorEnum.INTEGER_UNDERFLOW, // shouldn't this be overflow?
          FailureInfoEnum.BORROW_NEW_TOTAL_BORROW_CALCULATION_FAILED
      );
    });

    it('returns error if protocol total borrow calculation fails', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Support market
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});

      // Set price of OMG to 1:1
      await moneyMarketHarness.methods.harnessSetAssetPrice(OMG._address, 1, 1).send({from: root});

      // Clear out collateral ratio so user can borrow
      await moneyMarketHarness.methods.harnessSetCollateralRatio(0, 1).send({from: root});

      // Give the protocol a token balance of maxUint so when we calculate adding the new supply to it, it will overflow.
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 0, 0, 1, bigNums.maxUint, 0, 1).send({from: root});

      const result = await moneyMarketHarness.methods.borrow(OMG._address, 1).send({from: customer});

      assert.hasFailure(result,
        ErrorEnum.INTEGER_OVERFLOW,
        FailureInfoEnum.BORROW_NEW_TOTAL_BORROW_CALCULATION_FAILED
      );
    });

    it('returns error if protocol total cash calculation fails', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(bigNums.maxUint, "test omg", 18, "omg").send({from: root});

      // Support market
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});

      // Set price of OMG to 1:1
      await moneyMarketHarness.methods.harnessSetAssetPrice(OMG._address, 1, 1).send({from: root});

      // Clear out collateral ratio so user can borrow
      await moneyMarketHarness.methods.harnessSetCollateralRatio(0, 1).send({from: root});

      // Give the protocol a token balance of maxUint so when we calculate adding the new supply to it, it will overflow.
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 0, 0, 1, 0, 0, 1).send({from: root});

      // We are going to borrow 1, so fake out protocol current cash as 0 so when we sub the new cash it will underflow.
      await moneyMarketHarness.methods.harnessSetCash(OMG._address, 0).send({from: root});

      const result = await moneyMarketHarness.methods.borrow(OMG._address, 1).send({from: customer});

      assert.hasFailure(result,
        ErrorEnum.TOKEN_INSUFFICIENT_CASH,
        FailureInfoEnum.BORROW_NEW_TOTAL_CASH_CALCULATION_FAILED
      );
    });

    it('returns error if new supply rate calculation fails', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Set up FailingInterestModel for OMG market
      const FailableInterestRateModel = getContract("./test/InterestRateModel/FailableInterestRateModel.sol");
      const failableInterestRateModel = await FailableInterestRateModel.new(true, false).send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, failableInterestRateModel._address).send({from: root});

      // Support market
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});

      // Set price of OMG to 1:1
      await moneyMarketHarness.methods.harnessSetAssetPrice(OMG._address, 1, 1).send({from: root});

      // Clear out collateral ratio so user can borrow
      await moneyMarketHarness.methods.harnessSetCollateralRatio(0, 1).send({from: root});

      // We are going to borrow 1
      await moneyMarketHarness.methods.harnessSetCash(OMG._address, 100).send({from: root});

      const result = await moneyMarketHarness.methods.borrow(OMG._address, 90).send({from: customer});

      assert.hasFailure(result,
        ErrorEnum.OPAQUE_ERROR,
        FailureInfoEnum.BORROW_NEW_SUPPLY_RATE_CALCULATION_FAILED,
        10
      );
    });

    it('returns error if new borrow interest index calculation fails', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});

      // Support market
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});

      // Set price of OMG to 1:1
      await moneyMarketHarness.methods.harnessSetAssetPrice(OMG._address, 1, 1).send({from: root});

      // Clear out collateral ratio so user can borrow
      await moneyMarketHarness.methods.harnessSetCollateralRatio(0, 1).send({from: root});

      // We are going to borrow 1
      await moneyMarketHarness.methods.harnessSetCash(OMG._address, 100).send({from: root});

      // Set current borrow interest index to maxUint so when we multiply by it we get an overflow
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 1, 1, bigNums.maxUint, 1, 1, 1).send({from: root});

      const result = await moneyMarketHarness.methods.borrow(OMG._address, 90).send({from: customer});

      assert.hasFailure(result,
        ErrorEnum.INTEGER_OVERFLOW,
        FailureInfoEnum.BORROW_NEW_SUPPLY_INDEX_CALCULATION_FAILED
      );
    });

    it('returns error if new borrow rate calculation fails', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Set up FailingInterestModel for OMG market
      const FailableInterestRateModel = getContract("./test/InterestRateModel/FailableInterestRateModel.sol");
      const failableInterestRateModel = await FailableInterestRateModel.new(false, true).send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, failableInterestRateModel._address).send({from: root});

      // Support market
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});

      // Set price of OMG to 1:1
      await moneyMarketHarness.methods.harnessSetAssetPrice(OMG._address, 1, 1).send({from: root});

      // Clear out collateral ratio so user can borrow
      await moneyMarketHarness.methods.harnessSetCollateralRatio(0, 1).send({from: root});

      // We are going to borrow 1
      await moneyMarketHarness.methods.harnessSetCash(OMG._address, 100).send({from: root});

      const result = await moneyMarketHarness.methods.borrow(OMG._address, 90).send({from: customer});

      assert.hasFailure(result,
        ErrorEnum.OPAQUE_ERROR,
        FailureInfoEnum.BORROW_NEW_BORROW_RATE_CALCULATION_FAILED,
        20
      );
    });

    it('returns error if token transfer fails', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Transfer token (e.g. via ICO) to money market
      await OMG.methods.transfer(moneyMarketHarness._address, 100).send({gas: tokenTransferGas, from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});

      // Support market
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});

      // Set price of OMG to 1:1
      await moneyMarketHarness.methods.harnessSetAssetPrice(OMG._address, 1, 1).send({from: root});

      // Clear out collateral ratio so user can borrow
      await moneyMarketHarness.methods.harnessSetCollateralRatio(0, 1).send({from: root});

      // Set up a failure when sending
      await OMG.methods.harnessSetFailTransferToAddress(customer, true).send({from: root});

      const result = await moneyMarketHarness.methods.borrow(OMG._address, 90).send({from: customer});

      assert.hasFailure(result,
        ErrorEnum.TOKEN_TRANSFER_OUT_FAILED,
        FailureInfoEnum.BORROW_TRANSFER_OUT_FAILED
      );
    });

    it('raises if non-standard token transfer fails', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20NonStandardThrow.new(100, "test omg ns", 18, "omg").send({from: root});

      // Transfer token (e.g. via ICO) to money market
      await OMG.methods.transfer(moneyMarketHarness._address, 100).send({gas: tokenTransferGas, from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});

      // Support market
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});

      // Set price of OMG to 1:1
      await moneyMarketHarness.methods.harnessSetAssetPrice(OMG._address, 1, 1).send({from: root});

      // Clear out collateral ratio so user can borrow
      await moneyMarketHarness.methods.harnessSetCollateralRatio(0, 1).send({from: root});

      // Set up a failure when sending
      await OMG.methods.harnessSetFailTransferToAddress(customer, true).send({from: root});

      await assert.revert(moneyMarketHarness.methods.borrow(OMG._address, 90).send({from: customer}));
    });

    it('emits borrow taken event on success', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Transfer token (e.g. via ICO) to money market
      await OMG.methods.transfer(moneyMarketHarness._address, 100).send({gas: tokenTransferGas, from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});

      // Support market
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});

      // Set price of OMG to 1:1
      await moneyMarketHarness.methods.harnessSetAssetPrice(OMG._address, 1, 1).send({from: root});

      // Clear out collateral ratio so user can borrow
      await moneyMarketHarness.methods.harnessSetCollateralRatio(0, 1).send({from: root});

      // Add market details
      const initialInterestIndex = 1;
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 0, 0, initialInterestIndex, 0, 0, initialInterestIndex).send({from: root});

      const result = await moneyMarketHarness.methods.borrow(OMG._address, 90).send({from: customer});

      assert.hasLog(result,
        "BorrowTaken",
        {
          account: checksum(customer),
          asset: OMG._address,
          amount: '90',
          startingBalance: '0',
          newBalance: '90',
        }
      );

      const customerTokenBalance = await OMG.methods.balanceOf(customer).call();
      assert.equal(90, customerTokenBalance);

      const customerCompoundBalance = await moneyMarketHarness.methods.borrowBalances(customer, OMG._address).call();
      assert.equal(90, customerCompoundBalance.principal);
      assert.equal(initialInterestIndex, customerCompoundBalance.interestIndex);
    });

    it('fails borrow with zero oracle price', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Transfer token (e.g. via ICO) to money market
      await OMG.methods.transfer(moneyMarketHarness._address, 100).send({gas: tokenTransferGas, from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});

      // Support market
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});

      // Set price of OMG to 1:1
      await moneyMarketHarness.methods.harnessSetAssetPrice(OMG._address, 1, 1).send({from: root});

      // Clear out collateral ratio so user can borrow
      await moneyMarketHarness.methods.harnessSetCollateralRatio(0, 1).send({from: root});

      // Add market details
      const initialInterestIndex = 1;
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 0, 0, initialInterestIndex, 0, 0, initialInterestIndex).send({from: root});

      // Set price of OMG to 0
      await moneyMarketHarness.methods.harnessSetAssetPriceMantissa(OMG._address, 0).send({from: root});

      const result = await moneyMarketHarness.methods.borrow(OMG._address, 90).send({from: customer});
      assert.hasLog(result,
        "Failure",
        {
          error: ErrorEnum.MISSING_ASSET_PRICE.toString(),
          info: FailureInfoEnum.BORROW_AMOUNT_VALUE_CALCULATION_FAILED.toString(),
          detail: '0'
        }
      );

      const customerTokenBalance = await OMG.methods.balanceOf(customer).call();
      assert.equal(0, customerTokenBalance);

      const customerCompoundBalance = await moneyMarketHarness.methods.borrowBalances(customer, OMG._address).call();
      assert.equal(0, customerCompoundBalance.principal);
    });

    it('emits borrow taken event on non-standard token success', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20NonStandardThrow.new(100, "test omg ns", 18, "omg").send({from: root});

      // Transfer token (e.g. via ICO) to money market
      await OMG.methods.transfer(moneyMarketHarness._address, 100).send({gas: tokenTransferGas, from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});

      // Support market
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});

      // Set price of OMG to 1:1
      await moneyMarketHarness.methods.harnessSetAssetPrice(OMG._address, 1, 1).send({from: root});

      // Clear out collateral ratio so user can borrow
      await moneyMarketHarness.methods.harnessSetCollateralRatio(0, 1).send({from: root});

      // Add market details
      const initialInterestIndex = 1;
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 0, 0, initialInterestIndex, 0, 0, initialInterestIndex).send({from: root});

      const result = await moneyMarketHarness.methods.borrow(OMG._address, 90).send({from: customer});

      assert.hasLog(result,
        "BorrowTaken",
        {
          account: checksum(customer),
          asset: OMG._address,
          amount: '90',
          startingBalance: '0',
          newBalance: '90',
        }
      );

      const customerTokenBalance = await OMG.methods.balanceOf(customer).call();
      assert.equal(90, customerTokenBalance);

      const customerCompoundBalance = await moneyMarketHarness.methods.borrowBalances(customer, OMG._address).call();
      assert.equal(90, customerCompoundBalance.principal);
      assert.equal(initialInterestIndex, customerCompoundBalance.interestIndex);
    });

    it('loves @gas', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Transfer token (e.g. via ICO) to money market
      await OMG.methods.transfer(moneyMarketHarness._address, 100).send({gas: tokenTransferGas, from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});

      // Support market
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});

      // Set price of OMG to 1:1
      await moneyMarketHarness.methods.harnessSetAssetPrice(OMG._address, 1, 1).send({from: root});

      // Clear out collateral ratio so user can borrow
      await moneyMarketHarness.methods.harnessSetCollateralRatio(0, 1).send({from: root});

      // Add market details
      const initialInterestIndex = 1;
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 0, 0, initialInterestIndex, 0, 0, initialInterestIndex).send({from: root});

      // Warm the pot
      await moneyMarketHarness.methods.borrow(OMG._address, 1).send({from: customer});

      const result = await moneyMarketHarness.methods.borrow(OMG._address, 90).send({from: customer});

      assert.hasLog(result,
        "BorrowTaken",
        {
          account: checksum(customer),
          asset: OMG._address,
          amount: '90'
        }
      );

      assert.withinGas(result, 104e3, 5000, "should be about 104K gas", true);
    });

    it('allows you to borrow zero with zero assets', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});

      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});

      // Transfer token (e.g. via ICO) to money market
      await OMG.methods.transfer(moneyMarketHarness._address, 100).send({gas: tokenTransferGas, from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});

      // Support market
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});

      // Set price of OMG to 1:1
      await moneyMarketHarness.methods.harnessSetAssetPrice(OMG._address, 1, 1).send({from: root});

      // Make the collateral ratio real
      await moneyMarketHarness.methods.harnessSetCollateralRatio(2, 1).send({from: root});

      // Add market details
      const initialInterestIndex = 1;
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 0, 0, initialInterestIndex, 0, 0, initialInterestIndex).send({from: root});

      const result = await moneyMarketHarness.methods.borrow(OMG._address, 0).send({from: customer});

      assert.hasLog(result,
        "BorrowTaken",
        {
          account: checksum(customer),
          asset: OMG._address,
          amount: '0',
          startingBalance: '0',
          newBalance: '0',
        }
      );

      const customerTokenBalance = await OMG.methods.balanceOf(customer).call();
      assert.equal(0, customerTokenBalance);

      const customerCompoundBalance = await moneyMarketHarness.methods.borrowBalances(customer, OMG._address).call();
      assert.equal(0, customerCompoundBalance.principal);
      assert.equal(initialInterestIndex, customerCompoundBalance.interestIndex);
    });

    it('succeeds, fails and succeeds', async () => {
      const moneyMarketHarness = await MoneyMarketHarness.new().send({from: root});
      const customer = accounts[1];
      const OMG = await EIP20.new(100, "test omg", 18, "omg").send({from: root});
      const DRGN = await EIP20.new(100, "test drgn", 18, "drgn").send({from: root});

      // Transfer token (e.g. via ICO) to money market
      await OMG.methods.transfer(moneyMarketHarness._address, 100).send({gas: tokenTransferGas, from: root});

      // Set up SimpleInterestRateModel for OMG market
      const simpleInterestRateModel = await SimpleInterestRateModel.new().send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketInterestRateModel(OMG._address, simpleInterestRateModel._address).send({from: root});

      // Support market
      await moneyMarketHarness.methods.harnessSupportMarket(OMG._address).send({from: root});

      // Add collateral market for drgn to get shortfall
      await moneyMarketHarness.methods.harnessAddCollateralMarket(DRGN._address).send({from: root});

      // Set origination fee to 0%
      await moneyMarketHarness.methods._setOriginationFee(getExpMantissa(0)).send({from: root});

      // Set price of OMG to 1:1
      await moneyMarketHarness.methods.harnessSetAssetPrice(OMG._address, 1, 1).send({from: root});

      // Set price of DRGN to 1:1
      await moneyMarketHarness.methods.harnessSetAssetPrice(DRGN._address, 1, 1).send({from: root});

      // Set a required collateral ratio of 2:1
      await moneyMarketHarness.methods.harnessSetCollateralRatio(2, 1).send({from: root});

      // Supply some drgn
      await moneyMarketHarness.methods.harnessSetAccountSupplyBalance(customer, DRGN._address, 10, 1).send({from: root});

      // Set market details
      const initialInterestIndex = 1000;
      await moneyMarketHarness.methods.harnessSetMarketDetails(DRGN._address, 0, 0, 1, 0, 0, 1).send({from: root});
      await moneyMarketHarness.methods.harnessSetMarketDetails(OMG._address, 0, 0, initialInterestIndex, 0, 0, initialInterestIndex).send({from: root});

      // Try to borrow successfully
      const result0 = await moneyMarketHarness.methods.borrow(OMG._address, 5).send({from: customer});

      assert.hasLog(result0,
        "BorrowTaken",
        {
          account: checksum(customer),
          asset: OMG._address,
          amount: '5',
          startingBalance: '0',
          newBalance: '5',
        }
      );

      const customerTokenBalance0 = await OMG.methods.balanceOf(customer).call();
      assert.equal(5, customerTokenBalance0);

      const customerCompoundBalance0 = await moneyMarketHarness.methods.borrowBalances(customer, OMG._address).call();
      assert.equal(5, customerCompoundBalance0.principal);
      assert.equal(initialInterestIndex, customerCompoundBalance0.interestIndex);

      // Try to borrow too much more and fail
      const result1 = await moneyMarketHarness.methods.borrow(OMG._address, 15).send({from: customer});

      assert.hasFailure(result1,
        ErrorEnum.INSUFFICIENT_LIQUIDITY,
        FailureInfoEnum.BORROW_AMOUNT_LIQUIDITY_SHORTFALL
      );

      const customerTokenBalance1 = await OMG.methods.balanceOf(customer).call();
      assert.equal(5, customerTokenBalance1);

      const customerCompoundBalance1 = await moneyMarketHarness.methods.borrowBalances(customer, OMG._address).call();
      assert.equal(5, customerCompoundBalance1.principal);
      assert.equal(initialInterestIndex, customerCompoundBalance1.interestIndex);

      // Try to borrow successfully again
      const result2 = await moneyMarketHarness.methods.borrow(OMG._address, 3).send({from: customer});

      assert.hasLog(result2,
        "BorrowTaken",
        {
          account: checksum(customer),
          asset: OMG._address,
          amount: '3',
          startingBalance: '5',
          newBalance: '13', // due to interest, this has increased (2 blocks at 50% per block)
        }
      );

      const customerTokenBalance2 = await OMG.methods.balanceOf(customer).call();
      assert.equal(8, customerTokenBalance2);

      const customerCompoundBalance2 = await moneyMarketHarness.methods.borrowBalances(customer, OMG._address).call();
      assert.equal(13, customerCompoundBalance2.principal);
      assert.equal(2 * initialInterestIndex, customerCompoundBalance2.interestIndex);
    });
  });
});