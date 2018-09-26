"use strict";

const Immutable = require('seamless-immutable');
const {deploy, deployNew, load, save} = require('./deployUtils');

const MoneyMarket = artifacts.require("./MoneyMarket.sol");
const StandardInterestRateModel = artifacts.require("./StandardInterestRateModel.sol");


const network = process.env["NETWORK"];

if (!network) {
	throw "NETWORK env var must be set";
}

// Please note that a market must have a price set before it can be marked as supported. Use setTokenPrices.js for that.
async function supportMarkets() {
	const config = load(network);

	const tokens = Immutable.getIn(config, ["Tokens"]);
	if (!tokens) {
		throw `No tokens for network: ${network}`;
	}

	const moneyMarketAddress = Immutable.getIn(config, ["Contracts", "MoneyMarket"]);
	if (!moneyMarketAddress) {
		throw `No MoneyMarket address stored for network: ${network}`;
	}

	const moneyMarket = MoneyMarket.at(moneyMarketAddress);

	let interestRateModelAddress = Immutable.getIn(config, ["Contracts", "StandardInterestRateModel"]);
	if (!interestRateModelAddress) {
		const interestRateModel = await deployNew(network, StandardInterestRateModel, [], true, true, "", "StandardInterestRateModel");
		interestRateModelAddress = interestRateModel.address;
	}

	for (let token of Object.values(tokens)) {
		if (!token.supported) {

			console.log(`Supporting market: ${token.name}...`);
			const result = await moneyMarket._supportMarket(token.address, interestRateModelAddress);
			const error = result.logs.find((log) => log.event == "Failure");
			const log = result.logs.find((log) => log.event == "SupportedMarket");

			if (error) {
				throw `ErrorReporter Failure: Error=${error.args.error} Info=${error.args.info} Detail=${error.args.detail}`;
			}

			if (!log) {
				throw `Could not find log "SupportedMarket" in result logs [${result.logs.map((log) => log.event).join(',')}]`
			}

			save(network, ["Tokens", token.symbol, "supported"], true);

			console.log(`Supported market ${token.name} successfully.`);
		}
	}
};

module.exports = supportMarkets;