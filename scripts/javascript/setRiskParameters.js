"use strict";

const BigNumber = require('bignumber.js');
const Immutable = require('seamless-immutable');
const {load, save} = require('./deployUtils');

const MoneyMarket = artifacts.require("./MoneyMarket.sol");

const network = process.env["NETWORK"];

if (!network) {
	throw "NETWORK env var must be set";
}

// Returns the mantissa of an Exp with given floating value
function getExpMantissa(float) {
  return Math.floor(float * 1.0e18);
}

// Returns the given environment variable coerced to a float value.
// if the environment value does not exist or is NaN then returns undefined.
function coerceEnvVarToFloat(env_string) {
	if (process.env[env_string]) {
		const collateralRatioAsNumber = Number(process.env[env_string]);
		if (isNaN(collateralRatioAsNumber)) {
			throw `${env_string} env var is not a number`;
		}
		
		return collateralRatioAsNumber;
	}
	return undefined;
}

async function setRiskParameters() {
	const config = load(network);

	const moneyMarketAddress = Immutable.getIn(config, ["Contracts", "MoneyMarket"]);
	if (!moneyMarketAddress) {
		throw `No MoneyMarket address stored for network: ${network}`;
	}

	const moneyMarket = MoneyMarket.at(moneyMarketAddress);

	var collateralRatio = coerceEnvVarToFloat("COLLATERAL_RATIO") || Immutable.getIn(config, ["RiskParameters", "CollateralRatio"]);
	if (!collateralRatio) {
		collateralRatio = 2.0;
		console.log(`No collateral ratio found for network: ${network}
			Using default collateralRatio: ${collateralRatio}
			`);
	}

	var liquidationDiscount = coerceEnvVarToFloat("LIQUIDATION_DISCOUNT") || Immutable.getIn(config, ["RiskParameters", "LiquidationDiscount"]);
	if (!liquidationDiscount) {
		liquidationDiscount = 0.0;
		console.log(`No liquidation discount found for network: ${network}
			Using default liquidationDiscount: ${liquidationDiscount}
			`);
	}

	const newCollateralRatioMantissa = new BigNumber(getExpMantissa(collateralRatio));
	const newLiquidationDiscountMantissa = new BigNumber(getExpMantissa(liquidationDiscount));

	console.log(`Setting Risk Parameters: ${newCollateralRatioMantissa.toString()}, ${newLiquidationDiscountMantissa.toString()} ...`);
	const result = await moneyMarket._setRiskParameters(newCollateralRatioMantissa.toString(), newLiquidationDiscountMantissa.toString());

	const error = result.logs.find((log) => log.event == "Failure");
	const log = result.logs.find((log) => log.event == "NewRiskParameters");

	if (error) {
		throw `ErrorReporter Failure: Error=${error.args.error} Info=${error.args.info} Detail=${error.args.detail}`;
	}

	if (!log) {
		throw `Could not find log "NewRiskParameters" in result logs [${result.logs.map((log) => log.event).join(',')}]`
	}

	save(network, ["RiskParameters", "CollateralRatio"], collateralRatio);
	save(network, ["RiskParameters", "LiquidationDiscount"], liquidationDiscount);

	console.log(`Set RiskParameters: ${newCollateralRatioMantissa.toString()}, ${newLiquidationDiscountMantissa.toString()} successfully.`);
};

module.exports = setRiskParameters;