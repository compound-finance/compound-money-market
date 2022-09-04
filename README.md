[![CircleCI](https://circleci.com/gh/compound-finance/compound-money-market.svg?style=svg)](https://circleci.com/gh/compound-finance/compound-money-market)

Compound Money Market
=====================

The Compound Money Market holds all of the contracts used to implement the Compound protocol. Through the money market contract, users of the blockchain *supply* capital (Ether or ERC-20 tokens) to earn interest, or *borrow* capital by holding collateral in the contract. The money market contract tracks each of these balances, a balance sheet and automatically sets interest rates.

Before getting started, please read:

* The [Compound Whitepaper](https://github.com/compound-finance/compound-money-market/tree/master/docs/CompoundWhitepaper.pdf), describing how Compound works
* The [Compound Protocol Specification](https://github.com/compound-finance/compound-money-market/tree/master/docs/CompoundProtocol.pdf), explaining in plain English how the protocol operates

Contracts
=========

We detail a few of the core contracts in the Compound protocol.

<dl>
  <dt>Money Market</dt>
  <dd>The Compound Money Market.</dd>
</dl>

<dl>
  <dt>Careful Math</dt>
  <dd>Library for safe math operations.</dd>
</dl>

<dl>
  <dt>ErrorReporter</dt>
  <dd>Library for tracking error codes and failure conditions.</dd>
</dl>

<dl>
  <dt>Exponential</dt>
  <dd>Library for handling fixed-point decimal numbers.</dd>
</dl>

<dl>
  <dt>InterestRateModel</dt>
  <dd>Abstract contract defining an interest rate model. Its functions are specifically not marked pure as implementations of this contract may read from storage variables.</dd>
</dl>

<dl>
  <dt>SafeToken</dt>
  <dd>Library for safely handling ERC20 interaction.</dd>
</dl>

<dl>
  <dt>StandardInterestRateModel</dt>
  <dd>Initial interest rate model, as defined in the Whitepaper.</dd>
</dl>

Installation
------------
To run compound, pull the repository from GitHub and install its dependencies. You will need [yarn](https://yarnpkg.com/lang/en/docs/install/) or [npm](https://docs.npmjs.com/cli/install) installed.

    git clone https://github.com/compound-finance/compound-money-market
    cd money-market
    yarn

You can then compile and deploy the contracts with:

    truffle compile
    truffle migrate

Testing
-------
Contract tests are defined under the [test
directory](https://github.com/compound-finance/compound-money-market/tree/master/test). To run the tests run:

    scripts/test

or with inspection (visit chrome://inspect) and look for a remote target after running:

    node --inspect node_modules/truffle-core/cli.js test

Assertions used in our tests are provided by [ChaiJS](http://chaijs.com).

Code Coverage
-------------
To run code coverage, simply run:

    scripts/coverage

Linting
-------
To lint the code, run:

    scripts/lint

Deployment
----------
To deploy the Money Market contracts run:

    truffle deploy

Docker
------

To run in docker:

    # Build the docker image
    docker build -t money-market .

    # Run a shell to the built image
    docker run -it money-market /bin/sh

From within a docker shell, you can interact locally with the protocol via ganache and truffle:

    > ganache-cli &
    > truffle deploy
    > truffle console
    truffle(development)> MoneyMarket.deployed().then((contract) => moneyMarket = contract);
    truffle(development)> moneyMarket.admin()
    '0x842e5e1a348eb91fc68219ca70db83170ccd9a5e'

Test net
--------

To deploy on test-net, run:

    RINKEBY_PRIVATE_KEY=<...> truffle deploy --network rinkeby

where the private key refers to a rinkeby private key in hex form (e.g. this can be the value exported from MetaMask under Settings).

You can choose "rinkeby", "kovan" or "ropsten" as your test net.

Additionally, for not main-net, you can put your test-net private keys in a folder and set the environment variable (e.g. in your `~/.bash_profile`):

```sh
ETHEREUM_NETWORKS_HOME=~/.ethereum
```

The project will search this directory for test-net keys, which you can add as such:

```sh
mkdir -p ~/.ethereum
# Store command via editor or:
pbpaste > ~/.ethereum/rinkeby
chmod 600 ~/.ethereum/rinkeby
```

Note: This method is not safe for production. Production keys should be kept on hardware wallets.

Development
-----------

For local development of a fully working market, you may consider running:

```bash
scripts/blockchain/deploy-mock-oracle development # deploys oracle with mock prices
scripts/blockchain/deploy development # deploys money market to local ganache
scripts/blockchain/set-oracle development # sets oracle
scripts/blockchain/deploy-tokens development # adds some fake tokens
scripts/blockchain/support-markets development # adds money market support for the tokens added above
```

To deploy a real oracle, you can have `compound-oracle` located at `$pwd/../compound-oracle` and then run:

```bash
scripts/blockchain/oracle-deploy development # deploys a price oracle
scripts/blockchain/deploy-tokens development # deploys some basic faucet tokens
scripts/blockchain/oracle-set-token-prices development # sets configured prices
```

If you wish to run with a price oracle you have deployed separately, you can run:
```bash
scripts/blockchain/set-oracle development <oracle_address>  # sets address allowed to post prices
```

Also, you can easily pull into a console for a given environment with the correct ABI and addresses:

```bash
scripts/blockchain/console development

truffle(development)> MoneyMarket.deployed().then((c) => moneyMarket = c);
truffle(development)> moneyMarket.collateralRatio().then((r) => r.toString())
'2000000000000000000'
```

Rinkeby
-------

For rinkeby development of a fully working market, you will deploy a price oracle, tokens,
configure the money market and then you're set.

Note: the examples expect you to have generated a poster key and address. The address of
the poster can be stored, e.g. in `~/.ethereum/rinkeby-poster.addr`, as detailed below.

```bash
scripts/blockchain/oracle-deploy rinkeby $(cat ~/.ethereum/rinkeby-poster.addr)
```

If you don't have test tokens on rinkeby, you can deploy them as such:

```bash
scripts/blockchain/deploy-tokens rinkeby # only run if not already tokens
```

Then, you'll either want to set default prices, and pull and post prices from exchanges (not pictured):

```bash
scripts/blockchain/oracle-set-token-prices rinkeby # alternatively, deploy a price poster
```

Finally, deploy the MoneyMarket, set the oracle, and support the markets.
```bash
scripts/blockchain/deploy rinkeby # deploys money market to rinkeby
scripts/blockchain/set-oracle rinkeby # sets oracle from previous deployment step
scripts/blockchain/support-markets rinkeby # adds money market support for the tokens added
```

Rinkeby -> Deplying New Oracle
------------------------------

The following steps should be taken to deploy a new oracle:

```bash
scripts/blockchain/oracle-deploy rinkeby $(cat ~/.ethereum/rinkeby-poster.addr)
```

Then, you'll either want to set default prices, and pull and post prices from exchanges (not pictured):

```bash
scripts/blockchain/oracle-set-token-prices rinkeby # sets default prices, esp. useful for weth
```

Once the oracle has prices set, you should then set it as the new oracle:

```bash
scripts/blockchain/set-oracle rinkeby # sets oracle from previous deployment step
```

Deploying New InterestRateModel
------------------------------

The following steps should be taken to update an interest rate model. The following example is for a Stable Coin.

### Rinkeby
```bash
scripts/blockchain/update-interest-rate rinkeby TUSD StableCoinInterestRateModel please-update-money-market
```

### Main-net
```bash
scripts/blockchain/update-interest-rate mainnet x0 StableCoinInterestRateModel
```

The new contract address will be written to the Networks config (and output as a result of the command). Use that address to call the Money Market interest rate model updates manually as an admin.

Main-net
-------

For mainnet development of a fully working market, you will deploy a price oracle and configure the money market and then you're set.

```bash
scripts/blockchain/oracle-deploy mainnet $(cat ~/.ethereum/mainnet-poster.addr)
```

Deploy a poster service with the updated oracle address and verify prices for all supported assets are set.

Finally, deploy the MoneyMarket, set the oracle, and support the markets.
```bash
scripts/blockchain/deploy mainnet # deploys money market to mainnet
scripts/blockchain/set-oracle mainnet # sets oracle from previous deployment step
scripts/blockchain/support-markets mainnet # adds money market support for the tokens added
```

Console
-------

You can easily pull into a console for a given environment with the correct ABI and addresses:

```bash
scripts/blockchain/console development

truffle(development)> MoneyMarket.deployed().then((c) => moneyMarket = c);
truffle(development)> moneyMarket.collateralRatio().then((r) => r.toString())
'2000000000000000000'
```

Discussion
----------

For any concerns with the protocol, open an issue or visit us on [Discord](https://compound.finance/discord) to discuss.

For security concerns, please email [security@compound.finance](mailto:security@compound.finance).

_© Copyright 2018, Compound Labs_
