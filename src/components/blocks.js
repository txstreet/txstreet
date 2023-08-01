import { enabledConfig } from "./config";
import { joinRoom, loadBlock } from "./utils/";
import EventEmitter from "events";

class blockFactory extends EventEmitter {
	constructor(ticker) {
		super();
		this.connected = false;
		this.config = enabledConfig[ticker];
		this.blockchain = this.config.liveBlocks;
		this.blocksWaiting = {};
	}

	connect() {
		this.socket = joinRoom(this.config, "blocks");
		if (this.connected) {
			this.emit("connected");
			return;
		}
		this.connected = true;
		this.socket.once("latestblocks", async hashes => {
			if (hashes.length) {
				let blocks = hashes;
				if (typeof hashes[0] === "string") {
					let tasks = [];
					hashes.forEach(hash => {
						tasks.push(fetch(`${process.env.VUE_APP_REST_API}/static/blocks/${this.config.ticker}/${hash}?verbose=false`));
					});
					let responses;
					try {
						responses = await Promise.all(tasks);
					} catch (err) {
						console.log(err);
						this.emit("error", err);
						return;
					}
					blocks = await Promise.all(responses.map(async res => res.json()));
				}

				blocks.sort((a, b) => b.height - a.height);

				for (let i = blocks.length - 1; i >= 0; i--) {
					let block = blocks[i];
					this.addBlock(block, false, true, true);
				}
			}
			this.emit("connected");
		});

		this.socket.on("block", async (hash) => {
			if (typeof hash === "string") {
				this.getBlock(hash);
			}
			else {
				this.addBlock(hash);
			}
		});
	}

	checkMissingBlocks() {
		if (!this.blockchain.length) return;
		let heights = Object.keys(this.blocksWaiting);
		if (!heights.length) return;
		heights.sort(function (a, b) {
			return a - b;
		});
		let blocksByHeight = this.blocksByHeight();

		for (let i = 0; i < heights.length; i++) {
			const height = heights[i];
			let [data, sendNotification, processed] = this.blocksWaiting[height];
			if (blocksByHeight[height - 1]) {
				//parent exists
				delete this.blocksWaiting[height];
				if (!this.addBlock(data, sendNotification, processed)) return;
				continue;
			} else {
				//parent does not exist
				this.getBlock(data.parentHash);
				return;
			}
		}
	}

	addUncle(data) {
		if (this.hashExistsInBlockchain(data.hash)) return false;
		data.processed = true;
		let spliced = false;
		for (let i = 0; i < this.blockchain.length; i++) {
			const block = this.blockchain[i];
			if (data.hash == block.hash) return false;
			if (data.height == block.height) {
				this.blockchain.splice(++i, 0, data);
				spliced = true;
			}
		}
		if (!spliced) this.blockchain.splice(1, 0, data);
		if (typeof data.txFull !== "undefined") {
			const txArray = Object.keys(data.txFull || {});
			for (let i = 0; i < txArray.length; i++) {
				const tx = txArray[i];
				this.emit("deleteLinePerson", tx);
			}
		}
	}

	addBlock(data, sendNotification = true, processed = false, ignoreHeight = false) {
		if (this.hashExistsInBlockchain(data.hash)) return false;
		if (!data) return false;
		
		if (this.blockchain.length && !ignoreHeight && !this.config.isRollup) {
			const highestBlocks = this.highestBlocks();
			if (data.height <= highestBlocks[0].height) {
				//height not greater than last block
				this.addUncle(data);
				return true;
			} else {
				if (data.height !== highestBlocks[0].height + 1 && highestBlocks[0].height - data.height < 50) {
					//is not the next block
					this.blocksWaiting[data.height] = [data, sendNotification, processed];
					this.checkMissingBlocks();
					return false;
				}
			}
		}

		data.processed = processed;
		data.busCapacity = this.config.busCapacity;
		data.hoursPast = 0;
		data.uncle = false;

		data.minerTime = data.time;
		if (data.inserted) {
			if (Math.abs(data.time - data.inserted) < 300 && data.inserted > data.time) data.time = data.inserted;
		}

		//add fee info to block from txFull
		this.config.calcBlockFeeArray(data);

		this.blockchain.push(Object.seal(data));
		if (typeof data.uncles !== "undefined" && !processed) {
			this.setUncles(data.uncles);
		}

		this.emit("addBlock", data, sendNotification);
		this.deleteOldBlocks();
		return true;
	}

	deleteOldBlocks() {
		if (this.blockchain.length > this.config.maxBlocksToKeep) {
			let maxDelete = Math.abs(this.config.maxBlocksToKeep - this.blockchain.length);
			let howMany = 0;
			for (let i = 0; i < this.blockchain.length; i++) {
				const block = this.blockchain[i];
				if (!block.processed && window.txStreetPhaser) {
					this.emit("fastProcessBlock", block);
					break;
				}
				howMany = i + 1;
				this.emit("deleteTxsFromBlock", block);
				if (howMany >= maxDelete) break;
			}
			if (howMany) this.blockchain.splice(0, howMany);
		}
	}

	blocksByHeight() {
		//sort all blocks into arrays with the same height, object array instead of single array, because uncles can have the same height
		let heights = {};
		for (let i = 0; i < this.blockchain.length; i++) {
			const block = this.blockchain[i];
			if (typeof heights[block.height] === "undefined") heights[block.height] = [];
			heights[block.height].push(block);
		}
		return heights;
	}

	highestBlocks(h = false) {
		//get array of blocks with heighest height, can be multiple because uncles
		const heights = h || this.blocksByHeight();
		let keys = Object.keys(heights);
		keys.sort(function (a, b) {
			return b - a;
		});
		return heights[keys[0]];
	}

	setUncles(hashes, fetchUnloaded = true) {
		for (let i = 0; i < this.blockchain.length; i++) {
			const block = this.blockchain[i];
			if (hashes.includes(block.hash)) {
				this.blockchain[i].uncle = true;
				hashes.splice(hashes.indexOf(block.hash), 1);
			}
		}
		//remaining uncles that were not loaded
		if (fetchUnloaded) {
			for (let i = 0; i < hashes.length; i++) {
				const uncleHash = hashes[i];
				this.getUncle(uncleHash);
			}
		}
	}

	async getUncle(hash) {
		let block = await loadBlock(this.config.ticker, hash);
		if (!block) return false;
		this.addBlock(block, false, true);
		this.setUncles([hash], false);
	}

	async getBlock(hash) {
		if (this.hashExistsInBlockchain(hash)) return false;
		let block = await loadBlock(this.config.ticker, hash);
		if (!block) return false;
		this.addBlock(block);
	}

	hashExistsInBlockchain(hash) {
		for (let i = 0; i < this.blockchain.length; i++) {
			const block = this.blockchain[i];
			if (block.hash == hash) return true;
		}
		return false;
	}
}

const blockFactories = {};
for (const ticker in enabledConfig) {
	blockFactories[ticker] = new blockFactory(ticker);
}

export default blockFactories;
