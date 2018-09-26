"use strict";

const {getContract} = require('./Contract');
const StandardInterestRateModel = getContract("./StandardInterestRateModel.sol");
const BigNumber = require('bignumber.js');

const blocksPerYear = 2102400;

function utilizationRate(cash, borrows) {
  if (borrows.eq(0)) {
    return 0;
  }

  return Number(borrows.div(cash.plus(borrows)));
}

function calculateBorrowRate(cash, borrows) {
  const ua = utilizationRate(new BigNumber(cash), new BigNumber(borrows));

  return ( 0.05 + (0.45 * ua) ) / blocksPerYear;
};

function calculateSupplyRate(cash, borrows) {
  const ua = utilizationRate(new BigNumber(cash), new BigNumber(borrows));
  const borrowRate = calculateBorrowRate(cash, borrows);

  return (1 - 0.1) * ua * borrowRate;
}

contract('StandardInterestRateModel', ([root, ...accounts]) => {
  describe('#getSupplyRate/#getBorrowRate', async () => {
    let standardInterestRateModel;

    before(async () => {
      // Deploy once since we're only calling pure functions
      standardInterestRateModel = await StandardInterestRateModel.new().send({from: root});
    });

    // We'll generate a large number of tests to verify approximate accuracy
    [
      // Description of tests arrays:
      // [cash, borrows, <optional: percentage diff allowed>]
      [500, 100],
      [3e18, 5e18],
      [5e18, 3e18],
      [500, 3e18],
      [0, 500],
      [500, 0],
      [0, 0],
      [3e18, 500, 1e-10],
      ["1000.00000000e18", "310.00000000e18"],
      ["690.00000000e18", "310.00000000e18"]
    ].forEach(([cash, borrows, absolute]) => {
      it(`calculates correct supply value for ${cash}/${borrows}`, async () => {
        const expected = calculateSupplyRate(cash, borrows);
        const {'0': errorCode, '1': value} = await standardInterestRateModel.methods.getSupplyRate(0, new BigNumber(cash), new BigNumber(borrows)).call();

        assert.equal(0, Number(errorCode), "should return success");

        if (absolute) {
          assert.closeTo(expected, Number(value), absolute);
        } else {
          assert.withinPercentage(expected, Number(value) / 1e18, 1e-8);
        }
      });

      it(`calculates correct borrow value for ${cash}/${borrows}`, async () => {
        const expected = calculateBorrowRate(cash, borrows);
        const {'0': errorCode, '1': value} = await standardInterestRateModel.methods.getBorrowRate(0, new BigNumber(cash), new BigNumber(borrows)).call();

        assert.equal(0, Number(errorCode), "should return success");
        assert.withinPercentage(expected, Number(value) / 1e18, 1e-8);
      });
    })
  });
});
