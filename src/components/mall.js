import Phaser from "phaser";
import { config, userSettings, charConfig } from "./config.js";
import blockFactories from "./blocks.js";
import {
	mirrorX,
	toRes,
	toResRev,
	getSocket,
	joinRoom,
	joinStatRoom,
	getHouseArray,
	resetNeededRooms,
	getSheetKey
} from "./utils/";
import Person from "./game-objects/person.js";
import Sign from "./game-objects/sign.js";
import sideCtor from "./vue/SideController.vue";
import { default as i18n } from "../i18n";

export class Street extends Phaser.Scene {
	constructor(coinConfig, side) {
		super({ key: coinConfig.ticker });
		this.isMall = true;
		this.ticker = coinConfig.ticker;
		this.config = coinConfig;
		this.side = side;
		this.tileSize = toRes(32);
		this.tileWidth = toRes(30);
		this.personDepth = 10;
		this.topDepth = 100;
		this.overlayDepth = 200;
		this.processingBlock = false;
		this.housePlans = {};
		this.lineManager = {};
		this.jsonTimestamps = {};
		this.loaded = false;
		this.backgroundColor = "#F39A2C";
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
	}

	async create() {

		let houses = await getHouseArray(this.config);
		if (!houses) houses = [];
		this.createHouses(houses);
	}

	streetInit() {
		this.ticker = this.config.ticker;
		this.color = this.config.color;
		this.nextPersonWaitingAnimUpdate = 0;
		this.initSide();
		this.postFxPlugin = this.plugins.get("rexOutlinePipeline");
	}

	initSide() {
		this.neededRooms();
		let walkingLaneOffset = 10 * this.tileSize;
		this.walkingLane = this.side == "right" ? toRes(960) - walkingLaneOffset : walkingLaneOffset;
		this.busLane = mirrorX(864, this.side);
		this.curbX = this.busLane + (this.side == "right" ? 4 * this.tileSize : -(4 * this.tileSize));
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
		arr.push(this.ticker + "-blocks");
		resetNeededRooms("viz-" + this.ticker, arr);
	}

	setConnected(bool = this.vue.isConnected) {
		if (!bool) {
			this.hasBeenDisconnected = true;
			this.scene.setVisible(false);
			this.loaded = true;
			this.sign.setVisible(false);
		} else {
			if (this.hasBeenDisconnected) {
				this.hasBeenDisconnected = false;
				joinRoom(this.config, "transactions", true);
				this.socketStats(true);
				this.blockFactory.connect();
				this.time.addEvent({
					delay: 5000,
					callback: () => {
						this.forceCorrectLine = true;
						window.txStreetPhaser.streetController.positionHouses(true);
						this.scene.setVisible(true);
					},
				});
			}
			this.sign.setVisible(true);
		}
	}

	deleteLinePerson(hash, deleteLineEntry = false) {
		let entry = this.lineManager[hash];
		if (entry) {
			let person = entry.person;
			if (person) {
				person.bye(deleteLineEntry);
				this.lineManager[hash].person = null;
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

	deleteTxsFromBlock(block) {
		if (typeof block.txFull === "undefined") return false;
		const tx = Object.keys(block.txFull);
		for (let i = 0; i < tx.length; i++) {
			let reportedHash = tx[i];
			this.deleteLinePerson(reportedHash, true);
		}
	}

	fastProcessBlocks() {
		for (let i = 0; i < this.blockchain.length; i++) {
			let block = this.blockchain[i];
			this.fastProcessBlock(block);
		}
		this.processingBlock = false;
	}

	fastProcessBlock(block) {
		if (block.processed) {
			this.deleteTxsFromBlock(block);
		} else {
			if (typeof block.txFull !== "undefined") {
				const tx = Object.keys(block.txFull);
				for (let i = 0; i < tx.length; i++) {
					let reportedHash = tx[i];
					this.deleteLinePerson(reportedHash, true);
					this.removeFollower(reportedHash, false, false);
				}
			}
			block.processed = true;
			this.saveFollowers();
			this.customCallback("processBlock", "after", block);
		}
	}

	drawStreet() {
		this.cameras.main.setBackgroundColor(this.backgroundColor);
		this.pathSprite = this.add.tileSprite(
			0,
			0,
			960,
			window.innerHeight - config.vPadding,
			getSheetKey("road.png"),
			"road.png"
		);
		this.pathSprite.setAlpha(0.75);
		this.pathSprite.scrollFactorY = 0;
		this.pathSprite.setOrigin(0, 0);
		this.pathSprite.setScale(config.resolution);

		let grassPatchGraphics = this.add.graphics({ fillStyle: { color: 0xAA6714 } });
		grassPatchGraphics.fillRoundedRect(0, 0, toRes(191), toRes(298), toRes(32));
		grassPatchGraphics.fillStyle(0xF39A2C);
		grassPatchGraphics.fillRoundedRect(0, 0, toRes(190), toRes(290), toRes(32));
		grassPatchGraphics.fillStyle(0x558259);
		grassPatchGraphics.fillRoundedRect(0, 0, toRes(170), toRes(270), toRes(20));
		grassPatchGraphics.fillStyle(0xAA6714);
		grassPatchGraphics.fillRect(toRes(170), toRes(90), toRes(20), toRes(70));

		grassPatchGraphics.generateTexture("grassPatch", toRes(231), toRes(338));
		this.grassPatch = this.add.image(mirrorX(toRes(80), this.side), toRes(130), "grassPatch");
		this.grassPatch.setFlipX(this.side === "right");
		grassPatchGraphics.destroy();

		let underWalkWaySprite = this.add.graphics({ fillStyle: { color: 0x6f6c68 } });
		underWalkWaySprite.fillRoundedRect(0, 0, toRes(152), toRes(60), toRes(5));
		underWalkWaySprite.fillStyle(0x5e5c59)
		underWalkWaySprite.fillRect(0, 0, toRes(152), toRes(30));
		underWalkWaySprite.fillStyle(0x090E11)
		underWalkWaySprite.fillRoundedRect(toRes(142), toRes(-10), toRes(10), toRes(25), toRes(3));
		underWalkWaySprite.fillRoundedRect(0, toRes(-10), toRes(10), toRes(25), toRes(3));
		underWalkWaySprite.generateTexture("underWalkWaySprite", toRes(152), toRes(60));

		this.underWalkWaySprite = this.add.image(this.busLane, toRes(420), "underWalkWaySprite");
		this.underWalkWaySprite.setOrigin(0.5, 0.5);

		underWalkWaySprite.destroy();

		this.walkwaySprite = this.add.tileSprite(
			this.busLane,
			0,
			152,
			400,
			getSheetKey("walkway.png"),
			"walkway.png"
		);
		this.walkwaySprite.setOrigin(0.5, 0);
		this.walkwaySprite.setScale(config.resolution);

		let wall = this.add.graphics({ fillStyle: { color: 0xAA6714 } });
		wall.fillRect(0, 0, toRes(30), window.innerHeight * 2);
		wall.fillStyle(0xF39A2C);
		wall.fillRect(toRes(1), 0, toRes(30), window.innerHeight * 2);

		wall.generateTexture("mallWall", toRes(30), window.innerHeight * 2);

		this.wall = this.add.image(mirrorX(955, this.side), 0, "mallWall");
		this.wall.setOrigin(0.5, 0);
		this.wall.scrollFactorY = 0;
		if (this.side === "right") this.wall.setFlipX(true);

		wall.destroy();

		this.desk = this.add.image(mirrorX(532, this.side), toRes(350), getSheetKey("eth_post_desk.png"), "eth_post_desk.png");
		this.desk.setScale(config.resolution);
		this.sign = new Sign(this);
		this.sign.setDepth(this.personDepth + 5);
		this.sign.alternateStats();
	}


	streetCreate() {
		this.drawStreet();
		this.socket = getSocket(this.config).socket;

		this.socketConnectCount = 0;

		let socketInitInterval = setInterval(() => {
			if (!this.socket.connected) return;
			clearInterval(socketInitInterval);
			this.socketStats(this.config);
			this.socket.emit("get-recent-house-txs", this.ticker);
			this.blockFactory.connect();
			this.blockFactory.socket.on("arbiRollup", () => {
				if (window.txStreetPhaser.streetController.hidden || this.game.scene.isSleeping(this)) return;
				this.rollupStart();
			})
		}, 50);

		this.blockFactory.once("connected", async () => {
			this.blocksLoaded = true;
			this.resume();
			this.loadFollowers();
			this.checkBlockInterval();
			this.loaded = true;
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

		this.socket.on("stat-updates", (ticker, key, value) => {
			if (!this.config.stats[key].socket) return;
			this.vue.stats[key].value = value;
			this.statUpdateCount++;
		});

		this.cameras.main.setBounds(0, 0, toRes(960), this.sceneHeight);
		this.houses = this.add.group();
		this.letters = this.add.group();
		this.doors = this.add.group();
		this.houseLogos = this.add.group();

		this.mailman = new Person(this);

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
			} else if (type == "rollup") {
				this.vue.wikiWindow(i18n.t("general.optimisticRollup"), ["common/optimisticRollup"]);
			} else if (type == "segwit") {
				this.vue.wikiWindow("Segwit", ["common/segwit"]);
			} else if (type == "popup") {
				if (gameObject.person) {
					let txData = gameObject.person.getLineData("txData");
					this.vue.txWindow(txData);
				}
				gameObject.bye();
			}
		});
		this.input.on("gameobjectover", (pointer, gameObject) => {
			gameObject.hovered = true;
			let type = gameObject.clickObject;
			if (type == "bus") {
				this.busInsideSingle(gameObject);
			}
		});
		this.input.on("gameobjectout", (pointer, gameObject) => {
			gameObject.hovered = false;
			let type = gameObject.clickObject;
			if (type == "bus") {
				this.busInsideSingle(gameObject);
			}
		});
	}

	resetMailman() {
		this.mailman.customResetData("mailman");
		this.mailman.setScale(config.resolution);
		this.mailman.setPosition(mirrorX(540, this.side), toRes(-30));
		this.mailman.addMove(mirrorX(540, this.side), toRes(260), {
			onComplete: () => {
				this.mailman.wait();
			}
		});
	}

	rollupStart() {
		this.mailman.rolling = true;
		this.mailman.spinDirection = -1;
		this.mailman.anims.play("mailman-spin");
		this.mailman.animListener = (anim, frame) => {
			if (!this.mailman.rolling) return;
			this.mailman.setFlipX(frame.index === 4);
			this.mailman.anims.msPerFrame += 8 * (this.mailman.spinDirection);
			if (this.mailman.anims.msPerFrame <= 70) this.mailman.anims.msPerFrame = 90;
			if (this.mailman.anims.msPerFrame <= 90) {
				if (!this.mailman.rollingUp)
					this.rollup();
			}
		}
		this.mailman.on(Phaser.Animations.Events.ANIMATION_UPDATE, this.mailman.animListener);
	}

	rollup() {
		if (this.mailman.rollingUp) return;
		if (!this.letters.children.entries.length) {
			setTimeout(() => {
				this.rollup();
			}, 5000);
			return;
		}
		this.mailman.rollingUp = true;

		this.add.tween({
			targets: [this.mailman],
			ease: "Quart.easeIn",
			duration: 500 * window.txStreetPhaser.streetController.fpsTimesFaster,
			scale: 1.05 * config.resolution,
			y: this.mailman.y - toRes(10),
			yoyo: true,
			onYoyo: () => {
				this.mailman.spinDirection = 1;
			},
			onComplete: () => {
				this.mailman.off(Phaser.Animations.Events.ANIMATION_UPDATE, this.mailman.animListener);
				this.mailman.rollingUp = false;
				this.mailman.rolling = false;
				this.mailmanLeave();
			}
		});
		for (let i = 0; i < this.letters.children.entries.length; i++) {
			const letter = this.letters.children.entries[i];
			const tweenConfig = {
				targets: [letter],
				ease: "Quart.easeIn",
				duration: 500 * window.txStreetPhaser.streetController.fpsTimesFaster,
				y: this.mailman.y,
				x: this.mailman.x,
				rotation: Math.floor((Math.random() * (5)) + 1) * (Math.random() > 0.5 ? 1 : -1),
				onComplete: () => {
					letter.destroy();
				}
			};
			this.add.tween(tweenConfig);
		}
	}

	mailmanLeave() {
		this.mailman.addMove(this.mailman.x, this.mailman.y - toRes(50));
		this.mailman.addMove(mirrorX(220, this.side), this.mailman.y - toRes(50));
		this.mailman.addMove(mirrorX(220, this.side), this.mailman.y - toRes(185));
		this.mailman.addMove(mirrorX(-30, this.side), this.mailman.y - toRes(185), {
			onComplete: () => {
				this.mailman.setPosition(mirrorX(540, this.side), toRes(-30));
				this.mailman.addMove(mirrorX(540, this.side), toRes(260), {
					onComplete: () => {
						this.mailman.wait(false);
					}
				});
			}
		});
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
		if (oldSide != side) {
			this.underWalkWaySprite.setPosition(this.busLane, toRes(420));
			this.walkwaySprite.x = this.busLane;
			this.wall.setPosition(mirrorX(955, side), 0);
			this.grassPatch.setPosition(mirrorX(toRes(80), this.side), toRes(130));
			this.wall.setFlipX(side === "right");
			this.grassPatch.setFlipX(side === "right");

			this.desk.setX(mirrorX(532, side));
			this.sign.recreate();
			this.resume();
			//reset scroll so two streets aren't misaligned
			this.scrollY(-this.sceneHeight);
			this.events.emit("changeSide", side);
		} else {
			if (typeof this.lastSleep !== "undefined" && Date.now() / 1000 - this.lastSleep > 30) {
				this.resume();
			}
		}
		this.setConnected();
	}

	streetSleep() {
		this.lastSleep = Date.now() / 1000;
		this.vue.hidden = true;
		this.hasBeenDisconnected = true;
		this.neededRooms(true);
	}

	countAvailablePeople() {
		let count = 0;
		for (let i = 0; i < this.people.children.entries.length; i++) {
			const person = this.people.children.entries[i];
			if (!person.isInUse() && !person.active) count++;
		}
		return count;
	}

	createPeople() {
		this.people = this.add.group({
			classType: Person,
			maxSize: this.lineLength + 1000,
			runChildUpdate: false,
			active: false,
			visible: false,
		});
		this.people.createMultiple({ key: "sheet", quantity: 2000, active: false, visible: false });
		this.people.setDepth(this.personDepth);

		//add more people at once to the group if there aren't many available, so the `get` call doesn't use up resources
		this.time.addEvent({
			delay: 10000,
			callback: function () {
				let available = this.countAvailablePeople();
				if (available < 1000) {
					this.people.createMultiple({ key: "sheet", quantity: 1000, active: false, visible: false });
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
		this.config.getAndApplyFee(data);

		let modSize = this.getModSize(data);
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
			else if (!this?.textures?.list?.sheet?.frames?.[potentialChar + "-0.png"]) {
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
			spot: 1,
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
			// this.people.add(person);
			return person;
		}
	}

	getPersonFromHash(hash) {
		if (!this.lineManager[hash]) return false;
		return this.lineManager[hash].person;
	}

	getBusFromId() {
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
		if (this.cameras.main.scrollY + amount < 0 || reset) amount = -this.cameras.main.scrollY;
		let newHeight =
			((this.side == "full" ? toRes(960) : toRes(1920)) / window.innerWidth) *
			(window.innerHeight - config.vPadding);
		if (this.cameras.main.scrollY + newHeight + amount > this.sceneHeight)
			amount = this.sceneHeight - (this.cameras.main.scrollY + newHeight);

		let xPos = this.cameras.main.scrollX;
		let yPos = this.cameras.main.scrollY + amount;
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

		if (this.houses) {
			for (let i = 0; i < this.houses.children.entries.length; i++) {
				let house = this.houses.children.entries[i];
				if (house.y < topMeasure || house.y > bottomMeasure) {
					if (house.visible) {
						house.setVisible(false);
						house.door.setVisible(false);
						house.logo.setVisible(false);
						if (house.overlay) house.overlay.setVisible(false);
					}
				} else {
					if (!house.visible) {
						house.setVisible(true);
						house.door.setVisible(true);
						house.logo.setVisible(true);
						if (house.overlay) house.overlay.setVisible(true);
					}
				}
			}
		}

	}

	getModSize(txData) {
		if (txData.modSize) return txData.modSize;
		return txData[this.sizeVar];
	}

	checkBlockInterval() {
		this.time.addEvent({
			delay: 10,
			callback: function () {
				if (!window.txStreetPhaser.streetController.hidden) this.checkNewBlocks();
			},
			callbackScope: this,
			loop: true,
		});
		this.time.addEvent({
			delay: 1000,
			callback: () => {
				this.vue.stats["pendingBatchCountLive"].value = Math.max(this.vue.stats["pendingBatchCount"].value, this.letters.children.entries.length);
			},
			loop: true
		})
	}

	checkNewBlocks() {
		if (this.processingBlock) {
			return false;
		}
		if (window.txStreetPhaser.streetController.hidden) return false;

		for (let i = 0; i < this.blockchain.length; i++) {
			let block = this.blockchain[i];
			if (block.processed) continue;
			//dont process block if buses are moving

			this.processingBlock = true;
			for (const txHash in block.txFull) {
				this.newTx(block.txFull[txHash]);
			}
			block.processed = true;
			this.processingBlock = false;
			this.blockchain.sort((a, b) => { b.height - a.height });
			break;
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

		//set door position
		for (let i = 0; i < this.doors.children.entries.length; i++) {
			let door = this.doors.children.entries[i];
			if (door.name == houseObj.name) door.setPosition(houseX, houseY + toRes(38));
		}
		//set logo position
		for (let i = 0; i < this.houseLogos.children.entries.length; i++) {
			let houseLogo = this.houseLogos.children.entries[i];
			if (houseLogo.name == houseObj.name) houseLogo.setPosition(houseX, houseY - toRes(23.5));
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
			}
		}

		this.housePlans[houseObj.name].spawn = [houseX, houseY];
	}

	createHouse(name) {
		let path =
			this.config.ticker +
			"/" +
			name;
		let houseComponents = [];
		if (this.housePlans[name].dataSources && this.housePlans[name].dataSources.includes("wiki")) {
			houseComponents.push({
				name: "LoadWiki",
				props: {
					path,
					initVisible: false,
				},
			});
		}

		if (this.housePlans[name].dataSources && this.housePlans[name].dataSources.includes("html")) {
			houseComponents.push({
				name: "LoadHtml",
				props: {
					url: process.env.VUE_APP_STORAGE_URL + "info/houses/" + this.ticker + "_" + name + "/index.html",
				},
			});
		}

		houseComponents.push({
			name: "Transactions",
			props: {
				house: [name],
				ticker: this.config.ticker,
				txsEnabled: this.housePlans[name]?.tracked,
				plans: this.housePlans[name],
			},
		});

		this.vue.windowData.push({
			key: name,
			title: this.housePlans[name].title,
			components: houseComponents,
			styles: {
				width: "45rem",
				height: "45rem",
			},
		});
		let doorColor = Phaser.Display.Color.HexStringToColor(this.housePlans[name].colors[0]).lighten(30).color;
		let door = this.add.rectangle(0, 0, 110, 41, doorColor, 1);
		door.name = name;
		door.originalColor = doorColor;
		door.setDepth(this.bridgeDepth);
		door.setScale(config.resolution);
		this.doors.add(door);

		let logo = this.add.image(0, 0, "sheet", name + ".png", 40, 40);
		if (typeof this.housePlans[name].colors[1] !== "undefined" && this.housePlans[name].colors[1]) {
			if (this.housePlans[name].colors[1] === "lighten") {
				logo.setTint(doorColor);
			} else {
				logo.setTint("0x" + this.housePlans[name].colors[1]);
			}
		}
		logo.name = name;
		logo.setDepth(this.topDepth + 5);
		logo.setScale(config.resolution);
		this.houseLogos.add(logo);

		let house = this.add.image(0, 0, getSheetKey("house.png"), "house.png");
		if (config.theme.houseOverlay) {
			let houseOverlay = this.add.image(0, 0, getSheetKey("house_overlay.png"), "house_overlay.png");
			houseOverlay.setScale(config.resolution);
			houseOverlay.setDepth(this.topDepth + 5);
			houseOverlay.name = name;
			house.overlay = houseOverlay;
		}
		house.setTint("0x" + this.housePlans[name].colors[0]);
		house.name = name;
		house.setDepth(this.topDepth + 4);
		house.setInteractive({ useHandCursor: true });
		house.clickObject = "house";
		house.setScale(config.resolution);
		house.door = door;
		house.logo = logo;

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
			if (typeof house.side == "undefined") {
				house.side = sideCount.indexOf(Math.min(sideCount[0], sideCount[1]));
			}
			this.housePlans[house.name] = house;
			sideCount[house.side]++;
			this.createHouse(house.name);
		}

		if (!houses.length) this.noHouses = true;
		this.housesCreated = true;
	}

	streetUpdate() {
		if (this.walkwaySprite) this.walkwaySprite.tilePositionY += 70 / this.game.loop.actualFps;
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
				if (status === "walkway") {
					person.y -= toRes(70 / this.game.loop.actualFps);
					if (person.y <= -100){
						let hash = person.getData("txHash");
						this.removeFollower(hash, 0);
						person.bye();
					}
					continue;
				}
				person.resetMoveList();
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

	populateMail(amount) {
		for (let i = 0; i < amount; i++) {
			let x = mirrorX(Math.floor((Math.random() * (450 + 1)) + 310), this.side);
			let y = toRes(400) - toRes(Math.floor((Math.random() * (45 + 1)) + 35));
			let letter = this.add.image(x, y, getSheetKey("envelope.png"), "envelope.png");
			letter.setScale(config.resolution);
			letter.angle = Phaser.Math.Angle.RandomDegrees();
			this.letters.add(letter);
		}
	}

	resume() {
		this.loaded = false;
		this.removeTweens();

		this.fastProcessBlocks();
		this.letters.clear(true);
		this.populateMail(this.vue.stats['pendingBatchCount'].value);

		this.resetMailman();
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
		//this will always run when the tab is focused on, resume is only after 5 seconds
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

	removeFollower(hash, stop = false, saveFollowers = true) {
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
		if(saveFollowers) this.saveFollowers();
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
}
