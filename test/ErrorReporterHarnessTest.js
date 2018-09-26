"use strict";

const {getContract} = require('./Contract');
const {ErrorEnum, FailureInfoEnum} = require('./ErrorReporter');
const ErrorReporterHarness = getContract("./test/ErrorReporterHarness.sol");

contract('ErrorReporterHarness', function([root, ...accounts]) {
  it("emits a failure", async () => {
    const errorReporterHarness = await ErrorReporterHarness.new().send({from: root});
    const result = await errorReporterHarness.methods.harnessPleaseFail().send({from: root});

    assert.hasLog(result,
      "Failure",
      {
        error: ErrorEnum.INTEGER_OVERFLOW.toString(),
        info: FailureInfoEnum.SUPPLY_TRANSFER_IN_FAILED.toString(),
        detail: '0'
      }
    );
  });

  it("emits an opaque failure", async() => {
    const errorReporterHarness = await ErrorReporterHarness.new().send({from: root});

    const opaqueFailure = 75;
    const result = await errorReporterHarness.methods.harnessPleaseFailOpaque(opaqueFailure).send({from: root});

    assert.hasLog(result,
      "Failure",
      {
        error: ErrorEnum.OPAQUE_ERROR.toString(),
        info: FailureInfoEnum.SUPPLY_NEW_SUPPLY_RATE_CALCULATION_FAILED.toString(), // as used by `pleaseFailOpaque`
        detail: opaqueFailure.toString()
      }
    );
  });
});
