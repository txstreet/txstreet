import { Street } from "../mall.js";
import { toRes, ethNewTxSetDepending } from "../utils/";
import { ARBI, ethUnits } from "../config.js";
import i18n from "../../i18n";
import eventHub from "../vue/eventHub.js";
import state from "../../wallet";

export default class ARBIStreet extends Street {
	constructor(side) {
		super(ARBI, side);
	}

	init() {
		this.foundBoarding = false;
		this.busStop = toRes(200);
		this.busDoorFromTop = toRes(42);
		this.personPixelsPerSecond = 5;
		this.decelerationArea = 500;
		this.sceneHeight = toRes(10000);
		let walkingLaneOffset = 10 * this.tileSize;
		this.walkingLane = this.side == "right" ? toRes(960) - walkingLaneOffset : walkingLaneOffset;
		this.lineLength = 9500;
		this.maxSizePplToLoad = 20000000;
		this.streetInit();
		this.stringLengths = {
			tx: [64, 66],
			address: [40, 42],
		};
		this.medianFeeStat = "medianFee-gasPrice";
		this.vueTxFormat = [
			{
				title: () => {
					return "Max " + i18n.t(this.ticker.toLowerCase() + ".gp"); 
				},
				format: val => {
					return ethUnits(val);
				},
				key: "feeVal",
			},
			{
				title: () => {
					return i18n.t(this.ticker.toLowerCase() + ".mpfpg");
				},
				format: val => {
					return ethUnits(val);
				},
				key: "mpfpg",
			},
			{
				title: () => {
					return i18n.t(this.ticker.toLowerCase() + ".g");
				},
				key: "g",
			},
			{
				title: () => {
					return "Type";
				},
				key: "ty",
			},
			{
				title: () => {
					return "Nonce";
				},
				key: "n",
			},
			{
				title: () => {
					return i18n.t(this.ticker.toLowerCase() + ".tot");
				},
				key: "tot",
				after: this.ticker,
			},
		];
		this.vueBlockFormat = this.config.blockFormat;
		this.sizeVar = "g";
		this.bottomStats = this.config.stats;
	}

	preload() { }

	async create() {
		super.create();
		this.addressNonces = this.config.addressNonces;

		this.streetCreate();

		this.vue.windowData.push({
			key: "characters",
			title: "Character Select",
			components: [
				{
					name: "CharacterSelect",
				},
			],
			styles: {
				width: "min(965px, 80%)",
				height: "90%",
			},
			position: "center",
		});

		this.vue.busFeeTitle = "Gwei";
		(this.vue.busFeeTitleLong = () => {
			return "Tip Price (Gwei)";
		}),
			(this.vue.sizeTitle = () => {
				return i18n.t(this.ticker.toLowerCase() + ".sizeTitle");
			})

		this.createPeople();
		eventHub.$on(this.ticker + "-follow", (address) => {
			this.followAddress(address);
		});
		if (state.address) this.followAddress(state.address);
	}

	crowdCountDisplay() {
		if (this.vue.stats["mempool-size"].value && this.vue.stats["mempool-size"].value > 75000) {
			return ">75000";
		}
		return this.crowdCount;
	}

	formatAddr(address) {
		return address.toLowerCase();
	}

	addToMove(entry, toMove) {
		if (typeof toMove[entry.txData.fr] === "undefined") toMove[entry.txData.fr] = [];
		entry.ignoreBusFee = true;
		toMove[entry.txData.fr].push(entry);
	}

	getModSize(txData, g = false) {
		if (txData.modSize) return txData.modSize;
		let minGasDif;
		let gasDif;
		if (!g) {
			gasDif = this.vue.stats.gasUsedDif.value / 100;
			minGasDif = 21000 / gasDif;
		} else {
			gasDif = g[0];
			minGasDif = g[1];
		}
		let gas = txData.ag ? txData.ag : txData.g;
		let modSize = gas > minGasDif ? gas * gasDif : gas;
		return Number(modSize);
	}

	getGasTarget() {
		return this.vue.stats["gasTarget"].value || 15000000;
	}

	getBaseFee() {
		return this.vue.stats["baseFee"].value || 1000000000;
	}

	calcBusBaseFee(busArray, index) {
		if (!index || index < 1) return this.getBaseFee();
		let prevBus = busArray[index - 1];
		let prevBaseFee = prevBus.baseFee || this.getBaseFee();
		let prevLoaded = prevBus.realLoaded;
		let baseFee = this.calcBaseFee(prevBaseFee, prevLoaded, this.config.busCapacity);
		return baseFee;
	}

	calcBaseFee(prevBaseFee, used, limit) {
		const elasticity = 2;
		const denominator = 8;
		const target = limit / elasticity;
		let baseFee = prevBaseFee;
		if (used > target) {
			const usedDelta = used - target;
			const baseDelta = Math.max((prevBaseFee * usedDelta) / target / denominator, 1);
			baseFee = prevBaseFee + baseDelta;
		} else if (used < target) {
			const usedDelta = target - used;
			const baseDelta = (prevBaseFee * usedDelta) / target / denominator;
			baseFee = prevBaseFee - baseDelta;
		}
		return baseFee;
	}

	getFittingTxs(hashArray, bus, skipTxs = {}) {
		let spaceRemaining = (this.config.busCapacity - bus.loaded) * 1.5;

		let txs = [];
		for (let i = 0; i < hashArray.length; i++) {
			if (spaceRemaining < 21000) break; //TODO replace 21000 based on coin
			let entry = hashArray[i];
			if (entry.deleted) continue;
			if (entry.txData.feeVal < bus.baseFee) continue;
			if (typeof skipTxs.hashes[entry.txData.tx] !== "undefined") continue;
			if (entry.modSize < spaceRemaining) {
				//it fits!
				spaceRemaining -= entry.modSize;
				entry.ignoreBusFee = true;
				txs.push(entry);
			}
		}
		return txs;
	}

	setMaxScalePerson(person = false, txSize) {
		let scale = 0.35;
		if (txSize <= 21000) {
			scale = 0.35;
		} else if (txSize < 50000) {
			scale = 0.4;
		} else if (txSize < 100000) {
			scale = 0.45;
		} else if (txSize < 500000) {
			scale = 0.55;
		} else if (txSize < 1000000) {
			scale = 0.65;
		} else if (txSize < 10000000) {
			scale = 0.8;
		} else {
			scale = 1;
		}
		if (person) person.setData("maxScale", scale);
		return scale;
	}


	update() {
		this.streetUpdate();
	}

	beforeNewTx(tx) {
		//set the address nonce
		ethNewTxSetDepending(tx, this.config);
		if (tx.dh) {
			for (let i = 0; i < tx.dh.length; i++) {
				const hashToDelete = tx.dh[i];
				this.deleteLinePerson(hashToDelete, true);
				this.removeFollower(hashToDelete, true);
			}
		}
	}

	afterProcessBlock(block) {
		if (typeof block.txFull !== "undefined") {
			for (const hash in block.txFull) {
				const tx = block.txFull[hash];
				const fromAddress = tx.fr;
				if (tx.an >= this.addressNonces[fromAddress]) this.addressNonces[fromAddress] = tx.an;
			}
		}
	}
}

ARBIStreet.config = ARBI;
