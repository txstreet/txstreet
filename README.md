# TxStreet Frontend

#### This code has not had a major update for several years. It is going open source now so that other can develop their own new version of a TxStreet frontend.

#### If you have any questions, please ask on Discord for a quick response: https://discord.gg/pFeHv623D7

---

# Summary

TxStreet is a live transaction and mempool visualizer featuring Bitcoin, Ethereum, Bitcoin Cash, Monero and Litecoin. When a new transaction is broadcasted to a cryptocurrency network, a person appears and attempts to board a bus in real time. If the transaction has a high enough fee, they will board the first bus and be ready to be included in the next mined block. If there are too many transactions to be included in the next block, and the transaction didn't pay a high enough fee, the person will either wait in line or board a different bus. The movement speed of a person represents how high of a fee they paid compared to the current median fee. The size of a person represents the size of the transaction in bytes or gas.

The frontend is built with Vue, Bulma and Phaser 3. It connects to TxStreet backends using websockets (socket.io) and REST APIs.


---

# Running Locally

-   Install NodeJS (tested with v16.5)
-   Install Yarn (`npm install -g yarn`)
-   Install Git

-   Clone this repo `git clone https://github.com/txstreet/txstreet.git`
-   Copy the contents of `.env.example` to a new file named `.env`
-   Run the command `yarn`
-   Run the command `yarn run build`
-   For a live dev server run the command `yarn run serve`

---

# Important Files

-   `src/components/street.js` is the main class that most coins inherit from to create a Phaser scene. It has most of the logic for creating game objects, updating the scene, and most of the blockchain logic. Arbitrum uses `mall.js` instead.
-   `src/components/street-controller.js` is the parent scene that manages all of the street scenes.
-   `src/components/config.js` is the main config file for all of the coins added to TxStreet. Static variables for each coin can be found here, and the logic for each coin is in the `src/components/streets` directory.
-   `src/components/game-objects/person.js` is the class for the Person game object, which has a lot of the logic for creating "move lists", which are instructions for a person to move depending on the status of the transaction.
-   `src/components/game-objects/bus.js` is the class for the Bus game object, which has the logic for drawing the buses, the people and NFTs inside the buses, and moving the buses.
-   `src/components/vue` is the directory that has all of the Vue components, and everything related to the UI. The `Main.vue` file is the root component for the application and controls routing.

---

# Connecting to the Backend

If you would like to run and/or develop your own backend, please ask on Discord for access to the backend repository, since it is not open source yet. You will need to run your own blockchain nodes, a mongodb cluster, redis, and nodejs processes all on the same subnet. Eventually, this project will be run 100% by third party backends.

# REST API

The official TxStreet REST API is currently hosted at `https://do-api.txstreet.com`

Supported ticker variables - `BTC`,`ETH`,`BCH`,`XMR`,`LTC`

## Block

**GET** `/static/blocks/{ticker}/{blockHash}?verbose={true|false}`

Returns a block by the block hash. Only recent blocks are serviceable to support the visualization. Verbose is set to true by default. If true, the `txFull` object is omitted from the response.

**GET** `/api/v2/blockchain/addresses/{ticker}/{blockHeight}`

Returns a block by the block height. Only recent blocks are serviceable to support the visualization.

## Pending Transaction List

**GET** `/static/live/pendingTxs-{ticker}`

Returns a list of 3000 current pending transactions, sorted descending by the fee rate and taking into account the nonce (if applicable). Updates every few seconds.

## Trending Contracts

**GET** `/static/live/trending-contracts-ETH-{5min|1hour|1day}`

Returns an array of trending contracts on Ethereum, based on the number of transactions within a time period. Options for the time period are 5 minutes, 1 hour and 1 day.

## Houses

**GET** `/static/live/houses-{ticker}`

Get a list of houses for this ticker that are supported by the backend. The frontend uses this call to build the houses before loading any transactions.

## Address

**GET** `/api/v2/blockchain/addresses/{ticker}/{address}`

Returns a list of pending and recently confirmed transactions for an address.

## Transaction

**GET** `/api/v2/blockchain/addresses/{ticker}/{txid}`

Returns a pending or recently confirmed transaction from a transaction hash.

# Websocket API

The official TxStreet Websocket API is currently hosted at `https://do-websocket.txstreet.com`

Supported ticker variables - `BTC`,`ETH`,`BCH`,`XMR`,`LTC`

To see how the frontend connects using socket.io see the `getSocket` function in `src/components/utils/index.js`

The `joinRoom` function is used to join rooms and subscribe to events, and the `joinStatRoom` function is used to fetch statistics and subscribe to updates for that statistic.

## Joining a Room

`["join-room","ETH-transactions"]` is an example of a message you can send to join a room and subscribe to new pending Ethereum transactions.

`{ticker}-transactions` subscribes to new pending transactions for the provided ticker. Events are emitted as `['tx', transactionObject]`.

`{ticker}-blocks` subscribes to new confirmed block hashes for the provided ticker. Events are emitted as `['block', blockHash]`. You can then use this hash to fetch the block data from the REST API.

## Leaving a Room

You can leave a room the same way you join it. For example, to leave the Ethereum transactions room send the following message `["leave-room","ETH-transactions"]` and you will stop receiving events.

To stop receiving updates for statistics, the message would be formatted like so `["leave-room","{ticker}-stat-{statKey}"]`. An example would be `["leave-room","ETH-stat-tps"]`.

## Fetching a Statistic

The TxStreet backend keeps track of the following statistics in real time. Other stats are calculated in the frontend.

| Key                   | Description                                                                                                                                                                                                                                                                                                                                                                                                               | Supported Tickers   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| tps                   | The number of new and unique transactions broadcasted within the last 5 minutes. This number is then divided by 300 to reach an average 'per second' result.                                                                                                                                                                                                                                                              | BTC,ETH,BCH,XMR,LTC |
| ctps                  | The rate of confirmed transactions per second over the past hour. If there was no confirmed block in the past hour, the timespan is increased past one hour to the last block's timestamp.                                                                                                                                                                                                                                | BTC,ETH,BCH,XMR,LTC |
| baseFee               | The current base fee.                                                                                                                                                                                                                                                                                                                                                                                                     | ETH                 |
| mempool-size          | The current number of pending transactions.                                                                                                                                                                                                                                                                                                                                                                               | BTC,ETH,BCH,XMR,LTC |
| mempool-bytes         | The total size in bytes of the pending transactions in the mempool.                                                                                                                                                                                                                                                                                                                                                       | BTC,BCH,XMR,LTC     |
| medianFee-usd         | The median fee in USD from new and unique transactions broadcasted within the last 5 minutes. **For EVM Chains:** Only including txs with gasLimit greater than 21000. Since Ethereum gas fees are not exact until after the transaction is confirmed, this gas is first divided by 'Median Tx Gas Used/Limit' for transactions with a gasLimit greater than 42000. This is why this number is an estimate and not exact. | BTC,ETH,BCH,XMR,LTC |
| medianFee-usdTransfer | The median fee (in USD) from new and unique transactions broadcasted within the last 5 minutes with a gasLimit equal to 21000.                                                                                                                                                                                                                                                                                            | ETH                 |
| medianFee-satPerByte  | The median fee in Satoshis per Byte (vByte for BTC) from new and unique transactions broadcasted within the last 5 minutes.                                                                                                                                                                                                                                                                                               | BTC,BCH             |
| medianFee-litPerByte  | The median fee in Litoshis per Byte from new and unique transactions broadcasted within the last 5 minutes.                                                                                                                                                                                                                                                                                                               | LTC                 |
| medianFee-fee         | The median fee in XMR from new and unique transactions broadcasted within the last 5 minutes.                                                                                                                                                                                                                                                                                                                             | XMR                 |
| medianFee-aByte       | The median fee in Nanoneros per Byte from new and unique transactions broadcasted within the last 5 minutes. A Nanonero is 0.000000001 XMR.                                                                                                                                                                                                                                                                               | XMR                 |
| medianFee-gasPrice    | The median gasPrice from new and unique transactions broadcasted within the last 5 minutes.                                                                                                                                                                                                                                                                                                                               | ETH                 |
| supply-circulating    | The current circulating supply.                                                                                                                                                                                                                                                                                                                                                                                           | BTC,ETH,BCH,XMR,LTC |
| supply-total          | The current total supply.                                                                                                                                                                                                                                                                                                                                                                                                 | BTC,ETH,BCH,LTC     |
| fiatPrice-usd         | The current price in USD.                                                                                                                                                                                                                                                                                                                                                                                                 | BTC,ETH,BCH,XMR,LTC |
| marketCap-usd         | The current market cap in USD.                                                                                                                                                                                                                                                                                                                                                                                            | BTC,ETH,BCH,XMR,LTC |
| medianTxsPerBlock     | The median number of transactions included in each block over the last hour.                                                                                                                                                                                                                                                                                                                                              | BTC,ETH,BCH,XMR,LTC |
| difficulty            | The current mining difficulty.                                                                                                                                                                                                                                                                                                                                                                                            | BTC,BCH,XMR,LTC     |
| gasLimit              | The current gas limit for blocks.                                                                                                                                                                                                                                                                                                                                                                                         | ETH                 |
| gasTarget             | The current gas target for blocks.                                                                                                                                                                                                                                                                                                                                                                                        | ETH                 |
| medianGasUsed         | The median gas used by a block (sum of the gas used by all transactions in that block) over the last hour.                                                                                                                                                                                                                                                                                                                | ETH                 |
| medianBlockSize       | the median data used by a block (in bytes) over the last hour.                                                                                                                                                                                                                                                                                                                                                            | BTC,ETH,BCH,XMR,LTC |
| gasUsedDif            | Median transaction gas used/limit. First, the average (gasUsed / gas) of each transaction greater than 21000 gas in a recently mined block is obtained. This average is appended to a list of averages (no more than 500 in length), from which the final median result is reached.                                                                                                                                       | ETH                 |
| medianBlockTime       | The _average_ time between mined blocks over the last 250 blocks.                                                                                                                                                                                                                                                                                                                                                         | BTC,ETH,BCH,XMR,LTC |
| volume-usd            | The 24 hour trading volume across all coingecko tracked exchanges in USD                                                                                                                                                                                                                                                                                                                                                  | BTC,ETH,BCH,XMR,LTC |
| volume-btc            | The 24 hour trading volume across all coingecko tracked exchanges in BTC                                                                                                                                                                                                                                                                                                                                                  | BTC,ETH,BCH,XMR,LTC |
| blockHeight           | The block height of the last mined block.                                                                                                                                                                                                                                                                                                                                                                                 | BTC,ETH,BCH,XMR,LTC |
| blockchainSize        | The current blockchain size in Megabytes.                                                                                                                                                                                                                                                                                                                                                                                 | BTC,LTC,XMR         |
| blockSizeLimit        | The current value of the dynamic block size limit in bytes.                                                                                                                                                                                                                                                                                                                                                               | XMR                 |
| blockGasEstimates     | A JSON array of gas estimates for the next 3 blocks. There is no history for this stat.                                                                                                                                                                                                                                                                                                                                   | ETH                 |

An example of a message to fetch a stat, return the current value and subscribe to new events would be:

```json
[
	"fetch-stat",
	"ETH", //ticker
	null, //identifier
	{
		"key": "tps", //stat key
		"history": false,
		"subscribe": true,
		"returnValue": true
	}
]
```

This would return the current value for Ethereum transactions per second and subscribe to future updates. The returned message and updates would look like:

```json
["stat-updates", "ETH", "tps", 10.35]
```

### Fetching History

There is also the option to return history for most statistics. An example message would be:

```json
[
	"fetch-stat",
	"ETH", //ticker
	"ETH-stat-history-baseFee", //custom identifier
	{
		"key": "baseFee", //stat key
		"history": true, //fetch history
		"historyDuration": "2d", //return the last 2 days of history
		"historyInterval": "5m", //the stat values will have 5 minute intervals
		"subscribe": false, //don't subscribe to events
		"returnValue": false //don't return the current value
	}
]
```

The returned message would look like:

```json
[
   "fetch-stat",
   "ETH-stat-history-baseFee",
   null,
   {
      "history":[
         {
            "value":24577025109.40936,
            "time":1690654503
         },
         ...
      ]
   }
]
```

The options for history are:

| Key             | Type    | Description                                                                                                                                                                      |
| --------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| history         | boolean | Should this request return historical data?                                                                                                                                      |
| historyInterval | string  | The interval to return history data in milliseconds, or use format... (30s, 30m, 30h, 30d, 30w). Supplying '5s' here means we want the stat values in 5 second intervals.        |
| historyDuration | string  | The maximum duration of history to return in milliseconds, or use format... (30s, 30m, 30h, 30d, 30w). Supplying '15m' here means to return the last 15 minutes of stat updates. |

## Recent House Transactions

Sending `['get-recent-house-txs', '{ticker}']` will return the 5 most recent transactions for each house.

It will be returned as `['get-recent-house-txs', null, null, transactionsArray]`.

---

# Static Files Server

Important static files that aren't in this repository are loaded from `https://storage.txstreet.com/`.

Example of house description:
https://storage.txstreet.com/info/wiki/ETH/usdc.json

Example of stat descriptions:
https://storage.txstreet.com/info/wiki/common/stats/tps.json
https://storage.txstreet.com/info/wiki/ETH/stats/medianContractFee.json

Example of NFT image:
https://storage.txstreet.com/cryptopunks/5814.png

Example of complete NFT collection
https://storage.txstreet.com/cryptopunks.zip

---

# Sprites and Assets

The sprite sheets are built using Texture Packer.
https://www.codeandweb.com/texturepacker

The .tps files in the `texture-packer` directory can be opened in Texture Packer and edited. Click "Publish Sprite Sheet" at the top to publish your sprite sheet to a .png and .json file in `/public/static/img`.

---

# Adding a House

House data is loaded from the backend and transactions are modified to include house data on the backend before being sent to the frontend. If you want to add a house, you would need access to the backend, and then add the house logo to the sheet.tps file in this repository. You can request access to the backend repo on Discord.

---

# Adding a New Blockchain

You can create your own backend for a specific blockchain, fork the frontend and create a PR with your coin added and connecting to your hosted backend. You can also consider hosting your own version of the frontend instead of creating a PR.

---

# Credits

Created by https://x.com/tomxeth

If you are going to host a version of this publicly, please keep a link back to TxStreet.com visible on the site.

---

# License

The MIT License (MIT)

Copyright (c) 2023 TxStreet.com

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
