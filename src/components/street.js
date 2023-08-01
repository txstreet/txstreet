import Phaser from "phaser";
import { config, userSettings, charConfig, enabledConfig } from "./config.js";
import blockFactories from "./blocks.js";
import {
	mirrorX,
	toRes,
	toResRev,
	getSocket,
	joinRoom,
	joinStatRoom,
	getHouseArray,
	shortHash,
	resetNeededRooms,
	getSheetKey
} from "./utils/";
import median from "./utils/median";
import Person from "./game-objects/person.js";
import Bus from "./game-objects/bus.js";
import Sign from "./game-objects/sign.js";
import Stoplight from "./game-objects/stoplight.js";
import sideCtor from "./vue/SideController.vue";
import { fds, default as i18n } from "../i18n";
import Notification from "./vue/toasts/Notification";
import AppleTest from './utils/apple_test.js';


//Main street class which all streets inherit from (e.g. btc, eth, etc)
export class Street extends Phaser.Scene {
	constructor(coinConfig, side) {
		super({ key: coinConfig.ticker });
		this.ticker = coinConfig.ticker;
		this.config = coinConfig;
		this.side = side;
		this.tileSize = toRes(32);
		this.tileWidth = toRes(30);
		this.personDepth = 10;
		this.bridgeDepth = 7;
		this.topDepth = 100;
		this.overlayDepth = 200;
		this.processingBlock = false;
		this.housePlans = {};
		this.lineManager = {};
		this.jsonTimestamps = {};
		this.loaded = false;
		this.backgroundColor = config.theme.backgroundColor;
		this.colorFader = false;
		this.housesCreated = false;
		this.blocksLoaded = false;
		this.maxSizePplToLoad = 2000000;
		this.busIdCache = {};
		this.movingPeople = [];
		this.forceCorrectLine = false;
		this.changingBusCounts = {};
		this.deleteFromVueArr = {};
		this.lastGotPending = false;
		this.statUpdateCount = 0;
		this.txFollowers = {};
		this.txFollowersHashes = [];
		this.deleteTxsPool = {};
		this.blockFactory = blockFactories[this.ticker];
		this.loadedNFTSprites = {};
		this.charConfig = charConfig;

		this._appleTest = new AppleTest();

	}

	//Phaser scene function
	async create() {
		this.createBuses();

		let houses = await getHouseArray(this.config);
		this.createHouses(houses);
	}

	streetInit() {
		this.ticker = this.config.ticker;
		this.color = this.config.color;
		this.nextPersonWaitingAnimUpdate = 0;
		this.initSide();
		this.resetInLineCount();
		this._isABadApple();
		this.postFxPlugin = this._getRightFxPlugin();
	}

	_getRightFxPlugin() {
		if (this._isABadApple()) {
			return {
				add: () => {


				},
				get: () => {
					return [
						{
							setOutlineColor: (gameObject, colorCode) => {
								this._handleTint(gameObject, colorCode);
							}
						}
					]
				},
				remove: (gobject) => {

					this._handleRemoveTint(gobject)
				}
			}
		} else {
			return this.plugins.get("rexOutlinePipeline");
		}
	}

	_isABadApple() {
		return this._appleTest.isABadApple();
	}


	_handleTint(gameObject, colorCode) {
		if (gameObject.type == "Sprite" || gameObject.type == "Image") {
			gameObject.setTint(colorCode);
		} else {
			console.log("Type = ", gameObject.type);

			gameObject.iterate((obj) => {
				if (obj.type == "Image") {
					if (obj.frame) {
						let frame_list = this._getTickerArray();

						if (frame_list.includes(obj.frame.name)) {
							if (obj.setTint) {
								obj.oldTint = obj.tint;
								obj.setTint(colorCode);
							}
						}
					}

				} else if (obj.type == "BitmapText") {

					if (obj.setTint) {
						obj.oldTint = obj.tint;
						obj.setTint(colorCode);
					}
				}
			})
		}
	}


	_handleRemoveTint(gameObject) {
		if (gameObject.type == "Sprite" || gameObject.type == "Image") {
			gameObject.clearTint();
		} else {
			gameObject.iterate((obj) => {
				if (obj.type == "Image") {
					if (obj.frame) {
						let frame_list = this._getTickerArray();

						if (frame_list.includes(obj.frame.name)) {
							if (obj.clearTint) obj.clearTint();
							this._restoreOriginalTint(obj);
						}
					}

				} else if (obj.type == "BitmapText") {
					if (obj.clearTint) {
						obj.clearTint();
						this._restoreOriginalTint(obj);
					}
				}
			})
		}
	}

	_restoreOriginalTint(gameObject) {
		if (gameObject.originalTint) gameObject.setTint(gameObject.originalTint);
	}

	_getTickerArray() {
		let frames = [];

		for (const ticker in enabledConfig) {
			let frame = ticker.toLowerCase() + ".png"
			frames.push(frame);
		}

		return frames;
	}

	initSide() {
		this.neededRooms();
		let walkingLaneOffset = 10 * this.tileSize;
		this.walkingLane = this.side == "right" ? toRes(960) - walkingLaneOffset : walkingLaneOffset;
		this.busLane = mirrorX(868, this.side);
		this.curbX = this.busLane + (this.side == "right" ? 4 * this.tileSize : -(4 * this.tileSize));
		this.busDoorBetween = [
			this.curbX + (this.side == "right" ? toRes(-150) : toRes(70)),
			this.curbX + (this.side == "right" ? toRes(-70) : toRes(150)),
		];
		this.boarding = {};
		this.boarding.y = this.busStop + this.busDoorFromTop;
		this.boarding.x = this.curbX;
		this.startX = this.side == "right" ? toRes(960) : 0;
		this.endX = this.side == "right" ? toRes(1920) : toRes(960);
	}

	socketStats(force = false) {
		for (const key in this.config.stats) {
			const stat = this.config.stats[key];
			if (!stat.socket) continue;
			joinStatRoom(this.config, key, force);
		}
	}

	neededRooms(reset = false) {
		if (reset) {
			//keep blocks only in background
			resetNeededRooms("viz-" + this.ticker, [this.ticker + "-blocks"]);
			return;
		}
		let arr = [];
		for (const key in this.config.stats) {
			const stat = this.config.stats[key];
			if (!stat.socket) continue;
			arr.push(this.ticker + "-stat-" + key);
		}
		arr.push(this.ticker + "-transactions");
		arr.push(this.ticker + "-blocks");
		resetNeededRooms("viz-" + this.ticker, arr);
	}

	setConnected(bool = this.vue.isConnected) {
		if (!bool) {
			this.hasBeenDisconnected = true;
			this.scene.setVisible(false);
			this.loaded = true;
		} else {
			if (this.hasBeenDisconnected) {
				this.hasBeenDisconnected = false;
				joinRoom(this.config, "transactions", true);
				this.socketStats(true);
				this.blockFactory.connect();
				this.getPendingTxs();
				this.time.addEvent({
					delay: 5000,
					callback: () => {
						this.forceCorrectLine = true;
						window.txStreetPhaser.streetController.positionHouses(true);
						this.scene.setVisible(true);
					},
				});
			}
		}
	}

	createLedgerNanoX() {
		if (this.side == "right") return false;
		let ledger = this.add.sprite(-200, toRes(500), getSheetKey("ledger1.png"), "ledger1.png");
		if (userSettings.globalSettings.animations.value) {
			this.anims.create({
				key: "ledger_animation",
				frameRate: 1.25,
				frames: this.anims.generateFrameNames(getSheetKey("ledger1.png"), {
					prefix: "ledger",
					suffix: ".png",
					frames: [1, 2],
				}),
				repeat: -1,
			});
			ledger.play("ledger_animation");
		}
		ledger.setDepth(this.topDepth + 10);
		ledger.setInteractive({ useHandCursor: true });
		ledger.on("pointerup", () => {
			window.open("https://bit.ly/3sYNWE8");
			if (userSettings.globalSettings.animations.value) ledger.anims.stop();
			ledger.destroy();
			localStorage.setItem("ledgerDone", true);
		});
		this.tweens.add(
			{
				targets: ledger,
				x: this.walkingLane,
				y: toRes(300),
				scale: {
					from: toRes(1.5),
					to: toRes(0.8),
				},
				rotation: {
					from: 0,
					to: 6.283185,
				},
				ease: "Power1",
				duration: 1000 * window.txStreetPhaser.streetController.fpsTimesFaster,
				repeat: 0,
			},
			this
		);
	}

	deleteTxsFromBlock(block) {
		if (typeof block.txFull === "undefined") return false;
		const tx = Object.keys(block.txFull);
		for (let i = 0; i < tx.length; i++) {
			let reportedHash = tx[i];
			this.deleteLinePerson(reportedHash, true);
			this.removeFollower(reportedHash, false, false);
		}
	}

	deleteTxsFromAllBlocksBelow(below) {
		for (let i = 0; i < this.blockchain.length; i++) {
			let block = this.blockchain[i];
			if (block.height > below) continue;
			this.deleteTxsFromBlock(block);
		}
	}

	fastProcessBlocks() {
		for (let i = 0; i < this.blockchain.length; i++) {
			let block = this.blockchain[i];
			// console.log(block.height, block.processed);
			this.fastProcessBlock(block);
		}
		this.processingBlock = false;
	}

	fastProcessBlock(block) {
		if (block.processed) {
			//just check if a transaction shouldn't be here
			this.deleteTxsFromBlock(block);
		} else {
			let height = block.height;
			let matchingBus = this.getBusFromId(height);
			if (matchingBus) this.byeBusesBelow(matchingBus);
			if (typeof block.txFull !== "undefined") {
				const tx = Object.keys(block.txFull);
				for (let i = 0; i < tx.length; i++) {
					let reportedHash = tx[i];
					this.confirmTx(reportedHash, block);
					this.deleteLinePerson(reportedHash, true);
				}
			}
			block.processed = true;
			this.customCallback("processBlock", "after", block);
		}
	}

	confirmTx(hash, block) {
		if (typeof this.lineManager[hash] !== "undefined") {
			this.lineManager[hash].txData.block = block.height;
			this.lineManager[hash].txData.bh = block.hash;

			if (this.removeFollower(hash, 2000)) {
				//successfully confirmed followed transaction
				window.mainVue.$toast.success(
					{
						component: Notification,
						props: {
							html:
								"<a href='" +
								this.config.explorerTxUrl +
								hash +
								"' target='_blank'>" +
								shortHash(hash, 10, true) +
								"</a><br/>" +
								fds(block.time * 1000, new Date(), {
									roundingMethod: "floor",
									addSuffix: true,
								}),
							title: this.ticker + " " + i18n.t("messages.transaction-conf"),
						},
					},
					{
						position: "bottom-center",
						closeOnClick: false,
						timeout: 20000,
					}
				);
			}
		}
	}

	byeBusesBelow(belowBus) {
		const belowBusId = belowBus.getData("id");
		for (let i = 0; i < this.buses.children.entries.length; i++) {
			const bus = this.buses.children.entries[i];
			const id = bus.getData("id");
			if (id <= belowBusId) bus.bye();
		}
		belowBus.bye();
	}

	txInBlock(hash) {
		for (let i = 0; i < this.blockchain.length; i++) {
			let block = this.blockchain[i];
			if (typeof block.txFull === "undefined") continue;
			const tx = Object.keys(block.txFull);
			for (let j = 0; j < tx.length; j++) {
				if (hash == tx[j]) return block;
			}
		}
		return false;
	}

	deleteConfirmedTxs(maxBlocksToCheck = 15) {
		let entries = [];
		for (let i = this.blockchain.length - 1; i >= 0; i--) {
			if (i < this.blockchain.length - maxBlocksToCheck) break;
			let block = this.blockchain[i];
			if (typeof block.txFull === "undefined") continue;
			const tx = Object.keys(block.txFull);
			for (let i = 0; i < tx.length; i++) {
				if (typeof this.lineManager[tx[i]] !== "undefined") {
					let entry = this.lineManager[tx[i]];
					if (entry.txData.deleted) continue;
					entries.push(entry);
				}
			}
		}
		let length = entries.length;
		for (let i = entries.length - 1; i >= 0; i--) {
			const entry = entries[i];
			this.deleteLinePerson(entry.txData.tx, true);
		}
		return length;
	}

	busesLoaded() {
		if (!this.buses.children.entries.length) return false;
		for (let i = 0; i < this.buses.children.entries.length; i++) {
			let bus = this.buses.children.entries[i];
			if (bus.getData("leaving")) continue;
			if (!bus.active) continue;
			if (bus.loaded < this.config.busCapacity) return false;
		}
		return true;
	}

	checkNewBlocks() {
		if (this.processingBlock) {
			return false;
		}
		if (this.busesMoving) return false;
		if (window.txStreetPhaser.streetController.hidden) return false;

		let below = 0;
		for (let i = 0; i < this.blockchain.length; i++) {
			let block = this.blockchain[i];
			if (block.processed) continue;
			//dont process block if buses are moving

			this.processingBlock = true;
			this.customCallback("processBlock", "before", block);
			this.resetInLineCount();
			this.lineToBlock(block);
			this.processBlock(block);
			below = block.height;
			break;
		}

		if (below) {
			this.time.addEvent({
				delay: 20000,
				callback: () => {
					this.deleteTxsFromAllBlocksBelow(below);
				},
			});
		}
	}

	deleteTxsInterval() {
		this.time.addEvent({
			delay: 10000,
			callback: function () {
				let deletedOne = false;
				let now = Date.now();
				for (const hash in this.deleteTxsPool) {
					// if(this.txFollowers[hash]) continue;
					if (now - this.deleteTxsPool[hash] < 15000) continue;
					this.removeFollower(hash, 0);
					this.deleteLinePerson(hash, true);
					delete this.deleteTxsPool[hash];
					deletedOne = true;
				}
				if (!deletedOne) return;
				this.resetInLineCount();
				this.forceCorrectLine = true;
			},
			callbackScope: this,
			loop: true,
		});
	}

	checkBlockInterval() {
		this.time.addEvent({
			delay: 100,
			callback: function () {
				if (!window.txStreetPhaser.streetController.hidden) this.checkNewBlocks();
			},
			callbackScope: this,
			loop: true,
		});
	}

	busLeavingInterval() {
		this.time.addEvent({
			delay: 100,
			callback: function () {
				if (!window.txStreetPhaser.streetController.hidden) this.busLeavingUpdate();
			},
			callbackScope: this,
			loop: true,
		});
	}

	busInsideInterval() {
		this.time.addEvent({
			delay: 2000,
			callback: () => {
				this.busInside();
			},
			loop: true,
		});
	}

	busInside() {
		for (let i = 0; i < this.buses.children.entries.length; i++) {
			const bus = this.buses.children.entries[i];
			// if(bus.getData("leaving")) continue;
			this.busInsideSingle(bus);
			// if(bus.visible && bus.roofCutout && bus.roofCutout.visible){
			// 	bus.pplBlitter();
			// }
		}
	}

	busInsideSingle(bus) {
		if (
			(bus.visible && userSettings.globalSettings.openRoofs.value && !bus.hovered) ||
			(!userSettings.globalSettings.openRoofs.value && bus.hovered)
		) {
			bus.openTop();
		} else {
			bus.closeTop();
		}
	}

	clearDeletedInterval() {
		this.time.addEvent({
			delay: 10000,
			callback: function () {
				if (!this.busesReady()) return false;
				this.clearDeleted();
			},
			callbackScope: this,
			loop: true,
		});
	}

	busesReady(retry = 0) {
		for (var hash in this.lineManager) {
			if (this.lineManager[hash].txData.deleted) {
				this.deleteLinePerson(hash, true);
				continue;
			}
			if (
				this.lineManager[hash].status == "exit_bus" ||
				this.lineManager[hash].status == "boarding" ||
				this.lineManager[hash].status == "skipLine" ||
				this.lineManager[hash].status == "change_bus"
			) {
				if (retry >= 100) {
					//TODO make it more robust without this
					this.deleteLinePerson(hash, true);
					continue;
				}
				if (!this.lineManager[hash].readyForBusRetries) this.lineManager[hash].readyForBusRetries = 0;
				this.lineManager[hash].readyForBusRetries++;
				if (this.lineManager[hash].readyForBusRetries >= 20) {
					this.deleteLinePerson(hash, true);
					continue;
				}
				return false;
			}
		}
		if (this.busesMoving) return false;
		return true;
	}

	clearDeleted() {
		for (var hash in this.lineManager) {
			let entry = this.lineManager[hash];
			if (entry.txData.deleted) {
				this.deleteLinePerson(hash, true);
			}
		}
		//get rid of people who are glitched with no matching lineManager entry
		for (let i = 0; i < this.people.children.entries.length; i++) {
			const person = this.people.children.entries[i];
			let personHash = person.data.values.txHash;
			if (personHash) {
				if (typeof this.lineManager[personHash] == "undefined" || !this.lineManager[personHash].person) {
					person.bye(true);
				}
			}
		}

		//delete entry from vue tx array
		let deleteLength = Object.keys(this.deleteFromVueArr).length;
		if (deleteLength) {
			const now = Date.now();
			let newArr = [];
			for (let i = 0; i < this.config.liveTxs.length; i++) {
				const entry = this.config.liveTxs[i];
				const hash = entry.tx;
				if (typeof this.deleteFromVueArr[hash] !== "undefined") {
					//has to be deleted more than 5 mins ago
					if (this.config.liveTxs[i].deletedOn && now - this.config.liveTxs[i].deletedOn > 300000) {
						//no need to splice because we are leaving it out of newArr
						delete this.deleteFromVueArr[hash];
						continue;
					}
				}
				newArr.push(entry);
			}
			this.config.liveTxs = newArr;
		}
	}

	deleteLinePerson(hash, deleteLineEntry = false, noTween = false) {
		let entry = this.lineManager[hash];
		if (entry) {
			let person = entry.person;
			if (person) {
				// if(userSettings.globalSettings.followIcons.value){
				// 	person.followIcons.forEach((followIcon) => {
				// 		followIcon.icon.setVisible(false);
				// 		followIcon.icon.setActive(false);
				// 	});
				// }
				if (person.visible && !noTween) {
					this.add.tween({
						targets: [person],
						ease: "Sine.easeInOut",
						duration: 500 * window.txStreetPhaser.streetController.fpsTimesFaster,
						scale: {
							getStart: () => person.scale,
							getEnd: () => 0,
						},
						onComplete: () => {
							person.bye(deleteLineEntry);
						},
					});
				} else {
					person.bye(deleteLineEntry);
				}
				this.lineManager[hash].person = null;
				// if(entry.status == "on_bus"){
				// 	let busIndex = entry.boarded;
				// 	let bus = this.getBusFromId(busIndex);
				// 	if(bus && !bus.endBus && !bus.getData('leaving')) bus.loaded -= entry.modSize;
				// }
			}
			if (deleteLineEntry) {
				delete this.lineManager[hash];

				entry.status = null;
				entry.person = null;
				entry.txData.deleted = true;
				entry.txData.deletedOn = Date.now();
				if (!entry.txData.keep) {
					this.deleteFromVueArr[hash] = true;
				}
			}
		}
	}

	lineToBlock(data) {
		//moves people in and out of the bus depending on if they are in this block or not
		if (typeof data.txFull === "undefined" || !data.txFull) return false;
		let skipLineCount = 0;
		let exitBusCount = 0;
		let bus = this.getBusFromId(data.height);
		if (bus) {
			bus.tx = [];
			bus.loaded = typeof data.size === "undefined" || !data.size ? 0 : data.size;
		}
		const tx = Object.keys(data.txFull);
		for (let i = 0; i < tx.length; i++) {
			const hash = tx[i];
			if (this.lineManager[hash]) {
				let entry = this.lineManager[hash];
				if (bus) bus.tx.push(entry.txData);
				entry.leavingForBlock = data.height;
				let person = entry.person;
				if (person) {
					//in block, but theres a person, so board bus
					entry.destination = data.height;
					person.boardAndSkipLine(skipLineCount, data.height);
					skipLineCount++;
				} else {
					if (entry.boarded != data.height) {
						//boarded the wrong bus
						if (entry.boarded) {
							entry.destination = data.height;
							this.personChangeBus(hash);
							continue;
						} else {
							this.deleteLinePerson(hash, true);
							continue;
						}
					} else {
						//boarded correct bus
						this.lineManager[hash].status = "on_bus";
					}
				}
				this.lineManager[hash].deleted = true;
			} else {
				//check txfull for data, create new person and move to bus
				// TODO: Update txFull to use Hash: Transaction instead of [transaction...]

				if (data.txFull && data.txFull[hash]) {
					this.newTx(data.txFull[hash], "new", true, false);
					let entry = this.lineManager[hash];
					if (entry) {
						if (bus) bus.tx.push(entry.txData);
						entry.leavingForBlock = data.height;
						entry.destination = data.height;
						let person = entry.person;
						person.boardAndSkipLine(0, data.height);
					}
				}
			}
			this.confirmTx(hash, data);
		}
		for (var hash in this.lineManager) {
			let entry = this.lineManager[hash];
			let person = entry.person;

			//check if transaction had a higher fee than median block fee
			if (!entry.leavingForBlock && data.medianFee) {
				if (
					this.config.getAndApplyFee(entry) > data.medianFee &&
					!entry.txData.dependingOn &&
					this.ticker !== "eth" &&
					this.ticker !== "rinkeby"
				) {
					if (typeof entry.missedBlock === "undefined") entry.missedBlock = 0;
					entry.missedBlock++;
					//missed more than 5 blocks, delete
					if (entry.missedBlock >= 3) {
						this.deleteLinePerson(entry.txData.tx, true);
						continue;
					}
				}
			}
			if (!entry.leavingForBlock || entry.leavingForBlock !== data.height) {
				if (person == null && entry.boarded == data.height) {
					// if(exitBusCount > 5) continue; //TODO
					exitBusCount;
					entry.status = "exit_bus";
					//create the person
					exitBusCount++;
					person = this.newPerson(entry);
				}
			}
		}

		this.sortLine(false);
		this.changingBusCounts = {};
		if (bus) this.busInsideSingle(bus);
	}

	processBlock(data, retry = 0) {
		//processes the block once the buses are ready to leave
		if (window.txStreetPhaser.streetController.hidden || this.game.scene.isSleeping(this)) {
			this.processingBlock = false;
			return false;
		}

		let index = this.blockchain.findIndex((block) => block.height == data.height);
		if (!index || !this.blockchain[index]) return;

		let filled = this.fillBusesAndLeave(data, true);
		if (filled) this.stoplight.setLight("green");
		let ready = this.busesReady(retry);
		if (!ready) {
			this.time.addEvent({
				delay: 100,
				callback: () => {
					retry++;
					this.processBlock(data, retry);
				},
			});
			return false;
		}
		this.clearDeleted();
		//fill buses and leave them
		if (filled) this.fillBusesAndLeave(data);

		this.blockchain[index].processed = true;
		this.time.addEvent({
			delay: 1000,
			callback: () => {
				this.processingBlock = false;
				this.deleteConfirmedTxs();
			},
		});
		this.time.addEvent({
			delay: 5000,
			callback: () => {
				if (
					(this.lastGotPending && Date.now() / 1000 - this.lastGotPending > 90) ||
					this.alwaysGetPendingAfterBlock
				) {
					// if(this.vue.transactions.length < 3000 && userSettings[this.ticker + 'Settings'].maxTxsLoaded.value/this.vue.transactions.length > 2){
					// if (config.dev) console.log("getting more pending!");
					this.lastGotPending = Date.now() / 1000;
					this.getPendingTxs();
				}
			},
		});
		this.customCallback("processBlock", "after", data);
	}

	fillBusesAndLeave(block, statusOnly = false) {
		let blockBus = this.getBusFromId(block.height);
		if (!blockBus) return false;
		blockBus.loaded = typeof block.size === "undefined" || !block.size ? 0 : block.size;

		if (statusOnly) {
			blockBus.setData("leaving", true);
			let sizeInMB = +(block.size / 1000000).toFixed(3) + " MB";
			// if(typeof this.setConfText === "function"){
			// 	this.setConfText(block, blockBus);
			// }
			// else{
			blockBus.text2.setText(sizeInMB);
			blockBus.text3.setText("");
			// }
		} else {
			blockBus.leave(block);
		}
		return true;
	}

	drawStreet() {
		this.cameras.main.setBackgroundColor(this.backgroundColor);
		this.pathSprite = this.add.tileSprite(
			this.side == "right" ? toRes(192) : toRes(this.noHousesArea ? 0 : 256),
			0,
			this.noHousesArea ? 768 : 512,
			window.innerHeight - config.vPadding,
			getSheetKey("road.png"),
			"road.png"
		);
		// if(this.side == "right") this.pathSprite.setTilePosition(32, 0);
		this.pathSprite.scrollFactorY = 0;
		this.pathSprite.setOrigin(0, 0);
		this.pathSprite.setScale(config.resolution);

		this.laneSprite = this.add.tileSprite(
			this.busLane,
			0,
			192,
			window.innerHeight - config.vPadding,
			getSheetKey("lane.png"),
			"lane.png"
		);
		this.laneSprite.scrollFactorY = 0;
		this.laneSprite.setOrigin(0.5, 0);
		this.laneSprite.setScale(config.resolution);
		// this.laneSprite.setFlipX(this.side === "right");

		this.curbSprite = this.add.tileSprite(
			this.busLane + (this.side === "right" ? toRes(99) : -toRes(99)),
			0,
			config.theme.curbWidth,
			window.innerHeight - config.vPadding,
			getSheetKey("curb.png"),
			"curb.png"
		);
		this.curbSprite.scrollFactorY = 0;
		this.curbSprite.setOrigin(0.5, 0);
		this.curbSprite.setScale(config.resolution);

		if (!this.noHousesArea) {
			this.houseCurb = this.add.tileSprite(
				mirrorX(256, this.side),
				0,
				config.theme.houseCurbWidth,
				window.innerHeight - config.vPadding,
				getSheetKey("bushes.png"),
				"bushes.png"
			);
			if (this.side !== "right") this.houseCurb.setFlipX(true);
			this.houseCurb.scrollFactorY = 0;
			this.houseCurb.setOrigin(0.5, 0);
			this.houseCurb.setScale(config.resolution);
		}

		this.stoplight = new Stoplight(this);
		this.sign = new Sign(this);
		this.sign.alternateStats();
	}

	fadeColors(array, interval, duration) {
		if (this.colorFader) return false;
		this.colorFader = { colors: [], interval: interval, duration: duration, started: Date.now() };
		for (let i = 0; i < array.length; i++) {
			this.colorFader.colors.push(Phaser.Display.Color.HexStringToColor(array[i]));
		}
		this.colorFader.currentColor = 0;

		this.fadeColor();
	}

	fadeColor() {
		this.colorFader.step = 0;
		let startColor = this.colorFader.colors[this.colorFader.currentColor];
		let endColor =
			typeof this.colorFader.colors[this.colorFader.currentColor + 1] !== "undefined"
				? this.colorFader.colors[this.colorFader.currentColor + 1]
				: this.colorFader.colors[0];
		this.colorFader.tween = this.add.tween({
			targets: this.colorFader,
			duration: this.colorFader.interval,
			step: 25,
			onUpdate: () => {
				if (!this.colorFader) return false;
				if (Date.now() - this.colorFader.started > this.colorFader.duration) {
					this.colorFader.tween.stop();
					this.colorFader.tween.remove();
					this.resetFadeColors(this.colorFader.interval);
					this.colorFader = null;
					return false;
				}
				let color = Phaser.Display.Color.Interpolate.ColorWithColor(
					startColor,
					endColor,
					25,
					this.colorFader.step
				);
				this.drawFadeColors(color.r, color.g, color.b);
			},
			onComplete: () => {
				if (!this.colorFader) return false;
				this.colorFader.currentColor++;
				if (typeof this.colorFader.colors[this.colorFader.currentColor] === "undefined")
					this.colorFader.currentColor = 0;
				this.fadeColor();
			},
		});
	}

	drawFadeColors(r, g, b) {
		let color = new Phaser.Display.Color(r, g, b);
		let darkerColor = color.clone().darken(30);
		let lighterColor = color.clone().lighten(10);
		this.cameras.main.setBackgroundColor(color);
		this.pathSprite.setTintFill(lighterColor.color);
		this.curbSprite.setTintFill(lighterColor.color);
		this.laneSprite.setTintFill(darkerColor.color);
		if (!this.noHousesArea) this.houseCurb.setTintFill(color.color);
		for (let i = 0; i < this.doors.children.entries.length; i++) {
			let door = this.doors.children.entries[i];
			door.setFillStyle(darkerColor.color);
		}
	}

	resetFadeColors() {
		this.cameras.main.setBackgroundColor(this.backgroundColor);
		this.pathSprite.clearTint();
		this.curbSprite.clearTint();
		this.laneSprite.clearTint();
		if (!this.noHousesArea) this.houseCurb.clearTint();
		for (let i = 0; i < this.doors.children.entries.length; i++) {
			let door = this.doors.children.entries[i];
			door.setFillStyle(door.originalColor);
		}
	}

	streetCreate() {
		this.drawStreet();
		this.busLeavingInterval();
		this.busInsideInterval();
		this.clearDeletedInterval();
		this.deleteTxsInterval();
		this.deleteUnusedSpritesInterval();
		this.socket = getSocket(this.config).socket;

		this.socketConnectCount = 0;

		let socketInitInterval = setInterval(() => {
			if (!this.socket.connected) return;
			clearInterval(socketInitInterval);
			joinRoom(this.config, "transactions");
			this.socketStats(this.config);
			this.socket.emit("get-recent-house-txs", this.ticker);
			this.blockFactory.connect();

			if (!this.socketConnectCount) {
				this.time.addEvent({
					delay: 5000,
					callback: () => {
						if (this.statUpdateCount <= 0) {
							this.vue.isConnected = false;
							this.loaded = true;
						}
					},
				});
			}
			this.socketConnectCount++;
		}, 50);

		this.blockFactory.once("connected", async () => {
			this.blocksLoaded = true;
			await this.getPendingTxs(true);
			this.loaded = true;
		});

		this.blockFactory.on("error", () => {
			this.stopLoading();
		});

		this.blockFactory.on("deleteLinePerson", (tx) => {
			this.deleteLinePerson(tx, true);
		});

		this.blockFactory.on("deleteTxsFromBlock", (block) => {
			this.deleteTxsFromBlock(block);
		});

		this.blockFactory.on("fastProcessBlock", (block) => {
			this.fastProcessBlock(block);
		});

		this.blockFactory.on("addBlock", (data, sendNotification) => {
			this.vue.emitBlock(data);
			if (
				!document.hasFocus() &&
				sendNotification &&
				/*userSettings.globalSettings.notifications.value &&*/ userSettings[this.ticker + "Settings"]
					.blockNotifications.value
			) {
				let n = new Notification(i18n.t("messages.new-block", { ticker: this.ticker }), {
					body: "Height: " + data.height,
					icon:
						config.baseUrl +
						"static/img/singles/coin_logos/" +
						this.ticker.toLowerCase() +
						".png?v=" +
						process.env.VUE_APP_VERSION,
					timestamp: Math.floor(Date.now()),
				});
				n.onclick = function () {
					window.focus();
					this.close();
				};
			}
		});

		this.socket.on("disconnect", () => {
			clearTimeout(this.socketCheckTimeout);
			this.socketCheckTimeout = setTimeout(() => {
				this.loaded = true;
				this.vue.isConnected = this.socket.connected;
			}, 15000);
		});

		this.socket.on("get-recent-house-txs", async (id, error, data) => {
			if (data) {
				data.forEach(({ txs }) => {
					txs.forEach((tx) => this.vue.addTx(tx, true, true));
				});
			}
		});

		this.socket.on("deleteTxs", (data) => {
			for (let i = 0; i < data.length; i++) {
				this.deleteTxsPool[data[i]] = Date.now();
			}
		});
		this.socket.on("stat-updates", (ticker, key, value) => {
			if (!this.config.stats[key].socket) return;
			this.vue.stats[key].value = value;
			this.statUpdateCount++;
		});
		this.socket.on("tx", (data) => {
			// if(this.coin === "BitcoinCash") this.newTx(data);
			if (window.txStreetPhaser.streetController.hidden) {
				this.newTx(data, false, false);
			} else {
				this.newTx(data);
			}
		});
		// this.physics.world.setBounds(0,0,toRes(960),this.sceneHeight);
		this.cameras.main.setBounds(0, 0, toRes(960), this.sceneHeight);
		this.houses = this.add.group();
		this.doors = this.add.group();
		// this.tweenObjects = this.add.group();
		this.houseLogos = this.add.group();
		// this.gardens = this.add.group();

		this.correctLineTimeout();
		for (const key in this.bottomStats) {
			const stat = this.bottomStats[key];
			if (!stat.signTitle) stat.signTitle = i18n.t(this.ticker.toLowerCase() + "." + key, "en");
		}
		this.vue = new sideCtor({
			propsData: {
				coinConfig: this.config,
				stats: this.bottomStats,
				side: this.side,
				txFollowersHashes: this.txFollowersHashes,
			},
		});
		let nodeExists = document.getElementById("vue-" + this.ticker);
		if (!nodeExists) {
			let newNode = document.createElement("div");
			newNode.setAttribute("id", "vue-" + this.ticker);
			let vueApp = document.getElementById("vue-app");
			vueApp.appendChild(newNode);
		}
		this.vue.$mount("#vue-" + this.ticker);
		this.blockchain = this.config.liveBlocks;

		this.streetWake(this.side);
		this.resize();

		this.touchedObject = null;
		this.input.on("gameobjectdown", (pointer, gameObject) => {
			let down = pointer.downElement.nodeName.toLowerCase();
			if (down !== "canvas") return false;
			this.touchedObject = gameObject;
			let type = gameObject.clickObject;
			if (type == "person") {
				let txData = gameObject.getLineData("txData");
				this.vue.txWindow(txData);
			}
		});
		this.input.on("gameobjectup", (pointer, gameObject) => {
			let down = pointer.downElement.nodeName.toLowerCase();
			if (down !== "canvas") return false;
			let previousTouch = this.touchedObject;
			this.touchedObject = null;
			if (gameObject !== previousTouch) return false;
			let type = gameObject.clickObject;
			if (type == "house") {
				this.vue.toggleWindow(gameObject.name);
			} else if (type == "bus") {
				let height = gameObject.getData("id");
				this.vue.blockWindow(height);
			} else if (type == "stoplight") {
				this.vue.wikiWindow(i18n.t("general.blockchain"), ["common/blockchain"]);
			} else if (type == "segwit") {
				this.vue.wikiWindow("Segwit", ["common/segwit"]);
			} else if (type == "mweb") {
				let height = gameObject.parentContainer.getData("id");
				let key = "mweb-block-" + height;
				let components = [{
					name: "Block",
					key: key,
					props: {
						data: height,
						windowKey: key,
						mwebOnly: true
					},
				}, {
					name: "Spacer",
					props: {
						size: "2rem",
					}
				},
				{
					name: "LoadWiki",
					key: "LTC/mweb",
					props: {
						path: "LTC/mweb",
					}
				}];

				let data = {
					key: "LTCmweb" + height,
					title: "MWEB Block #" + height,
					components: components,
					// classes: "transparent",
					styles: {
						width: "35rem",
					},
				};
				this.vue.createWindowData(data);




				// this.vue.wikiWindow("MWEB", ["LTC/mweb"]);
			} else if (type == "popup") {
				if (gameObject.person) {
					let txData = gameObject.person.getLineData("txData");
					this.vue.txWindow(txData);
				}
				gameObject.bye();
			}
		});
		// const postFxPlugin = this.plugins.get('rexOutlinePipeline');
		this.input.on("gameobjectover", (pointer, gameObject) => {
			gameObject.hovered = true;
			let type = gameObject.clickObject;
			if (type == "bus") {
				this.busInsideSingle(gameObject);
				// gameObject.openTop();
			} else if (type == "mweb") {
				gameObject.parentContainer.hovered = true;
				this.busInsideSingle(gameObject.parentContainer);
			}
		});
		this.input.on("gameobjectout", (pointer, gameObject) => {
			gameObject.hovered = false;
			let type = gameObject.clickObject;
			if (type == "bus") {
				this.busInsideSingle(gameObject);
				// gameObject.closeTop();
			} else if (type == "mweb") {
				gameObject.parentContainer.hovered = false;
				this.busInsideSingle(gameObject.parentContainer);
			}
		});
		this.createCrowd();
	}

	stopLoading() {
		window.mainVue.loading = false;
		window.mainVue.loaded = false;
		window.mainVue.loadVisualizer = false;
		window.mainVue.loadError = true;
		window.txStreetPhaser.streetController.sleepAllStreets();
		this.loaded = false;
		this.socket.removeAllListeners();
		this.neededRooms(true);
	}

	afterSteetCreate() {
		if (config.theme.effects) {
			for (let i = 0; i < config.theme.effects.length; i++) {
				const effect = config.theme.effects[i];
				if (this[effect]) this[effect]();
			}
		}
	}

	streetWake(side) {
		let oldSide = this.side;
		this.side = side;
		this.vue.side = side;
		this.vue.hidden = false;
		this.vue.resetWindows();
		this.initSide();
		this.generateLine(this.lineLength);
		if (oldSide != side) {
			this.pathSprite.x = this.side == "right" ? toRes(192) : toRes(this.noHousesArea ? 0 : 256);
			this.laneSprite.x = this.busLane;
			this.curbSprite.x = this.busLane + (this.side === "right" ? toRes(99) : -toRes(99));
			if (this.crowd) {
				this.crowd.x = this.side === "right" ? this.curbX : this.curbX - toRes(372);
				if (this.crowdSign) this.crowdSign.x = this.crowd.x;
			}
			if (!this.noHousesArea) this.houseCurb.x = mirrorX(256, this.side);
			this.stoplight.recreate();
			this.sign.recreate();
			this.switchBuses(oldSide, side);
			this.resume();
			this.scrollY(-this.sceneHeight);
			this.events.emit("changeSide", side);
		} else {
			if (typeof this.lastSleep !== "undefined" && Date.now() / 1000 - this.lastSleep > 30) {
				this.resume();
			}
			//TODO if changed back to another street with same side, if long enough time passed, do resume()
		}
		this.setConnected();
	}

	streetSleep() {
		this.lastSleep = Date.now() / 1000;
		this.vue.hidden = true;
		this.hasBeenDisconnected = true;
		this.neededRooms(true);
	}

	async getPendingTxs(initial = true) {
		if (!this.vue.isConnected && !initial) return false;
		try {
			let response = await fetch(
				`${process.env.VUE_APP_REST_API}/static/live/pendingTxs-${this.ticker}`
			);
			let json = await response.json();

			if (json) {
				this.addPendingTxs(json, initial);
			}
		} catch (error) {
			console.log(error);
			if (initial) this.stopLoading();
			return false;
		}
		return true;
	}

	countAvailablePeople() {
		let count = 0;
		for (let i = 0; i < this.people.children.entries.length; i++) {
			const person = this.people.children.entries[i];
			if (!person.isInUse() && !person.active) count++;
		}
		// console.log(count);
		return count;
	}

	createPeople() {
		this.people = this.add.group({
			classType: Person,
			maxSize: this.lineLength + 1000,
			// maxSize: 10,
			runChildUpdate: false,
			active: false,
			visible: false,
		});
		this.people.createMultiple({ key: getSheetKey("person-"), quantity: 2000, active: false, visible: false });
		this.people.setDepth(this.personDepth);

		//add more people at once to the group if there aren't many available, so the `get` call doesn't use up resources
		this.time.addEvent({
			delay: 10000,
			callback: function () {
				let available = this.countAvailablePeople();
				if (available < 1000) {
					this.people.createMultiple({ key: getSheetKey("person-"), quantity: 1000, active: false, visible: false });
					this.people.setDepth(this.personDepth);
				}
			},
			callbackScope: this,
			loop: true,
		});

		this.time.addEvent({
			startAt: 399,
			delay: 400,
			callback: function () {
				this.checkView();
			},
			callbackScope: this,

			loop: true,
		});
	}

	createBuses() {
		this.buses = this.add.group({
			classType: Bus,
			maxSize: 100,
			runChildUpdate: false,
			active: false,
			visible: false,
		});
		this.busFloors = this.add.group();
		this.buses.setDepth(this.topDepth);
	}

	switchBuses(oldSide, newSide) {
		if (oldSide != "right" && newSide != "right") return false; //no need to change the buses sides

		for (let i = 0; i < this.buses.children.entries.length; i++) {
			const bus = this.buses.children.entries[i];
			bus.switchSide(newSide);
		}
	}

	addBus(atStop = true) {
		// console.log("add a bus");
		let newBus = this.buses.get();
		newBus.newBus(atStop);
		return newBus;
	}

	calcBusHeight(size) {
		return (size / 1000000) * 195 - 115;
	}

	calcBusHeightFromBlock(block) {
		return this.calcBusHeight(typeof block.stippsedsize !== "undefined" ? block.strippedsize : block.size);
	}

	firstBusWaiting() {
		for (let i = 0; i < this.buses.children.entries.length; i++) {
			const bus = this.buses.children.entries[i];
			if (bus.getData("leaving")) continue;
			if (!bus.active) continue;
			return bus;
		}
		return false;
	}

	lastBus() {
		if (!this.buses) return;
		let lastBus = null;
		for (let i = 0; i < this.buses.children.entries.length; i++) {
			const bus = this.buses.children.entries[i];
			if (bus.active) {
				if (!lastBus || bus.y > lastBus.y) lastBus = bus;
			}
		}
		return lastBus;
	}

	lastBusLeaving() {
		if (!this.buses) return;
		let leavingBus = null;
		for (let i = 0; i < this.buses.children.entries.length; i++) {
			const bus = this.buses.children.entries[i];
			if (bus.getData("leaving") && bus.active) {
				if (!leavingBus || bus.y > leavingBus.y) leavingBus = bus;
			}
		}
		return leavingBus;
	}

	busLeavingUpdate() {
		if (!this.buses) return;
		//last bus leaving
		let bus = this.lastBusLeaving();
		if (!bus) return false;

		//check if past the bus stop and then set the light to yellow
		if (bus.y < this.busStop && !bus.hasTriggeredLight) {
			this.stoplight.setLight("yellow");
			bus.hasTriggeredLight = true;
			this.setRedLight = this.time.addEvent({
				delay: 2000 * window.txStreetPhaser.streetController.fpsTimesFaster,
				callback: () => {
					if (this.stoplight.currentColor == "yellow") {
						this.setRedLight = null;
						this.stoplight.setLight("red");
					}
				},
			});
		}
	}

	replayTx(data) {
		this.deleteLinePerson(data.tx, true);
		this.newTx(data);
		console.log(this.lineManager[data.tx]);
	}

	loadNFTSprite(sprite, collection, id, pixelArt = false) {
		let key = collection + '-' + id;
		if (this.textures.exists(key)) {
			if (sprite) sprite.setTexture(key);
			return sprite;
		}
		if (sprite) sprite.setVisible(false);
		this.load.image(key, process.env.VUE_APP_STORAGE_URL + collection + "/" + id);
		this.load.once(Phaser.Loader.Events.COMPLETE, () => {
			if (pixelArt)
				this.textures.list[key].setFilter(Phaser.Textures.FilterMode.NEAREST);
			if (sprite) {
				sprite.setTexture(key);
				sprite.setVisible(true);
			}
			this.loadedNFTSprites[key] = true;
		});
		this.load.start();

		return sprite;
	}


	newTx(data, status = "new", addPerson = true, addToVue = true) {
		//TODO, when no fee, set it to average
		if (this.lineManager[data.tx]) return false;

		this.customCallback("newTx", "before", data);
		// console.log(data.ty);
		this.config.getAndApplyFee(data);
		let spot = this.inLineCount(false, 1, !addPerson);
		if (spot > this.lineLength) {
			spot = this.lineLength;
			if (addPerson) {
				// status = "pending";
				addPerson = false;
			}
		}

		let modSize = this.getModSize(data);
		// const animals = ["bat", "bear", "bull", "frog", "lion", "lizard", "monkey", "penguin", "unicorn", "wolf"];
		// data.char = animals[Math.floor(Math.random() * animals.length)];

		if (data.h === "donation") {
			delete data.h;
		}

		if (data?.e?.mailman) {
			data.char = "mailman";
		}

		if (data.char && userSettings.globalSettings.nfts.value) {
			const charSplit = data.char.split("-")
			const potentialChar = charSplit.length > 1 ? charSplit.slice(0, -1).join("-") : data.char;
			if (this.charConfig[potentialChar] && charSplit[charSplit.length - 1]) {
				data.char = {
					sheet: potentialChar,
					texture: charSplit[charSplit.length - 1] + ".png",
				};
				this.loadNFTSprite(false, data.char.sheet, data.char.texture, this.charConfig[potentialChar].pixelArt);
			}
			else if (!this?.textures?.list?.characters?.frames?.[potentialChar + "-0.png"]) {
				//check if texture exists on default sheet
				console.log("deleted " + data.char, potentialChar + "-0.png");
				delete data.char;
			}
		}
		data.charType = data?.char?.sheet || "default";

		data.spriteNo = data.char && userSettings.globalSettings.nfts.value ? data.char : window.txStreetPhaser.streetController.generateSpriteNo();
		data.random = Math.random();
		data.maxScale = this.setMaxScalePerson(false, modSize);
		// //first create entry in line manager
		let newLineEntry = {
			txData: data,
			spot: spot,
			status: status,
			boarded: null,
			destination: false,
			person: null,
			deleted: false,
			modSize: modSize,
		};

		this.lineManager[data.tx] = newLineEntry;
		if (addToVue) this.vue.addTx(data);
		if (addPerson) {
			this.newPerson(newLineEntry);
		}

		this.customCallback("newTx", "after", data);
		return newLineEntry;
	}

	getUnusedPerson() {
		for (let i = 0; i < this.people.children.entries.length; i++) {
			const person = this.people.children.entries[i];
			if (person.active || person.isInUse()) continue;
			return person;
		}
		let person = new Person(this);
		this.people.add(person);
		return person;
	}

	newPerson(lineEntry) {
		let data = lineEntry.txData;
		if (this.lineManager[data.tx].person !== null) {
			this.deleteLinePerson(data.tx);
		}

		if (this.lineManager[data.tx].deleted || lineEntry.status == "pending") {
			//there is already a person for this entry
			return false;
		}

		let person = this.getUnusedPerson();
		person.animsEnabled = true;
		if (typeof lineEntry.txData.char === "object" || !userSettings.globalSettings.animations.value)
			person.animsEnabled = false;

		if (!person) {
			this.lineManager[data.tx].status = "waiting";
			// this.lineManager[data.tx].status = "pending";
			return false;
		}
		let boarded = this.lineManager[data.tx].boarded;
		person.resetData(data);
		person.setInitialPosition(lineEntry.status, boarded);
		if (lineEntry.status != "waiting") person.resetMoveList();

		if (lineEntry.status == "new") {
			person.createMoveList();
			return person;
		} else if (lineEntry.status == "waiting") {
			person.scaleSprite(person.getData("maxScale"));
			person.wait(true);
			return person;
		} else if (lineEntry.status == "change_bus") {
			let bus = this.getBusFromId(boarded);
			if (!bus) {
				//bus doesn't exist, so just move them to the correct bus
				person.enterBus(this.lineManager[data.tx].destination, false);
				return true;
			}
			if (person.animsEnabled) person.play("walk_up_0");
			person.changeBus(boarded, this.lineManager[data.tx].destination);
			return person;
		} else if (lineEntry.status == "exit_bus") {
			let bus = this.getBusFromId(boarded);
			if (!bus) {
				//bus doesn't exist, so spawn as new person
				this.lineManager[lineEntry.txData.tx].status = "new";
				return this.newPerson(lineEntry);
			}
			if (person.animsEnabled) person.play("walk_up_0");
			person.exitBus(boarded);
			return person;
		}
	}

	setMaxScalePerson(person = false, txSize) {
		let scale = 0.35;
		if (txSize < 200) {
			scale = 0.35;
		} else if (txSize < 500) {
			scale = 0.4;
		} else if (txSize < 1000) {
			scale = 0.45;
		} else if (txSize < 5000) {
			scale = 0.55;
		} else if (txSize < 10000) {
			scale = 0.65;
		} else if (txSize < 100000) {
			scale = 0.8;
		} else {
			scale = 1;
		}
		if (person) person.setData("maxScale", scale);
		return scale;
	}

	getPersonFromHash(hash) {
		if (!this.lineManager[hash]) return false;
		return this.lineManager[hash].person;
	}

	getBusFromId(boardingIndex) {
		if (typeof this.busIdCache[boardingIndex] !== "undefined") {
			if (this.busIdCache[boardingIndex].x === "undefined" || !this.busIdCache[boardingIndex].x) {
				//TODO replace x with something else, used to be body
				this.busIdCache = {};
			} else {
				return this.busIdCache[boardingIndex];
			}
		}

		for (var i = 0; i < this.buses.children.entries.length; i++) {
			let bus = this.buses.children.entries[i];
			if (!bus.active) continue;
			let busId = bus.getData("id");
			if (boardingIndex == busId) {
				this.busIdCache[boardingIndex] = bus;
				return bus;
			}
		}
		return false;
	}

	resize() {
		//left is defaults
		var xStart = 0;
		if (this.side == "right") {
			xStart = toRes(960);
		}
		let newWidth = userSettings.globalSettings.resWidth.value;
		if (this.side == "full") {
			newWidth /= 2;
			let ratio = window.innerHeight / window.innerWidth;
			let minRatio = 0.35;
			if (ratio < minRatio) ratio = minRatio;
			if (ratio < 1) {
				//landscape, put width = height
				newWidth /= ratio;
				xStart = newWidth / 2 - (newWidth * ratio) / 2;
			} else {
				xStart = 0;
			}
		}
		let newHeight = (newWidth / window.innerWidth) * (window.innerHeight - config.vPadding);

		window.txStreetPhaser.scale.setGameSize(newWidth, newHeight);
		this.cameras.main.setViewport(xStart, 0, toRes(960), newHeight);

		newHeight = toResRev(newHeight);
		this.pathSprite.height = newHeight;
		this.laneSprite.height = newHeight;
		this.curbSprite.height = newHeight;
		if (!this.noHousesArea) this.houseCurb.height = newHeight;
	}

	scrollY(amount, reset = false) {
		if (this.isFollowerFocused()) {
			if (!this.scrollWarnCount) this.scrollWarnCount = 0;
			this.scrollWarnCount++;
			if (this.scrollWarnCount > 15) {
				window.mainVue.$toast.warning(
					{
						component: Notification,
						props: {
							title: "Stop tracking to scroll.",
						},
					},
					{
						position: "bottom-center",
						id: "track-scroll",
					}
				);
				this.scrollWarnCount = 0;
			}
			return false;
		}
		this.scrollWarnCount = 0;
		//TODO easter egg so they can scroll up
		if (this.cameras.main.scrollY + amount < 0 || reset) amount = -this.cameras.main.scrollY;
		let newHeight =
			((this.side == "full" ? toRes(960) : toRes(1920)) / window.innerWidth) *
			(window.innerHeight - config.vPadding);
		if (this.cameras.main.scrollY + newHeight + amount > this.sceneHeight)
			amount = this.sceneHeight - (this.cameras.main.scrollY + newHeight);

		let xPos = this.cameras.main.scrollX;
		let yPos = this.cameras.main.scrollY + amount;
		// this.cameras.main.setPosition(xPos, yPos);

		this.scrollTileSprites(amount, reset);
		this.cameras.main.setScroll(xPos, yPos);
		if (Math.abs(amount) > 4) this.checkView();
		this.events.emit("scrollY", { amount: amount, reset: reset });
	}

	scrollTileSprites(amount, reset) {
		amount = toResRev(amount);

		this.pathSprite.setTilePosition(
			this.pathSprite.tilePositionX,
			reset ? amount : this.pathSprite.tilePositionY + amount
		);
		this.curbSprite.setTilePosition(
			this.curbSprite.tilePositionX,
			reset ? amount : this.curbSprite.tilePositionY + amount
		);
		if (config.theme.scrollHouseCurb && !this.noHousesArea) {
			this.houseCurb.setTilePosition(
				this.houseCurb.tilePositionX,
				reset ? amount : this.houseCurb.tilePositionY + amount
			);
		}
		if (config.theme.scrollLane) {
			this.laneSprite.setTilePosition(
				this.laneSprite.tilePositionX,
				reset ? amount : this.laneSprite.tilePositionY + amount
			);
		}
	}

	checkView() {
		let cameraY = this.cameras.main.scrollY;
		let cameraHeight = this.cameras.main._height;
		let bottom = cameraY + cameraHeight;

		this.events.emit("checkView", { cameraY: cameraY, bottom: bottom });

		let topMeasure = cameraY - toRes(15);
		let bottomMeasure = bottom + toRes(50);
		for (let i = 0; i < this.people.children.entries.length; i++) {
			let person = this.people.children.entries[i];
			if (!person.isInUse()) continue;
			if (person.y < topMeasure || person.y > bottomMeasure) {
				if (person.status == "teleporting") continue;
				if (person.visible) {
					person.setOffScreen();
				}
			} else {
				if (!person.visible) {
					person.setOnScreen();
				}
			}
		}

		topMeasure = cameraY - toRes(50);
		bottomMeasure = bottom + toRes(100);

		if (this.buses) {
			for (let i = 0; i < this.buses.children.entries.length; i++) {
				let bus = this.buses.children.entries[i];
				if (!bus.active) continue;
				if (
					bus[bus.bottomSpriteName].getBottomLeft(null, true).y < topMeasure ||
					bus.busTopSprite.getTopLeft(null, true).y > bottomMeasure
				) {
					if (bus.visible) {
						bus.setVisible(false);
						bus.busFloor.setVisible(false);
						this.busInsideSingle(bus);
					}
				} else {
					if (!bus.visible) {
						bus.setVisible(true);
						bus.busFloor.setVisible(true);
						this.busInsideSingle(bus);
					}
				}
			}
		}

		if (this.houses) {
			for (let i = 0; i < this.houses.children.entries.length; i++) {
				let house = this.houses.children.entries[i];
				if (house.y < topMeasure || house.y > bottomMeasure) {
					if (house.visible) {
						house.setVisible(false);
						house.door.setVisible(false);
						house.logo.setVisible(false);
						if (house.ethPost) house.ethPost.setVisible(false);
						if (house.overlay) house.overlay.setVisible(false);
					}
				} else {
					if (!house.visible) {
						house.setVisible(true);
						house.door.setVisible(true);
						house.logo.setVisible(true);
						if (house.ethPost) house.ethPost.setVisible(true);
						if (house.overlay) house.overlay.setVisible(true);
					}
				}
			}
		}

		if (this.crowd) {
			if (
				!this
					.crowdCount /*|| this.crowd.y + (this.crowdHeight / window.txStreetPhaser.streetController.crowdScale) < topMeasure*/ ||
				this.crowd.y > bottomMeasure
			) {
				this.crowd.setVisible(false);
				this.crowdSign.setVisible(false);
			} else {
				this.crowd.setVisible(true);
				let spaceBetween = 336;
				let crowdCount = this.crowdCount / window.txStreetPhaser.streetController.pplPerBlitter;
				let maxCrowds = this.sceneHeight / toRes(spaceBetween);
				if (crowdCount > maxCrowds) crowdCount = maxCrowds;
				for (let i = 0; i < crowdCount; i++) {
					const positionY = i * toRes(spaceBetween);
					if (
						positionY + toRes(spaceBetween) + this.crowd.y < topMeasure ||
						positionY + this.crowd.y > bottomMeasure
					) {
						if (this.crowd.positions[i]) {
							this.crowd.positions[i].setVisible(false);
							if (i === 0) {
								this.crowdSign.setVisible(false);
								this.crowd.leftPole.setVisible(false);
								this.crowd.rightPole.setVisible(false);
							}
						}
					} else {
						if (!this.crowd.positions[i]) {
							let sourceTexture =
								window.txStreetPhaser.streetController.crowdTextures[
								(i + (this.side === "right" ? 1 : 0)) %
								window.txStreetPhaser.streetController.crowdTextures.length
								];
							this.crowd.positions[i] = this.add.renderTexture(
								0,
								0,
								sourceTexture.origWidth,
								sourceTexture.origHeight
							);
							this.crowd.add(this.crowd.positions[i]);
							this.crowd.positions[i].draw(sourceTexture);
							this.crowd.positions[i].setPosition(0, positionY);
						}
						this.crowd.positions[i].setVisible(true);
						if (i === 0) {
							this.crowdSign.setVisible(true);
							this.crowd.leftPole.setVisible(true);
							this.crowd.rightPole.setVisible(true);
						}
					}
				}
			}
		}
	}

	findBoarding() {
		var foundBoarding = false;

		let bus = this.buses.children.entries[0];
		//get lowest block bus

		let activeBuses = this.activeBuses(false);
		for (var i = 0; i < activeBuses.length; i++) {
			let busCheck = activeBuses[i];
			if (busCheck.getData("id") < bus.getData("id") && busCheck.y < bus.y) {
				bus = busCheck;
			}
		}
		if (!bus) return false;
		if (!bus.active || bus.y > this.busStop + toRes(150)) {
			this.foundBoarding = false;
			return false;
		}

		if (bus.loaded < this.config.busCapacity && !bus.getData("leaving")) {
			this.boarding.index = bus.getData("id");
			//TODO just check if moving
			if (
				/*bus.body.velocity.y < 1 && bus.body.velocity.y > -1 &&*/ bus.getAge() > 1000 &&
				!this.processingBlock /* && !this.noBoarding*/
			) {
				this.boarding.y = bus.busTopSprite.getTopLeft(null, true).y + this.busDoorFromTop;
				foundBoarding = true;
				bus.doorOpen();
			} else {
				foundBoarding = false;
				this.boarding.y = this.busStop + this.busDoorFromTop;
				bus.doorClose();
			}
		} else {
			bus.doorClose();
		}

		this.foundBoarding = foundBoarding;
		return foundBoarding;
	}

	getBoardingY() {
		return this.boarding.y;
	}

	resetInLineCount() {
		this.inLineCountValues = { waiting: 0, all: 0 };
	}

	inLineCount(waiting, increase = false, override = false) {
		//TODO speed up when line is long
		let value = this.inLineCountValues[waiting ? "waiting" : "all"];
		if (override || (Number.isInteger(value) && value > 0)) {
			if (increase) this.inLineCountValues[waiting ? "waiting" : "all"] += increase;
			return this.inLineCountValues[waiting ? "waiting" : "all"];
		}
		var count = 0;
		for (var hash in this.lineManager) {
			let entry = this.lineManager[hash];
			if (entry.deleted) continue;
			if (entry.status == "pending") continue;
			if (entry.boarded) continue;
			if (entry.destination) continue;
			if (!entry.person || !entry.person.isInUse() || !entry.status) continue;
			if (
				(entry.spot > 0 && entry.spot != "bus" && entry.status == "waiting" && waiting) ||
				(entry.status !== "end_bus" &&
					entry.status !== "on_bus" &&
					entry.status !== "boarding" &&
					entry.status !== "skipLine" &&
					entry.status !== "change_bus" &&
					!waiting)
			) {
				count++;
			}
		}
		this.inLineCountValues[waiting ? "waiting" : "all"] = count;
		return count;
	}

	setCrowdY(y) {
		if (y === this.crowd.rawY) return false;
		if (y < this.crowd.rawY) {
			this.crowd.changeLowerCount++;
			if (this.crowd.changeLowerCount < 10) return false;
		}
		this.crowd.changeLowerCount = 0;
		this.crowd.y = y + toRes(100);
		this.crowd.rawY = y;
		if (this.crowd.y < toRes(1000)) this.crowd.y = toRes(1000);
		this.crowd.y = Math.ceil(this.crowd.y / toRes(50)) * toRes(50);
		this.crowdSign.y = this.crowd.y - toRes(30);
		this.crowdSign.x = this.crowd.x;
		this.checkView();
	}

	peoplePerRow(row) {
		let maxPeoplePerRow = 20;
		let ifRowStart = 0;
		let ifRowIncrement = 1;
		for (let i = 0; i < maxPeoplePerRow; i++) {
			if (row >= ifRowStart && row <= ifRowStart + ifRowIncrement) return i;

			ifRowStart += ifRowIncrement + 1;
			if (i == 6) ifRowIncrement++;
			if (i == 12) ifRowIncrement++;
			if (i == 18) ifRowIncrement++;
		}

		return maxPeoplePerRow;
	}

	rowFromCount(count) {
		let row = 1;
		let peopleCounted = 0;
		while (peopleCounted < count) {
			let rowCount = this.peoplePerRow(row);
			peopleCounted += rowCount;
			row++;
		}
		return row - 1;
	}

	generateLine(value) {
		let boardingSide = this.side == "left" || this.side == "full" ? this.curbX - 1 : this.curbX + 1;
		let oppositeSide =
			this.side == "left" || this.side == "full" ? this.walkingLane + toRes(32) : this.walkingLane - toRes(32);
		let xSeperator = toRes(17);
		let ySeperator = toRes(17);
		let row = 0;
		let column = 0;

		this.lineStructure = [];
		for (let i = 0; i < value; i++) {
			let addedX = column * xSeperator + Math.random() * toRes(20);
			let addedY = row * ySeperator + Math.random() * toRes(20);
			let x = Math.round(boardingSide + (this.side == "left" || this.side == "full" ? -addedX : addedX));
			let y = Math.round(this.busStop + addedY);

			this.lineStructure.push([x, y]);

			column++;
			if (
				column >= this.peoplePerRow(row) ||
				((this.side == "left" || this.side == "full") && x < oppositeSide) ||
				(this.side == "right" && x > oppositeSide)
			) {
				row++;
				column = 0;
			}
		}
	}

	deleteUnusedSpritesInterval() {
		this.time.addEvent({
			delay: 65000,
			callback: this.deleteUnusedSprites,
			callbackScope: this,
			loop: true,
		});
	}

	deleteUnusedSprites() {
		if (window.txStreetPhaser.streetController.hidden || this.game.scene.isSleeping(this)) return;
		if (!Object.keys(this.loadedNFTSprites).length) return;
		const needed = {};
		for (var hash in this.lineManager) {
			const entry = this.lineManager[hash];
			if (entry.txData?.char?.texture) {
				needed[entry.txData.char.sheet + "-" + entry.txData.char.texture] = true;
			}
		}
		for (const key in this.loadedNFTSprites) {
			if (!needed[key]) {
				this.textures.remove(key);
				delete this.loadedNFTSprites[key];
			}
		}
	}

	sortedLineHashes(sorted = true) {
		let hashArray = [];
		for (var hash in this.lineManager) {
			this.lineManager[hash].ignoreBusFee = false;
			hashArray.push(this.lineManager[hash]);
		}
		// let hashArray = Object.values(this.lineManager);
		if (sorted)
			hashArray.sort((a, b) => {
				return b.txData.feeVal - a.txData.feeVal;
			});
		return hashArray;
	}

	activeBuses(resetLoaded = true) {
		let arr = [];
		for (let i = 0; i < this.buses.children.entries.length; i++) {
			if (!this.buses.children.entries[i].active) continue;
			if (this.buses.children.entries[i].getData("leaving")) continue;
			if (resetLoaded) {
				this.buses.children.entries[i].loaded = 0;
				this.buses.children.entries[i].loadedAlt = 0;
				this.buses.children.entries[i].feeArray = [];
				this.buses.children.entries[i].tx = [];
				this.buses.children.entries[i].baseFee = null;
				this.buses.children.entries[i].feeText = null;
				this.buses.children.entries[i].feeText2 = null;
				this.buses.children.entries[i].lowFee = null;
				this.buses.children.entries[i].medianFee = null;
				this.buses.children.entries[i].highFee = null;
				this.buses.children.entries[i].txsOverride = null;
			}
			arr.push(this.buses.children.entries[i]);
		}
		return arr;
	}

	moveBusesToStop(createIfNone = true) {
		// console.log("moveBusesToStop");
		const activeBuses = this.activeBuses(false);
		if (!activeBuses.length) {
			if (!createIfNone) return false;
			activeBuses.push(this.addBus());
		}
		const firstActive = activeBuses[0];
		const difference = firstActive.y - (this.busStop + toRes(140));
		let lastY = 0;
		if (difference < 2) return false;
		for (let i = 0; i < activeBuses.length; i++) {
			const bus = activeBuses[i];
			if (typeof bus?.movingTween?.destroy !== "undefined") bus.movingTween.destroy();
			if (typeof bus?.moveLengthActive?.destroy !== "undefined") bus.moveLengthActive.destroy();
			if (typeof bus?.moveLengthActive2?.destroy !== "undefined") bus.moveLengthActive2.destroy();

			if (i === 0) {
				bus.y -= difference;
			} else {
				bus.y = lastY + toRes(140);
			}
			lastY = bus[bus.bottomSpriteName].getBottomLeft(null, true).y;
			bus.busFloor.y = bus.y - toRes(100);
			bus.busFloor.setVisible(true);
			bus.brake();
			bus.backDoorClose();
			bus.doorClose();
		}
	}

	getFittingTxs(h, hashArray, spaceRemaining, skipTxs = {}) {
		let txs = [];
		for (let i = h; i < hashArray.length; i++) {
			if (spaceRemaining < 21000) break; //TODO replace 21000 based on coin
			let entry = hashArray[i];
			if (entry.deleted) continue;
			if (entry.status == "pending") continue;
			if (typeof skipTxs[entry.txData.tx] !== "undefined") continue;
			if (entry.modSize < spaceRemaining) {
				//it fits!
				spaceRemaining -= entry.modSize;
				entry.ignoreBusFee = true;
				txs.push(entry);
			}
		}
		return txs;
	}

	sortBusesLoadTx(entry, bus, instant) {
		let busId = bus.getData("id");

		let fee = this.config.getAndApplyFee(entry.txData);
		if ((typeof entry.ignoreBusFee === "undefined" || !entry.ignoreBusFee) && Boolean(fee)) {
			bus.feeArray.push(fee);
		}

		bus.tx.push(entry.txData);
		bus.loaded += entry.modSize;
		if (instant) {
			this.lineManager[entry.txData.tx].status = "on_bus";
			this.lineManager[entry.txData.tx].boarded = busId;
		}
		this.lineManager[entry.txData.tx].destination = busId;
		this.lineManager[entry.txData.tx].spot = "bus";
		this.customCallback("sortBusesLoadTx", "after", [entry, bus]);
	}

	getModSize(txData) {
		if (txData.modSize) return txData.modSize;
		return txData[this.sizeVar];
	}

	sortBuses(instant = false, hashArray = false) {
		if (!this.vue.isConnected) return false;
		if (!hashArray) hashArray = this.sortedLineHashes();
		if (typeof this.sortHashArrayCoin === "function") hashArray = this.sortHashArrayCoin(hashArray);

		let boardingBus = 0;
		let addingPeople = false;
		let peopleSizeAdded = 0;
		let peopleAdded = 0;

		//reset loaded on buses
		let activeBuses = this.activeBuses();
		let skipTxs = {};
		for (let i = 0; i < hashArray.length; i++) {
			let entry = hashArray[i];
			if (entry.txData?.e?.mweb) continue;
			if (typeof entry.modSize === "undefined") entry.modSize = this.getModSize(entry.txData);
			if (typeof skipTxs[entry.txData.tx] !== "undefined") continue;
			if (entry.txData.deleted) continue;

			//set to false first, will set to proper destination if needed
			if (!addingPeople) {
				if (activeBuses[boardingBus] && boardingBus < this.config.userSettings.maxBuses.value) {
					let bus = activeBuses[boardingBus];
					if (i === hashArray.length - 1) {
						//last one
						this.sortBusesLoadTx(entry, bus, instant);
						bus.realLoaded = bus.loaded;
						break;
					}
					if (bus.loaded + entry.modSize > this.config.busCapacity) {
						//search from here down to get smaller txs that fit
						let spaceRemaining = this.config.busCapacity - bus.loaded;
						let fitted = this.getFittingTxs(i + 1, hashArray, spaceRemaining);
						for (let j = 0; j < fitted.length; j++) {
							const fittedTx = fitted[j];
							this.sortBusesLoadTx(fittedTx, bus, instant);
							skipTxs[fittedTx.txData.tx] = true;
						}

						bus.realLoaded = bus.loaded;
						bus.loaded = this.config.busCapacity; //TODO set to actual loaded if not instant
						boardingBus++;
						i--;
						continue;
					}
					this.sortBusesLoadTx(entry, bus, instant);
				} else {
					//FIRST CHECK IF WE HAVE SPACE AVAILABLE FOR ANOTHER BUS, AND THAT LEFTOVER PEOPLE CAN FILL ENTIRE BUS
					let leftoverSize = 0;
					for (let j = i; j < hashArray.length; j++) {
						const entry2 = hashArray[j];
						if (entry2.txData.deleted) continue;
						if (entry2.status == "pending") continue;
						if (typeof entry2.modSize === "undefined") entry2.modSize = this.getModSize(entry2.txData);
						leftoverSize += hashArray[j].modSize;
					}
					if (
						leftoverSize >= this.config.busCapacity &&
						activeBuses.length < this.config.userSettings.maxBuses.value
					) {
						activeBuses.push(this.addBus());
						i--;
						continue;
					} else {
						addingPeople = true;
						if (instant) this.resetBoardingAndDestination(hashArray, i);
						this.sortLine(hashArray, i);
						i--;
						continue;
					}
				}
			} else {
				//check if we have added more than desired line amount, then send them to low fee line to disappear
				if (
					(peopleSizeAdded > this.config.busCapacity || peopleAdded > 1000) &&
					!this.txFollowers[entry.txData.tx]
				) {
					this.deleteLinePerson(entry.txData.tx, true);
					continue;
				}
				if (
					(peopleSizeAdded > this.config.busCapacity || peopleAdded > 1000) &&
					this.txFollowers[entry.txData.tx]
				) {
					this.lineManager[entry.txData.tx].spot = peopleAdded + 1;
				}

				peopleSizeAdded += entry.modSize;
				peopleAdded++;
				this.lineManager[entry.txData.tx].destination = false;
				if (instant) {
					this.lineManager[entry.txData.tx].status = "waiting";
					//add to line as person
					this.newPerson(this.lineManager[entry.txData.tx]);
				}
			}
		}

		if (typeof this.customSortBusTxs === "function") this.customSortBusTxs(hashArray, activeBuses, instant);

		let compare = this.getLineCords(peopleAdded)[1];
		this.setCrowdY(compare);

		//remove unused buses, and apply fees
		for (let i = activeBuses.length - 1; i >= 0; i--) {
			this.calcBusFees(activeBuses, i);
			if (!activeBuses[i].loaded) {
				activeBuses[i].bye();

				activeBuses.splice(i, 1);
			}
		}

		if (activeBuses.length === 1) {
			//only 1 bus
			let bus = activeBuses[0];
			if (this.vue.stats["mempool-bytes"] && bus.loaded < this.vue.stats["mempool-bytes"].value * 0.95) {
				bus.realLoaded = this.vue.stats["mempool-bytes"].value;
				if (bus.realLoaded > this.config.busCapacity) bus.realLoaded = this.config.busCapacity;
			}
			if (this.vue.stats["mempool-size"] && bus.tx.length < this.vue.stats["mempool-size"].value * 0.95) {
				bus.txsOverride = this.vue.stats["mempool-size"].value;
			}
		}

		//calculate how many extra endbuses to display based on mempool count and number of txs loaded
		const notDeleted = hashArray.filter((obj) => !obj.txData.deleted).length;
		const pplLeftover = this.bottomStats["mempool-size"].value - notDeleted;

		if (activeBuses.length > 0 && pplLeftover > 1000 && activeBuses[0].loaded === this.config.busCapacity) {
			this.crowdCount = pplLeftover;
			if (this.crowd.text)
				this.crowd.text.setText(i18n.t("messages.low-fee-line") + ": " + this.crowdCountDisplay());
		} else {
			this.crowdCount = 0;
		}
		let extraBuses = 0;
		this.updateAllBusPercent(activeBuses, extraBuses);
		this.vue.sortedCount++;
		this.busInside();
	}

	crowdCountDisplay() {
		return this.crowdCount;
	}

	createCrowd() {
		let scale = window.txStreetPhaser.streetController.crowdScale;
		let rWidth = window.txStreetPhaser.streetController.crowdWidth;

		this.crowd = this.add.container();
		this.crowdSign = this.add.container();
		this.crowdSign.setDepth(this.personDepth + 2);
		this.crowd.changeLowerCount = 0;
		this.crowd.x = this.side === "right" ? this.curbX : this.curbX - toRes(372);
		this.crowdSign.x = this.crowd.x;
		this.crowd.positions = {};
		this.crowd.cautionTape = this.add.tileSprite(
			toRes(4.5),
			0,
			rWidth * scale - toRes(8),
			toRes(64),
			getSheetKey("caution_tape.png"),
			"caution_tape.png"
		);
		this.crowd.cautionTape.setTileScale(toRes(1));
		this.crowd.cautionTape.setOrigin(0, 0.5);
		this.crowdSign.add(this.crowd.cautionTape);

		this.crowd.cautionBg = this.add.graphics();
		this.crowd.cautionBg.fillStyle(0xfbe116, 1);
		this.crowd.cautionBg.fillRoundedRect(toRes(96), -toRes(25), toRes(180), toRes(45), toRes(5));
		this.crowdSign.add(this.crowd.cautionBg);

		this.crowd.leftPole = this.add.image(0, toRes(-17), getSheetKey("sign_pole.png"), "sign_pole.png");
		this.crowd.leftPole.setScale(toRes(0.6));
		this.crowd.leftPole.setTint(0x1f1413);
		this.crowd.add(this.crowd.leftPole);

		this.crowd.rightPole = this.add.image(rWidth * scale, toRes(-17), getSheetKey("sign_pole.png"), "sign_pole.png");
		this.crowd.rightPole.setFlipX(true);
		this.crowd.rightPole.setScale(toRes(0.6));
		this.crowd.rightPole.setTint(0x1f1413);
		this.crowd.add(this.crowd.rightPole);

		this.crowd.text = this.add.text(rWidth * (scale / 2), -toRes(4), "Low Fee Line", {
			fontSize: toRes(18) + "px",
			fontFamily: "Arial, sans-serif",
			fill: "#000",
			metrics: {
				ascent: toRes(17),
				descent: toRes(4),
				fontSize: toRes(21),
			},
		});
		this.crowd.text.setOrigin(0.5);
		this.crowdSign.add(this.crowd.text);

		this.time.addEvent({
			delay: 900,
			callback: function () {
				let spot = this.inLineCount(false);
				let cords = this.getLineCords(spot);
				this.setCrowdY(cords[1]);
			},
			callbackScope: this,
			loop: true,
		});
	}

	getEarlierBusFee(activeBuses, index) {
		for (let i = index - 1; i >= 0; i--) {
			const bus = activeBuses[i];
			if (bus.feeArray.length) {
				return Math.min.apply(Math, bus.feeArray);
			}
		}
		return "?";
	}

	calcBusFees(activeBuses, i) {
		let bus = activeBuses[i];
		if (bus.feeArray.length) {
			bus.lowFee = Math.min.apply(Math, bus.feeArray);
			bus.medianFee = Math.round(median(bus.feeArray));
			bus.highFee = Math.max.apply(Math, bus.feeArray);
		} else {
			let earlierFee = this.getEarlierBusFee(activeBuses, i);
			bus.lowFee = earlierFee;
			bus.medianFee = earlierFee;
			bus.highFee = earlierFee;
		}
	}

	updateAllBusPercent(buses = this.buses.children.entries, fill = false) {
		for (let i = 0; i < buses.length; i++) {
			const bus = buses[i];
			if (fill) bus.loaded = this.config.busCapacity;
			bus.setFeeText();
		}
	}

	resetBoardingAndDestination(hashArray = false, startAt = 0) {
		if (!hashArray) hashArray = this.sortedLineHashes();
		for (let i = startAt; i < hashArray.length; i++) {
			let entry = hashArray[i];
			this.lineManager[entry.txData.tx].destination = false;
			this.lineManager[entry.txData.tx].boarded = false;
		}
	}

	sortLine(hashArray = false, startAt = 0) {
		if (!hashArray) hashArray = this.sortedLineHashes();

		let lineCount = 1;

		for (let i = startAt; i < hashArray.length; i++) {
			let entry = hashArray[i];
			if (entry.txData.deleted) continue;
			if (entry.status == "pending") continue;
			if (entry.boarded) continue;
			if (entry.destination) continue;
			this.lineManager[entry.txData.tx].spot = lineCount;
			lineCount++;
		}
		hashArray = null;
	}

	addPendingTxs(list, initial = true) {
		if (!this.config.busCapacity) {
			this.time.addEvent({
				delay: 50,
				callback: () => {
					this.addPendingTxs(list, initial);
				},
			});
			return false;
		}

		for (let i = 0; i < list.length; i++) {
			let tx = list[i];
			if (typeof this.lineManager[tx.tx] !== "undefined") continue;
			//hash is not found, create person
			let status = "waiting";
			this.newTx(tx, status, false);
		}
		if (initial) {
			this.resume();
			this.loadFollowers();
			this.checkBlockInterval();
		}
		this.lastGotPending = Date.now() / 1000;
	}

	getLineCords(spot) {
		let cords = this.lineStructure[spot];
		if (typeof cords === "undefined" || !cords || cords.length < 2) return this.lineStructure[1];
		return cords;
	}

	getLineSpotFromY(y) {
		for (let i = 0; i < this.lineStructure.length; i++) {
			const cords = this.lineStructure[i];
			if (cords[1] > y) return i;
		}
		return false;
	}

	correctLineTimeout() {
		this.checkBoardCount = 0;
		this.time.addEvent({
			delay: 1000,
			callback: function () {
				if (window.txStreetPhaser.streetController.hidden || this.game.scene.isSleeping(this)) return false;
				if (!this.vue.isConnected) return false;
				if (!this.loaded) return false;
				// return false
				if (window.txStreetPhaser.streetController.hidden) return false;
				this.checkBoardCount++;
				if (this.busesMoving) return false;
				let previousBoarding = this.foundBoarding;
				let newBoarding = this.findBoarding();

				if (this.processingBlock) return false;

				let lineSorted = false;
				//do we want to resort the line visually?
				//was normally % 100
				if (
					this.forceCorrectLine ||
					((newBoarding !== previousBoarding || this.checkBoardCount % 10 == 0) && this.checkBoardCount > 1)
				) {
					// if(this.forceCorrectLine || (newBoarding !== previousBoarding)){
					this.sortBuses();
					lineSorted = true;
					this.forceCorrectLine = false;
				}

				this.time.addEvent({
					delay: 160,
					callback: () => {
						this.correctLine(lineSorted);
						this.resetInLineCount();
					},
				});
			},
			callbackScope: this,
			loop: true,
		});
	}

	correctLine(lineSorted) {
		if (!this.vue.isConnected) return false;
		let foundBoarding = this.foundBoarding;
		if (this.busesMoving) return false;
		let allLineCount = this.inLineCount(false);
		let skipLineCount = 0;
		let peopleCreated = 0;
		this.resetInLineCount();
		for (var hash in this.lineManager) {
			if (this.lineManager[hash].txData.deleted) continue;
			let person = this.lineManager[hash].person;
			let status = this.lineManager[hash].status;
			if (status === "low_fee") continue;
			let spot = this.lineManager[hash].spot;
			let destination = this.lineManager[hash].destination;
			let boarded = this.lineManager[hash].boarded;
			let currentY = 0;
			let currentX = 0;
			let correctY = 0;
			let correctX = 0;
			if ((status == "to_board" || status == "waiting" || status == "teleporting") && person) {
				let moveInfo = person.data.values.moveInfo;

				if (
					person &&
					destination &&
					!foundBoarding /*&& busLoaded*/ &&
					!this.processingBlock &&
					person.boardAndSkipLine(skipLineCount, destination)
				) {
					skipLineCount++;
					continue;
				} else if ((status == "to_board" || status == "teleporting") && typeof moveInfo !== "undefined") {
					//they are moving
					currentY = moveInfo.y;
					currentX = moveInfo.x;
				} else {
					//they are still, so presumably in their correct place
					currentY = person.y;
					currentX = person.x;
				}

				if (foundBoarding || spot == "bus" || !Number.isInteger(spot)) {
					//correct cords will be at the bus stop
					correctY = this.boarding.y;
					correctX = this.boarding.x;
				} else {
					//correct cords will be at their place in line
					let cords = this.getLineCords(spot);
					correctY = cords[1];
					correctX = cords[0];
				}

				let totalDifference = Phaser.Math.Distance.Between(currentX, currentY, correctX, correctY);
				if (Math.round(totalDifference) > 5 || (status == "waiting" && foundBoarding)) {
					person.toBoardMove(true, lineSorted /* && status == "waiting"*/);
				}
			} else if (status == "end_bus" || (status == "on_bus" && person == null)) {
				if ((spot > 0 && spot != "bus") || !destination) {
					this.lineManager[hash].status = "exit_bus";
					this.newPerson(this.lineManager[hash]);
				} else if (boarded !== destination) {
					//TODO exit and then board other bus
					this.personChangeBus(hash);
				}
			} else if (
				lineSorted &&
				allLineCount < this.lineLength &&
				person == null &&
				peopleCreated < 500 &&
				(status == "pending" ||
					status == "to_board" ||
					status == "waiting" ||
					(status == "teleporting" && spot != "bus"))
			) {
				if (status == "pending" || !Number.isInteger(spot))
					this.lineManager[hash].spot = this.inLineCount(false, 1);
				if (this.lineManager[hash].spot > this.lineLength) continue;
				this.lineManager[hash].status = "waiting";
				this.newPerson(this.lineManager[hash]);
				peopleCreated++;
			}
		}
		this.changingBusCounts = {};
	}

	personChangeBus(hash) {
		let createPerson = true;
		let person = false;

		//find out if we should render the person changing bus or teleport
		// based on whether both destination and boarded are on screen or off screen
		const boardedBus = this.getBusFromId(this.lineManager[hash].boarded);
		if (!boardedBus.active || typeof boardedBus.getData === "undefined" || boardedBus.data.values.leaving) {
			this.lineManager[hash].txData.deleted = true;
			return false;
		}
		const destinationBus = this.getBusFromId(this.lineManager[hash].destination);
		if (boardedBus && destinationBus) {
			const onScreen = this.onScreen([boardedBus.y, destinationBus.y]);
			if (!onScreen[0] && !onScreen[1]) createPerson = false;
		}

		if (createPerson) {
			this.lineManager[hash].status = "change_bus";
			person = this.newPerson(this.lineManager[hash]);
		}

		if (!createPerson || !person) {
			//could not create person, teleport to other bus
			this.lineManager[hash].status = "on_bus";
			this.lineManager[hash].spot = "bus";
			this.lineManager[hash].boarded = this.lineManager[hash].destination;
		}
	}

	positionHouse(houseObj, houseY) {
		if (!this.lowestHouseY || houseY > this.lowestHouseY) this.lowestHouseY = houseY;

		let houseX = toRes(62);
		houseY = toRes(houseY);
		let flipHouse = false;
		if (this.side == "right") flipHouse = true;
		if (houseObj.side == 1) {
			houseX = toRes(this.side == "right" ? 760 : 200);
		} else {
			houseX = toRes(this.side == "right" ? 898 : 62);
		}
		if (houseObj.type === "mall") {
			houseX = toRes(this.side == "right" ? 873 : 87);
		}

		//set door position
		for (let i = 0; i < this.doors.children.entries.length; i++) {
			let door = this.doors.children.entries[i];
			if (door.name == houseObj.name) door.setPosition(houseX, houseY + toRes(38));
		}
		//set logo position
		for (let i = 0; i < this.houseLogos.children.entries.length; i++) {
			let houseLogo = this.houseLogos.children.entries[i];
			if (houseLogo.name == houseObj.name) {
				if (houseObj.type === "house")
					houseLogo.setPosition(houseX, houseY - toRes(23.5));
				if (houseObj.type === "mall")
					houseLogo.setPosition(this.side === "right" ? toRes(888) : toRes(72), houseY - toRes(36));
			}
		}
		//set house position
		for (let i = 0; i < this.houses.children.entries.length; i++) {
			let house = this.houses.children.entries[i];
			if (house.name == houseObj.name) {
				house.setPosition(houseX, houseY);
				house.setFlipX(flipHouse);
				if (house.overlay) {
					let heightDifference = house.overlay.displayHeight - house.displayHeight;
					house.overlay.setPosition(houseX, houseY + heightDifference / 2);
					house.overlay.setFlipX(flipHouse);
				}
				if (house.ethPost) {
					house.ethPost.setPosition(houseX + (toRes(115) * (this.side === "right" ? -1 : 1)), houseY - toRes(28));
				}
			}
		}
		this.housePlans[houseObj.name].spawn = [houseX, houseY];
	}

	createHouse(houseObj) {
		let path =
			// (config.locale === "en" ? "" : config.locale + "/") +
			this.config.ticker +
			"/" +
			houseObj.name;
		let houseComponents = [];
		if (this.housePlans[houseObj.name].dataSources && this.housePlans[houseObj.name].dataSources.includes("wiki")) {
			houseComponents.push({
				name: "LoadWiki",
				props: {
					path,
					initVisible: false,
				},
			});
		}

		if (this.housePlans[houseObj.name].dataSources && this.housePlans[houseObj.name].dataSources.includes("html")) {
			houseComponents.push({
				name: "LoadHtml",
				props: {
					url: process.env.VUE_APP_STORAGE_URL + "info/houses/" + this.ticker + "_" + houseObj.name + "/index.html",
				},
			});
		}
		//Iframe is for third party houses that are untrusted
		// {
		// 	name: "Iframe",
		// 	props: {
		// 		params: this.config.server,
		// 		url: this.config.server + "/static/f/houses/" + this.ticker + "_" + name + "/index.html"
		// 	},
		// },
		houseComponents.push({
			name: "Transactions",
			props: {
				house: [houseObj.name],
				ticker: this.config.ticker,
				txsEnabled: this.housePlans[houseObj.name]?.tracked,
				plans: this.housePlans[houseObj.name],
			},
		});
		this.vue.windowData.push({
			key: houseObj.name,
			title: this.housePlans[houseObj.name].title,
			components: houseComponents,
			styles: {
				width: "45rem",
				height: "45rem",
			},
		});
		let doorColor = Phaser.Display.Color.HexStringToColor(this.housePlans[houseObj.name].colors[0]).lighten(30).color;

		let doorWidth = houseObj.type === "house" ? 110 : 335;
		let doorHeight = houseObj.type === "house" ? 41 : 73;
		let door = this.add.rectangle(0, 0, doorWidth, doorHeight, doorColor, 1);
		door.name = houseObj.name;
		door.originalColor = doorColor;
		door.setDepth(this.bridgeDepth);
		door.setScale(config.resolution);
		this.doors.add(door);

		let logo = this.add.image(0, 0, getSheetKey("coin_logo"), houseObj.name + ".png", 40, 40);
		if (typeof this.housePlans[houseObj.name].colors[1] !== "undefined" && this.housePlans[houseObj.name].colors[1]) {
			if (this.housePlans[houseObj.name].colors[1] === "lighten") {
				logo.setTint(doorColor);
			} else {
				logo.setTint("0x" + this.housePlans[houseObj.name].colors[1]);
			}
		}
		logo.name = houseObj.name;
		logo.setDepth(this.topDepth + 5);
		logo.setScale(config.resolution);
		this.houseLogos.add(logo);

		let house;
		if (houseObj.type === "house") {
			house = this.add.image(0, 0, getSheetKey("house.png"), "house.png");
			if (config.theme.houseOverlay) {
				let houseOverlay = this.add.image(0, 0, getSheetKey("house_overlay.png"), "house_overlay.png");
				houseOverlay.setScale(config.resolution);
				houseOverlay.setDepth(this.topDepth + 5);
				houseOverlay.name = houseObj.name;
				house.overlay = houseOverlay;
			}
		} else if (houseObj.type === "mall") {
			house = this.add.image(0, 0, getSheetKey("mall.png"), "mall.png");
		}
		house.setTint("0x" + this.housePlans[houseObj.name].colors[0]);
		house.name = houseObj.name;
		house.setDepth(this.topDepth + 4);
		house.setInteractive({ useHandCursor: true });
		house.clickObject = "house";
		house.setScale(config.resolution);
		house.door = door;
		house.logo = logo;
		if (houseObj.type === "mall") {
			house.ethPost = this.add.image(0, 0, getSheetKey("eth_post.png"), "eth_post.png", 40, 40);
			house.ethPost.setTint(doorColor);
			house.ethPost.setDepth(this.topDepth + 5);
			house.ethPost.setScale(config.resolution);
			this.houseLogos.add(house.ethPost);
		}

		this.houses.add(house);
	}

	createHouses(houses) {
		this.houses.clear(true, true);
		this.doors.clear(true, true);
		this.houseLogos.clear(true, true);
		let sideCount = [0, 0];

		for (let i = 0; i < houses.length; i++) {
			let house = houses[i];
			if (house.side === 0) delete house.side;
			if (house.type === "mall") house.side = 0;
			if (typeof house.side == "undefined") {
				house.side = sideCount.indexOf(Math.min(sideCount[0], sideCount[1]));
			}
			this.housePlans[house.name] = house;
			sideCount[house.side]++;
			this.createHouse(house);
		}

		if (!houses.length) this.noHouses = true;
		this.housesCreated = true;
	}

	destroyAllPeople(resetStatus) {
		for (var hash in this.lineManager) {
			if (this.lineManager[hash].status == "pending") continue;
			this.deleteLinePerson(hash, false, true);
			if (resetStatus) this.lineManager[hash].status = resetStatus;
		}
		for (let i = 0; i < this.people.children.entries.length; i++) {
			let person = this.people.children.entries[i];
			person.bye(resetStatus);
		}
		this.resetInLineCount();
	}

	colorSpriteGroup(group, color, fill = false) {
		if (typeof this[group] === "undefined" || !Array.isArray(this[group].children.entries)) return false;
		for (let i = 0; i < this[group].children.entries.length; i++) {
			let sprite = this[group].children.entries[i];

			if (typeof sprite.tintObjects !== "undefined" || typeof sprite.fillObjects !== "undefined") {
				if (typeof sprite.tintObjects !== "undefined") {
					//it is a container
					for (let j = 0; j < sprite.tintObjects.length; j++) {
						let added = sprite.tintObjects[j];
						if (!color) {
							this.resetSpriteTint(added);
						} else {
							this.replaceSpriteTint(added, color, fill);
						}
					}
				}
				if (typeof sprite.fillObjects !== "undefined") {
					for (let j = 0; j < sprite.fillObjects.length; j++) {
						let added = sprite.fillObjects[j];
						if (!color) {
							added.setFillStyle(added.originalFill);
						} else {
							added.setFillStyle(color);
						}
					}
				}
			} else {
				if (!color) {
					this.resetSpriteTint(sprite);
				} else {
					this.replaceSpriteTint(sprite, color, fill);
				}
			}
		}
	}

	replaceSpriteTint(sprite, color, fill) {
		sprite.originalTint = sprite.tintTopLeft;
		sprite.originalTintFilled = sprite.tintFill;
		if (fill) {
			sprite.setTintFill(color);
		} else {
			sprite.setTint(color);
		}
	}

	resetSpriteTint(sprite) {
		if (typeof sprite.originalTint !== "undefined") {
			sprite.clearTint();
			if (sprite.originalTint != 16777215) {
				if (sprite.originalTintFilled) {
					sprite.setTintFill(sprite.originalTint);
					sprite.setTintFill(sprite.tintTopLeft);
				} else {
					//TODO bug where original tint is wrong but reads correct value
					sprite.setTint(sprite.originalTint);
					sprite.setTint(sprite.tintTopLeft);
				}
			}
		}
	}

	streetUpdate() {
		if (!this.vue.isConnected) return;
		for (let i = this.movingPeople.length - 1; i >= 0; i--) {
			const person = this.movingPeople[i];
			if (!person.isInUse()) {
				if (config.dev) console.log("moving inactive");
				person.bye();
				continue;
			}
			let moveList = person.moveList;
			let status = person.getLineData("status");
			if (!moveList.length) {
				person.resetMoveList();
				if (status == "on_bus" || status == "end_bus" || status == "waiting") {
					continue;
				}

				if (status != "to_board" && status != "teleporting") {
					person.toBoardMove(false, false);
				} else {
					if (!person.board()) {
						person.wait();
					}
				}
				continue;
			}

			let move = moveList[0];
			if (move.paused) {
				if (person.animsEnabled && !person.anims.paused) person.anims.pause();
				continue;
			}
			if (move.step >= move.totalSteps - 1) {
				if (move.status) person.setLineData("status", move.status);
				person.setPosition(move.x, move.y);
				person.moveList.shift();
				move.onComplete();
				continue;
			}
			if (move.step == 0) {
				if (move.status) person.setLineData("status", move.status);
				if (move.delay > 0) {
					if (person.animsEnabled && !person.anims.paused) person.anims.pause();
					move.delay -= 60 / this.game.loop.actualFps;
					continue;
				}
				move.onStart();
				person.setData("moveInfo", move);
				person.setFlipX(person.charConfig.defaultFlip);
				if (move.direction == "right" || move.direction == "left") {
					if (move.direction == "right") person.setFlipX(!person.charConfig.defaultFlip);
					move.direction = "side";
				}
				if (person.animsEnabled) {
					person.anims.timeScale = move.timeScale;
					person.anims.play("walk_" + move.direction + "_" + person.data.values.spriteNo, true);
				}
			}
			if (person.animsEnabled && person.anims.paused) person.anims.resume();
			person.x += move.stepX;
			person.y += move.stepY;
			move.step++;
			if (
				status === "boarding" &&
				!person.getData("boardedAnim") &&
				person.x > this.busDoorBetween[0] &&
				person.x < this.busDoorBetween[1]
			) {
				person.setData("boardedAnim", true);
				let busId = person.getData("boarding");
				let bus = this.getBusFromId(busId);
				if (bus && bus.boardedAnim) {
					bus.boardedAnim(person);
				}
			}
		}

		let msPerFrame = 20000 * window.txStreetPhaser.streetController.fpsTimesFaster;

		//people waiting anim
		if (userSettings.globalSettings.animations.value && this.time.now > this.nextPersonWaitingAnimUpdate) {
			let peopleWaiting = Phaser.Utils.Array.GetAll(this.people.getChildren(), "status", "waiting");
			let count = peopleWaiting.length;
			if (count > 0) {
				let person = Phaser.Utils.Array.GetRandom(peopleWaiting);
				if (typeof person !== "undefined" && person && typeof person.anims !== "undefined" && person.animsEnabled)
					person.anims.nextFrame();

				let nextDelay = msPerFrame / count;
				let nextUpdate = this.time.now + nextDelay;
				this.nextPersonWaitingAnimUpdate = nextUpdate;
			}
		}
	}

	resume() {
		clearTimeout(this.resumeTimeout);
		if (!this.blocksLoaded || typeof this.blockchain === "undefined" || !this.blockchain.length) {
			this.resumeTimeout = setTimeout(() => {
				this.resume();
			}, 5);

			return false;
		}

		this.loaded = false;
		this.busesMoving = false;
		this.stoplight.setLight("red");
		this.resetInLineCount();
		this.destroyAllPeople("waiting");
		this.removeTweens();
		this.busIdCache = {};

		this.fastProcessBlocks();
		this.moveBusesToStop();

		this.sortBuses(true);
		this.customCallback("resume", "after", this);
		this.resize();
		this.setConnected();
		this.loaded = true;
		if (!this.afterStreetCreatedCalled) {
			this.afterStreetCreatedCalled = true;
			this.afterSteetCreate();
		}
		this.checkView();
	}

	unpause() {
		this.vue.$refs.following.focusedTx = this.oldFocusedTx;
		this.startFollowers();
	}

	pause() {
		this.oldFocusedTx = this.vue.$refs.following.focusedTx;
		this.pauseFollowers();
	}

	pauseFollowers() {
		for (const hash in this.txFollowers) {
			const follower = this.txFollowers[hash];
			follower.pause();
		}
	}

	startFollowers() {
		for (const hash in this.txFollowers) {
			const follower = this.txFollowers[hash];
			follower.start();
		}
	}

	removeTweens() {
		for (let i = 0; i < this.tweens._active.length; i++) {
			let tween = this.tweens._active[i];
			if (tween.keep) continue;
			if (typeof tween.complete === "function") tween.complete();
		}
		this.customCallback("removeTweens", "after", this);
	}

	apiCall(url, method = "GET", body = false) {
		let request = {
			method: method,
		};
		if (body) {
			request.body = body;
			if (method == "POST") {
				request.headers = {
					Accept: "application/json",
					"Content-Type": "application/json",
				};
			}
		}
		const promise = fetch(url, request);
		let response = promise
			.then((res) => {
				if (res.status == 429) {
					window.mainVue.$toast.error(
						{
							component: Notification,
							props: {
								title: i18n.t("messages.slow-down"),
								html: i18n.t("messages.slow-down-2"),
							},
						},
						{
							position: "bottom-center",
						}
					);
					return false;
				}
				if (res.ok) return res.json();
				return false;
			})
			.catch(() => {
				return false;
			});
		return response;
	}

	apiTransaction(query) {
		let promise = this.apiCall(
			process.env.VUE_APP_REST_API + "/api/v2/blockchain/transactions/" + this.ticker + "/" + query
		);
		let response = promise.then((res) => {
			this.customCallback("newTx", "before", res);
			if (res.success) return res.data;
			return false;
		});
		return response;
	}

	apiBlock(query) {
		let promise = this.apiCall(
			process.env.VUE_APP_REST_API + "/api/v2/blockchain/blocks/" + this.ticker + "/" + query
		);
		let response = promise.then((res) => {
			if (res.success) return res.data;
			return false;
		});
		return response;
	}

	apiAddress(query) {
		let promise = this.apiCall(
			process.env.VUE_APP_REST_API + "/api/v2/blockchain/addresses/" + this.ticker + "/" + query
		);
		let response = promise.then((res) => {
			if (res.success) return res.transactions;
			return false;
		});
		return response;
	}

	followAddress(address, toggle = false) {
		address = this.formatAddr(address);
		let addressFollowed = Boolean(this.vue.$refs.following.followedAddresses[address]);
		if (addressFollowed && toggle) {
			this.vue.$refs.following.$delete(this.vue.$refs.following.followedAddresses, address);
		} else if (!addressFollowed) {
			this.vue.$refs.following.$set(this.vue.$refs.following.followedAddresses, address, true);
			for (let i = 0; i < this.config.liveTxs.length; i++) {
				const tx = this.config.liveTxs[i];
				if (tx.bh || tx.deleted || !this.lineManager[tx.tx]) continue;
				if (tx.to == address || tx.fr == address) {
					this.vue.$refs.following.followTx(tx.tx);
				}
			}
		}
		this.vue.$refs.following.saveAddresses();
	}

	addFollower(hash, follower) {
		if (this.txFollowers[hash]) return false;
		this.txFollowers[hash] = follower;
		this.txFollowersHashes.push(hash);
		this.saveFollowers();
	}

	removeFollower(hash, stop = false) {
		if (!this.txFollowers[hash]) return false;
		let follower = this.txFollowers[hash];
		if (!isNaN(stop)) {
			this.time.addEvent({
				delay: stop,
				callback: () => {
					follower.stop();
				},
			});
		}
		delete this.txFollowers[hash];
		this.txFollowersHashes.splice(this.txFollowersHashes.indexOf(hash), 1);
		this.saveFollowers();
		return true;
	}

	saveFollowers() {
		if (!this.lastGotPending) return false;
		localStorage.setItem(this.ticker + "-txFollowersHashes", JSON.stringify(this.txFollowersHashes));
	}

	loadFollowers() {
		let txFollowersHashes = localStorage.getItem(this.ticker + "-txFollowersHashes");
		if (!txFollowersHashes) return false;
		txFollowersHashes = JSON.parse(txFollowersHashes);
		for (let i = 0; i < txFollowersHashes.length; i++) {
			const hash = txFollowersHashes[i];
			if (!this.lineManager[hash]) {
				//remove
				continue;
			}
			this.vue.$refs.following.followTx(hash);
		}
	}

	isFollowerFocused() {
		for (const hash in this.txFollowers) {
			const follower = this.txFollowers[hash];
			if (follower.focused) return true;
		}
		return false;
	}

	onScreen(yArray, threshold = 15) {
		let cameraY = this.cameras.main.scrollY;
		let bottom = cameraY + this.cameras.main._height;
		let topMeasure = cameraY - toRes(threshold);
		let bottomMeasure = bottom + toRes(threshold);
		let results = [];
		for (let i = 0; i < yArray.length; i++) {
			let y = yArray[i];
			if (y < topMeasure || y > bottomMeasure) {
				results[i] = false;
			} else {
				results[i] = true;
			}
		}
		return results;
	}

	customCallback(functionName, position, obj) {
		let callbackName = position + functionName.charAt(0).toUpperCase() + functionName.slice(1);
		if (typeof this[callbackName] !== "function") return false;
		this[callbackName](obj);
		return true;
	}

	snowfall() {
		this.snowParticles = this.add.particles(getSheetKey("snow.png"));
		this.snowParticles.setDepth(this.topDepth + 100);
		this.snowParticleEmitter = this.snowParticles.createEmitter({
			frame: ["snow.png"],
			speedY: { min: toRes(20), max: toRes(22) },
			x: { min: 0, max: toRes(930) },
			y: -10,
			frequency: 900,
			lifespan: 400000,
			alpha: 0.4,
			scale: toRes(0.4),
			emitCallback: (particle) => {
				this.swayTween(particle, 15, 25, 1500, 3000);
			},
		});

		this.snowParticles2 = this.add.particles(getSheetKey("snow.png"));
		this.snowParticles2.setDepth(this.topDepth + 100);
		this.snowParticleEmitter2 = this.snowParticles2.createEmitter({
			frame: ["snow.png"],
			speedY: { min: toRes(30), max: toRes(32) },
			x: { min: 0, max: toRes(930) },
			y: -10,
			frequency: 1000,
			lifespan: 300000,
			alpha: 0.6,
			scale: toRes(0.7),
			emitCallback: (particle) => {
				this.swayTween(particle, 20, 35, 2000, 4000);
			},
			// blendMode: "OVERLAY",
			// tint: 0xffffff
		});

		let height = toRes(this.sceneHeight);
		let particleX = 0;
		let increment = 25;
		while (particleX < height) {
			this.snowParticleEmitter.emitParticle(1, particleX, Math.floor(Math.random() * toRes(930)) + 1);
			// this.swayTween(particle, 15, 25, 1500, 3000, true);
			this.snowParticleEmitter2.emitParticle(1, particleX, Math.floor(Math.random() * toRes(930)) + 1);
			// this.swayTween(particle2, 20, 35, 2000, 4000, true);
			particleX += increment;
		}

		this.snowParticleEmitter.setScrollFactor(1, 0.8);
		this.snowParticleEmitter2.setScrollFactor(1, 0.8);
	}

	swayTween(particle, minX, maxX, minDur, MaxDur) {
		if (!particle.swayTween) {
			particle.swayTween = this.tweens.add(
				{
					targets: particle,
					x: particle.x + Math.floor(Math.random() * maxX) + minX,
					ease: "Sine.easeInOut",
					duration: (Math.floor(Math.random() * MaxDur) + minDur),
					yoyo: true,
					loop: -1,
				},
				this
			);
			particle.swayTween.keep = true;
		}
	}
}
