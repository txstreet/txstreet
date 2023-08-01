import { Street } from "../street.js";
import { mirrorX, toRes, getSheetKey } from "../utils/";
import { LTC } from "../config.js";
import { fds, default as i18n } from "../../i18n";
import { add } from "date-fns";
import Popup from "../game-objects/popup";

export default class LTCStreet extends Street {
	constructor(side) {
		super(LTC, side);
	}

	init() {
		this.foundBoarding = false;
		this.busStop = toRes(200);
		this.busDoorFromTop = toRes(42);
		this.personPixelsPerSecond = 3;
		this.decelerationArea = toRes(500);
		this.sceneHeight = toRes(10000);
		this.alwaysGetPendingAfterBlock = true;
		let walkingLaneOffset = 10 * this.tileSize;
		this.walkingLane = this.side == "right" ? toRes(960) - walkingLaneOffset : walkingLaneOffset;
		this.lineLength = 9500;
		this.streetInit();
		this.stringLengths = {
			tx: [64],
			address: [34, 42],
		};
		this.sizeVar = "s";
		this.medianFeeStat = "medianFee-litPerByte";
		this.vueTxFormat = [
			{
				title: () => {
					return i18n.t(this.ticker.toLowerCase() + ".lpb");
				},
				key: "lpb",
			},
			{
				title: () => {
					return i18n.t(this.ticker.toLowerCase() + ".s");
				},
				key: "s",
			},
			{
				title: () => {
					return i18n.t(this.ticker.toLowerCase() + ".rs");
				},
				key: "rs",
			},
			{
				title: () => {
					return i18n.t(this.ticker.toLowerCase() + ".tot");
				},
				format: (val, tx) => {
					if(tx?.e?.mwebpegout){
						return tx.e.mwebpegout + " " + this.ticker;
					}else if(tx?.e?.mwebpegin){
						return tx.e.mwebpegin + " " + this.ticker;
					} else if(tx?.e?.mweb){
						return "Confidential";
					} else {
						return val + " " + this.ticker;
					}
				},
				key: "tot",
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
		this.vue.busFeeTitle = "Lit/vB";
		(this.vue.busFeeTitleLong = () => {
			return i18n.t(this.ticker.toLowerCase() + ".lpb");
		}),
			(this.vue.sizeTitle = () => {
				return i18n.t(this.ticker.toLowerCase() + ".sizeTitle");
			}),
			(this.vue.sizeAltTitle = () => {
				return i18n.t(this.ticker.toLowerCase() + ".sizeAltTitle");
			}),
			this.createBuses();

		this.vue.$watch("blockchainLength", val => {
			this.calcHalving(val);
		});
		this.calcHalving(this.blockchain.length);

		this.createArise();
		this.events.on("changeSide", () => {
			this.destroyArise();
			this.createArise();
		});
	}

	destroyArise() {
		clearInterval(this.arise.isaChange);
		this.arise.destroy();
		this.arisepop.destroy();
	}

	createArise() {
		this.arise = this.add.image(mirrorX(700, this.side), toRes(160), getSheetKey("ltc-0.png"), "ltc-0.png");
		this.arise.setInteractive({ useHandCursor: true });
		this.arise.on("pointerup", () => {
			this.cycleAriseMessage();
		});
		this.arise.setDepth(this.personDepth);
		this.arise.messages = [
			"Arise Chikun! Welcome to Litecoin Street!",
			"Have you heard of the MWEB upgrade? Click on the second trailer for more info.",
			"You'll see another chikun board the MWEB trailer when a MWEB transaction is made. Us chikuns represent privacy on Litecoin.",
		];
		this.cycleAriseMessage();
	}

	cycleAriseMessage() {
		if (!this.arise.isaChange) {
			this.arise.currentMessage = 0;
			this.arise.isaChange = setInterval(() => {
				this.cycleAriseMessage();
			}, 30000);
		}

		if (this.arisepop) this.arisepop.destroy();
		if (!this.arise.messages[this.arise.currentMessage]) {
			clearInterval(this.arise.isaChange);
			delete this.arise.isaChange;
			return;
		}
		this.arisepop = new Popup(
			this,
			mirrorX(700, this.side),
			toRes(170),
			false,
			"bubble",
			this.arise.messages[this.arise.currentMessage++]
		);
	}

	calcHalving(val) {
		if (!this.blockchain.length) return;
		let recentBlock = this.blockchain[val - 1];
		let height = recentBlock.height;
		let halvingHeight = 0;
		while (halvingHeight < height) {
			halvingHeight += 840000;
		}
		let blocksUntilHalving = halvingHeight - height;
		let secondsUntilHalving = blocksUntilHalving * (600 / 4);
		this.vue.stats["halving"].value = fds(add(new Date(), { seconds: secondsUntilHalving }), new Date(), {
			roundingMethod: "floor",
			addSuffix: true,
		});
	}

	update() {
		this.streetUpdate();

		let buses = this.buses.children.entries;
		for (let i = 0; i < buses.length; i++) {
			const bus = buses[i];
			const mwebFloor = bus.mwebBusFloor;
			mwebFloor.setPosition(this.side === "right" ? bus.x + toRes(46) : bus.x - toRes(53),
			bus.y + toRes(bus.mweb.y) - toRes(25));
			bus.mweb.setFlipX(this.side === "right");
		}
	}

	getBoardingY(person) {
		let txData = person.getLineData("txData");
		if (txData?.e?.mweb) {
			return this.boarding.y + 374;
		}
		return this.boarding.y
	}

	afterNewBus(bus) {
		bus.mwebLoaded = 0;
		bus.trailerLight.y = 230;
		bus.trailer.y = 177;
		bus.segwitInside.y = 170;
		bus.segwitColor.y = 170;
		bus.segwitOutside.y = 170;

		bus.mweb.y = 300;
		bus.mwebLogo.y = 292;
		bus.mwebLight.y = 352;
	}

	afterBusConstructor(bus) {
		bus.trailer = this.add.sprite(0, 177, getSheetKey("segwitbus.png"), "segwitbus.png");
		bus.trailer.clickObject = "segwit";
		bus.trailer.setInteractive({ cursor: "help" });

		bus.bottomSpriteName = "mweb";
		bus.segwitInside = this.add.sprite(1, 170, getSheetKey("segwit_inside.png"), "segwit_inside.png");
		bus.segwitInside.setAlpha(0.5);
		bus.segwitInside.setScale(0.8);
		bus.segwitColor = this.add.sprite(1, 170, getSheetKey("segwit_inside.png"), "segwit_inside.png");
		bus.segwitColor.setAlpha(0);
		bus.segwitColor.setTint(0x54fff1);
		bus.segwitColor.setScale(0.8);
		bus.segwitOutside = this.add.sprite(1, 170, getSheetKey("segwit_outline.png"), "segwit_outline.png");
		bus.segwitOutside.setScale(0.8);
		bus.trailerLight = this.add.sprite(0, 230, getSheetKey("lights.png"), "lights.png").setScale(0.88);
		bus.lightsSprite.push(bus.trailerLight);
		bus.add(bus.trailer);
		bus.add(bus.segwitInside);
		bus.add(bus.segwitColor);
		bus.add(bus.segwitOutside);
		bus.add(bus.trailerLight);

		bus.mweb = this.add.sprite(0, 300, getSheetKey("opentrailer.png"), "opentrailer.png");
		bus.mweb.setTint(0x6196ec);
		bus.mweb.clickObject = "mweb";
		bus.mweb.setInteractive({ cursor: "help" });

		bus.mwebLogo = this.add.sprite(0, 292, getSheetKey("mweb.png"), "mweb.png");
		bus.mweb.setInteractive({ cursor: "help" });

		bus.mwebLogo.setScale(0.9);
		bus.mwebLight = this.add.sprite(0, 352, getSheetKey("lights.png"), "lights.png").setScale(0.88);
		bus.lightsSprite.push(bus.mwebLight);

		bus.mwebBusFloor = this.add.rectangle(
			this.side === "right" ? bus.x + toRes(53) : bus.x - toRes(60),
			bus.y + bus.displayHeight,
			toRes(7),
			toRes(50),
			0x144880,
			1
		);
		this.busFloors.add(bus.mwebBusFloor);
		bus.mwebBusFloor.setOrigin(0, 0);
		bus.mwebBusFloor.setScale(this.config.resolution);

		bus.add(bus.mweb);
		bus.add(bus.mwebLogo);
		bus.add(bus.mwebLight);
	}

	setSegwitFadeout(bus) {
		if (typeof bus === "undefined" || typeof bus.segwitColor === "undefined") return false;
		if (typeof bus.segwitFadeout !== "undefined") bus.segwitFadeout.remove();
		bus.segwitColor.setAlpha(1);
		bus.segwitFadeout = this.add.tween({
			targets: bus.segwitColor,
			alpha: 0,
			ease: "Expo.easeOut",
			duration: 1000 * window.txStreetPhaser.streetController.fpsTimesFaster,
		});
	}

	afterEnterBus(array) {
		let person = array[0];
		let bus = array[1];
		let addToLoaded = array[2] || false;
		let txData = person.getLineData("txData");
		let segwit = typeof txData.e !== "undefined" && typeof txData?.e?.sw !== "undefined" ? txData?.e?.sw : false;
		if (segwit) {
			this.setSegwitFadeout(bus);
		}
		if (addToLoaded && !bus.endBus) {
			let txData = person.getLineData("txData");
			if (txData?.e?.mweb) {
				bus.loaded -= txData[this.sizeVar];
				bus.mwebLoaded += txData[this.sizeVar];
			}
		}
	}

	afterMoveLength(arr) {
		let bus = arr[0];
		let duration = arr[1];
		let difference = arr[3];

		this.add.tween({
			targets: [bus.trailer, bus.mweb, bus.mwebLogo, bus.segwitInside, bus.segwitColor, bus.segwitOutside],
			y: target => {
				return target.y - difference;
			},
			ease: "Power1",
			duration: duration,
		});
	}

	beforeNewTx(tx) {
		if (tx?.e?.mweb || tx?.e?.mwebpegin || tx?.e?.mwebpegout || tx?.e?.mwebhogex)
			tx.char = "ltc";
	}

	beforeProcessBlock() {
		//delete all mweb txs in the bus
		for (var hash in this.lineManager) {
			let entry = this.lineManager[hash];
			if (entry?.txData?.e?.mweb && entry.spot === "bus") {
				console.log(this.lineManager[hash]);
				this.deleteLinePerson(hash, true);
			}
		}
	}

	afterResume() { }

	customSortBusTxs(hashArray, activeBuses, instant) {
		//load all mweb transactions into trailers


		//new bus variables: mwebFeeArray, mwebTx, mwebLoaded
		let firstBus = activeBuses[0];
		let busId = firstBus.getData("id");
		firstBus.mwebFeeArray = [];
		firstBus.mwebTx = [];
		firstBus.mwebLoaded = 0;
		for (let i = 0; i < hashArray.length; i++) {
			const entry = hashArray[i];
			if (entry.txData.deleted || !entry.txData?.e?.mweb) continue;
			if (typeof entry.modSize === "undefined") entry.modSize = this.getModSize(entry.txData);

			let fee = this.config.getAndApplyFee(entry.txData);
			firstBus.mwebFeeArray.push(fee);
			firstBus.mwebTx.push(entry.txData);
			firstBus.mwebLoaded += entry.modSize;
			if (instant) {
				this.lineManager[entry.txData.tx].status = "on_bus";
				this.lineManager[entry.txData.tx].boarded = busId;
			}
			this.lineManager[entry.txData.tx].destination = busId;
			this.lineManager[entry.txData.tx].spot = "bus";
		}

	}

	afterSortBusesLoadTx(array) {
		let entry = array[0];
		let bus = array[1];

		if (!entry.txData?.e?.mweb)
			bus.loadedAlt += entry.txData.rs;
	}
}

LTCStreet.config = LTC;
