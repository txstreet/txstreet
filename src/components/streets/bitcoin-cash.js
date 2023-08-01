import { Street } from "../street.js";
import { toRes } from "../utils/";
import { BCH } from "../config.js";
import bchaddr from "bchaddrjs";
import { fds, default as i18n } from "../../i18n";
import { add } from "date-fns";

export default class BCHStreet extends Street {
	constructor(side) {
		super(BCH, side);
	}

	init() {
		this.foundBoarding = false;
		this.busStop = toRes(200);
		this.busDoorFromTop = toRes(42);
		this.personPixelsPerSecond = 3;
		this.decelerationArea = toRes(500);
		this.sceneHeight = toRes(10000);
		this.busArticulated = 32;
		this.alwaysGetPendingAfterBlock = true;
		this.lineLength = 9500;
		this.streetInit();
		this.stringLengths = {
			tx: [64],
			address: [54, 42, 34],
		};
		this.sizeVar = "s";
		this.medianFeeStat = "medianFee-satPerByte";
		this.vueTxFormat = [
			{
				title: () => {
					return i18n.t(this.ticker.toLowerCase() + ".spb");
				},
				key: "spb",
			},
			{
				title: () => {
					return i18n.t(this.ticker.toLowerCase() + ".s");
				},
				key: "s",
			},
			{
				title: () => {
					return i18n.t(this.ticker.toLowerCase() + ".tot");
				},
				key: "tot",
				after: this.ticker,
			},
		];
		this.bottomStats = this.config.stats;
	}

	preload() {

	}

	create() {
		super.create();
		this.createPeople();
		this.streetCreate();
		this.vue.busFeeTitle = "Sat/B";
		(this.vue.busFeeTitleLong = () => {
			return i18n.t(this.ticker.toLowerCase() + ".spb");
		}),
			(this.vue.sizeTitle = () => {
				return i18n.t(this.ticker.toLowerCase() + ".sizeTitle");
			}),
			this.createBuses();

		this.vue.$watch("blockchainLength", val => {
			this.calcHalving(val);
		});
		this.calcHalving(this.blockchain.length);
	}

	calcHalving(val) {
		if (!this.blockchain.length) return;
		let recentBlock = this.blockchain[val - 1];
		let height = recentBlock.height;
		let halvingHeight = 0;
		while (halvingHeight < height) {
			halvingHeight += 210000;
		}
		let blocksUntilHalving = halvingHeight - height;
		let secondsUntilHalving = blocksUntilHalving * 600;
		this.vue.stats["halving"].value = fds(add(new Date(), { seconds: secondsUntilHalving }), new Date(), {
			roundingMethod: "floor",
			addSuffix: true,
		});
	}

	formatAddr(address) {
		return bchaddr.toLegacyAddress(address);
	}

	update() {
		this.streetUpdate();
	}

	afterResume() { }
}

BCHStreet.config = BCH;
