import Phaser from "phaser";
import { config, enabledConfig, userSettings, moonheadNames } from "./config.js";
import { toRes, resetNeededRooms, getSheetKey } from "./utils/";
import { resizeAll } from "./listeners.js";
import BTCStreet from "./streets/bitcoin.js";
import BCHStreet from "./streets/bitcoin-cash.js";
import ETHStreet from "./streets/ethereum.js";
import ARBIStreet from "./streets/abitrum";
import XMRStreet from "./streets/monero.js";
import LTCStreet from "./streets/litecoin.js";
import rca from "rainbow-colors-array";
import Tutorial from "./vue/toasts/Tutorial";
import Vue from "vue";
import AppleTest from './utils/apple_test.js';

export const availableStreets = {
	BTC: BTCStreet,
	BCH: BCHStreet,
	ETH: ETHStreet,
	XMR: XMRStreet,
	LTC: LTCStreet,
	ARBI: ARBIStreet
};

export const enabledStreets = {};
for (const ticker in enabledConfig) {
	enabledStreets[ticker] = availableStreets[ticker];
}

export class StreetController extends Phaser.Scene {
	constructor() {
		super({ key: "StreetController" });
		this._appleTest = new AppleTest();
	}

	init() {
		this.game.streetController = this;
		this.enabledStreets = enabledStreets;
		this.enabledConfig = enabledConfig;
		this.leftStreet = false;
		this.rightStreet = false;
		this.fullStreet = false;
		this.fpsTimesFaster = 1;
		this.sideNames = ["left", "right", "full"];
	}

	preload() {
		this.load.setPath(config.baseUrl + "static/img/");
		this.load.multiatlas("sheet", "sheet.json?v=" + process.env.VUE_APP_VERSION);
		this.load.multiatlas("characters", "characters.json?v=" + process.env.VUE_APP_VERSION);
		this.load.multiatlas("mall", "mall.json?v=" + process.env.VUE_APP_VERSION);
		if (config.theme.key === "holiday") this.load.multiatlas("holiday", "sheet_holiday.json?v=" + process.env.VUE_APP_VERSION);

		this.load.bitmapFont("roboto", "roboto.png?v=" + process.env.VUE_APP_VERSION, "roboto.xml?v=" + process.env.VUE_APP_VERSION);
		this.load.bitmapFont("highway", "highway.png?v=" + process.env.VUE_APP_VERSION, "highway.xml?v=" + process.env.VUE_APP_VERSION);
		this.load.svg("cloudCircle", "circle.svg?v=" + process.env.VUE_APP_VERSION);
		window.mainVue.loading = true;
	}

	create() {
		resetNeededRooms("dash", []);
		window.addEventListener("popstate", () => {
			window.location.reload();
		});
		this.busErase = this.add.image(0, 0, getSheetKey("bus_erase.png"), "bus_erase.png").setVisible(false);
		this.personFrames = {};
		this.createCrowdTextures();
		if (userSettings.globalSettings.animations.value) this.createAnimations();
		this.rainbowInterval();
		let streetsToLoad = [];

		let streetsArray = window.mainVue.selectedCoins;
		for (let j = 0; j < streetsArray.length; j++) {
			let street = streetsArray[j];
			for (var ticker in this.enabledConfig) {
				if (street === ticker) {
					streetsToLoad.push({
						street: this.enabledStreets[ticker],
						config: this.enabledConfig[ticker],
					});
				}
			}
		}

		if (streetsToLoad.length > 1) {
			this.createStreet("left", streetsToLoad[0].street);
			this.createStreet("right", streetsToLoad[1].street);
		} else {
			this.createStreet("full", streetsToLoad[0].street);
		}

		this.checkLoaded();
		this.positionHouses(true);

		this.hidden = false;
		this.game.events.on("visible", () => {
			if (this.hidden) {
				const now = Date.now() / 1000;
				this.hidden = false;
				if (now - this.hiddenTimestamp <= 5) {
					//was resumed less than 5 seconds
				} else {
					this.game.anims.removeAllListeners();
					this.resume();
				}
				this.unpause();
			}
		});
		this.game.events.on("hidden", () => {
			this.hidden = true;
			this.hiddenTimestamp = Date.now() / 1000;
			this.pause();
		});

		let tutorialDone = localStorage.getItem("tutorialDone");
		if (tutorialDone === null) {
			this.createTutorial();
		} else {
			this.createLedgerTimeout();
		}
		window.mainVue.getVizTitleFromStreets(true, true);
	}

	update() {
		this.fpsTimesFaster = this.game.loop.actualFps / this.game.config.fps.target;
	}

	generateSpriteNo() {
		return Math.round(Math.random() * 16);
	}

	createCrowdTextures() {
		this.crowdScale = toRes(0.4);
		this.crowdTextures = [];
		let number = 2;
		let pplPerRow = 20;
		let xSeperator = toRes(17 / this.crowdScale);
		let ySeperator = toRes(34);
		this.pplPerBlitter = 200 / this.crowdScale;
		let rowsPerBlitter = this.pplPerBlitter / pplPerRow;
		let blitterHeight = rowsPerBlitter * xSeperator;
		let rHeight = blitterHeight + 64;
		let rWidth = pplPerRow * xSeperator + 64;
		this.crowdWidth = rWidth;
		let angles = [0, 3, 6];
		for (let i = 0; i < number; i++) {
			let texture = this.add.renderTexture(0, 0, rWidth, rHeight).setVisible(false);
			texture.origHeight = rHeight;
			texture.origWidth = rWidth;
			let blitter = this.add.blitter(0, 0, getSheetKey("person-")).setVisible(false);
			for (let j = 0; j < this.pplPerBlitter; j++) {
				let row = Math.floor(j / pplPerRow);
				let column = j % pplPerRow;
				let addedX = column * xSeperator + Math.random() * toRes(20 / this.crowdScale);
				let addedY = row * ySeperator + Math.random() * toRes(20 / this.crowdScale);
				let spriteNo = this.generateSpriteNo() * 9 + angles[Math.floor(Math.random() * angles.length)];
				blitter.create(addedX, addedY, "person-" + spriteNo + ".png");
			}
			texture.draw(blitter);
			texture.setTint(0xb1b1b1);
			texture.setScale(this.crowdScale);
			this.crowdTextures.push(texture);
			blitter.destroy();
		}
	}

	createLedgerTimeout() {
		let ledgerDone = localStorage.getItem("ledgerDone");
		if (ledgerDone === null) {
			this.time.addEvent({
				delay: 20000,
				callback: () => {
					let leftStreet = this.getLeftStreet();
					if (leftStreet && typeof leftStreet.createLedgerNanoX === "function") leftStreet.createLedgerNanoX();
				},
			});
		}
	}

	createTutorial() {
		window.mainVue.$toast(Tutorial, {
			position: "bottom-center",
			timeout: false,
			closeOnClick: false,
			draggable: true,
			draggablePercent: 0.6,
			icon: false,
		});
	}

	colorSpriteGroup(group, color, fill = false) {
		for (let i = 0; i < this.game.scene.scenes.length; i++) {
			let scene = this.game.scene.scenes[i];
			if (typeof scene.colorSpriteGroup === "function" && scene !== this) {
				scene.colorSpriteGroup(group, color, fill);
			}
		}
	}

	colorClass(className, color) {
		let classes = document.getElementsByClassName(className);
		for (let i = 0; i < classes.length; i++) {
			let element = classes[i];
			if (color) {
				element.style.background = "#" + color;
			} else {
				element.style.background = null;
			}
		}
	}

	createStreet(side, coin) {
		//dont add if its already on one side
		if (this.getCoinStreet(coin)) {
			this.wakeStreet(side, coin);
			return false;
		}

		//coin is a reference to other street classes
		var street = new coin(side);
		this[side + "Street"] = coin;
		this.scene.add(side, street, true);
		street.vue.$on("changedSetting", key => {
			if (key === "openRoofs") {
				for (let i = 0; i < this.game.scene.scenes.length; i++) {
					let scene = this.game.scene.scenes[i];
					if (typeof scene.busInside === "function" && scene !== this) {
						scene.busInside();
					}
				}
			}
		});
	}

	wakeStreet(side, coin) {
		let scene = this.getCoinStreet(coin);
		scene.streetWake(side);
		this.game.scene.wake(scene, side);
		scene.setConnected();
		this[side + "Street"] = coin;
	}

	switchStreet(side, coin) {
		if (this[side + "Street"] == coin) return false;
		window.mainVue.loading = true;
		let otherSide = side == "right" ? "left" : "right";
		let otherSideStreet = side !== "full" ? this[otherSide + "Street"] : false;
		let replacingScene = this.getSideStreet(side);
		this.sleepAllStreets();
		setTimeout(() => {
			this.createStreet(side, coin);
			if (side !== "full") {
				if (otherSideStreet == coin && replacingScene) {
					//we are moving this street to this side
					this.createStreet(otherSide, this.enabledStreets[replacingScene.ticker]);
				} else {
					if (replacingScene) {
						this.createStreet(otherSide, otherSideStreet);
					} else {
						this.createStreet(otherSide, this.getFirstStreet(coin));
					}
				}
			}
			this.changeSelectedCoins();

			this.positionHouses(true);
			if (window.mainVue) window.mainVue.replaceVizPage();
			this.checkLoaded();
			setTimeout(() => {
				resizeAll(this.game);
			}, 5);
		}, 5);
	}

	changeSelectedCoins() {
		let changed = 0;
		let possibleArray = [this.getSideStreet("left"), this.getSideStreet("right"), this.getSideStreet("full")];
		for (let i = 0; i < possibleArray.length; i++) {
			if (changed >= 2) break;
			let possible = possibleArray[i];
			if (!possible || this.game.scene.isSleeping(possible)) continue;
			Vue.set(window.mainVue.selectedCoins, changed, possible.ticker);
			changed++;
		}
		if (changed === 1) Vue.set(window.mainVue.selectedCoins, 1, null);
	}

	sleepAllStreets(except = false) {
		for (let i = 0; i < this.sideNames.length; i++) {
			let side = this.sideNames[i];
			let street = this.getSideStreet(side);
			if (except && street instanceof except) continue;
			this.sleepStreet(street);
		}
	}

	getFirstStreet(except) {
		for (const streetName in this.enabledStreets) {
			let streetClass = this.enabledStreets[streetName];
			if (streetClass == except) continue;
			return streetClass;
		}
	}

	getLeftStreet() {
		let street = this.getSideStreet("left");
		if (!street) street = this.getSideStreet("full");
		return street;
	}

	getSideStreet(side) {
		for (let i = 0; i < this.game.scene.scenes.length; i++) {
			let scene = this.game.scene.scenes[i];
			let activeStreet = this[side + "Street"];
			if (!activeStreet) continue;
			if (scene instanceof activeStreet) {
				return scene;
			}
		}
		return false;
	}

	getOtherStreet(side) {
		//side variable is the current side of the street asking for the other side instance
		if (side == "full") return false;
		if (side == "left") return this.getSideStreet("right");
		if (side == "right") return this.getSideStreet("left");
		return false;
	}

	getCoinStreet(coin) {
		for (let i = 0; i < this.game.scene.scenes.length; i++) {
			let scene = this.game.scene.scenes[i];
			if (scene instanceof coin) {
				return scene;
			}
		}
		return false;
	}

	removeStreet(scene) {
		if (!scene) return false;
		scene.socket.disconnect();
		scene.tweens.killAll();
		this.game.scene.stop(scene);
		this.game.scene.remove(scene);
		this[scene.side + "Street"] = false;
	}

	sleepStreet(scene) {
		if (!scene) return false;
		scene.streetSleep();
		this.game.scene.sleep(scene);
		this[scene.side + "Street"] = false;
	}

	sortHouses(activeStreets) {
		let sorted = { left: [], right: [] };
		let appended = { left: [], right: [] };
		let leftStreet = this.getSideStreet("left");
		let rightStreet = this.getSideStreet("right");
		if (activeStreets.length < 2) leftStreet = this.getSideStreet("full");

		if (leftStreet.config.houseArray.length) {
			for (let i = 0; i < leftStreet.config.houseArray.length; i++) {
				const house = leftStreet.config.houseArray[i];
				const name = house.name;

				let toPush = leftStreet.housePlans[name];
				toPush.xOffset = -6;
				appended.left.push(toPush);

			}
		}
		if (activeStreets.length < 2) {
			sorted.left = sorted.left.concat(appended.left);
			return sorted;
		}
		if (typeof rightStreet.config.houseArray !== "undefined") {
			for (let i = 0; i < rightStreet.config.houseArray.length; i++) {
				const house = rightStreet.config.houseArray[i];
				const name = house.name;
				let toPush = rightStreet.housePlans[name];
				toPush.xOffset = -6;
				appended.right.push(toPush);
			}
		}
		sorted.left = sorted.left.concat(appended.left);
		sorted.right = sorted.right.concat(appended.right);
		return sorted;
	}

	positionHouses(retry = false) {
		let scenes = this.game.scene.getScenes(true);
		let housesLoaded = true;
		let activeStreets = [];
		for (let i = 0; i < scenes.length; i++) {
			let scene = scenes[i];
			if (scene == this || this.game.scene.isSleeping(scene)) continue;
			activeStreets.push(scene);
			let housePlansLength = Object.keys(scene.housePlans).length;
			if ((housePlansLength > 0 && housePlansLength == scene.houses.children.entries.length) || scene.noHouses)
				continue;
			if (!scene.vue.isConnected) continue;
			housesLoaded = false;
		}

		if (!housesLoaded) {
			if (retry) {
				this.time.addEvent({
					delay: 100,
					callback: () => {
						this.positionHouses(true);
					},
				});
			}
			return false;
		}
		let sorted = this.sortHouses(activeStreets);
		for (let i = 0; i < activeStreets.length; i++) {
			let scene = activeStreets[i];
			let houseY = [scene?.config?.initialHouseY || 100, scene?.config?.initialHouseY || 100];
			let houses = scene.side == "right" ? sorted.right : sorted.left;
			let skip1Side = [];
			for (let i = 0; i < houses.length; i++) {
				let house = houses[i];
				let y = houseY[house.side];
				if (house.type === "mall") {
					skip1Side.push(y);
				}
				scene.positionHouse(house, y);
				delete house.xOffset;
				houseY[house.side] += 150;
				if (skip1Side.includes(houseY[1])) houseY[1] += 150;
			}
		}
		return true;
	}

	createPersonAnimation(key, startFrame, prefix = "person") {
		if (!userSettings.globalSettings.animations.value) return true;
		this.anims.create({
			key: "walk_up_" + key,
			frameRate: 6,
			frames: this.anims.generateFrameNames(getSheetKey(prefix + "-"), {
				prefix: prefix + "-",
				suffix: ".png",
				frames: [startFrame + 3, startFrame + 4, startFrame + 3, startFrame + 5],
			}),
			repeat: -1,
		});

		this.anims.create({
			key: "walk_down_" + key,
			frameRate: 6,
			frames: this.anims.generateFrameNames(getSheetKey(prefix + "-"), {
				prefix: prefix + "-",
				suffix: ".png",
				frames: [startFrame, startFrame + 1, startFrame, startFrame + 2],
			}),
			repeat: -1,
		});

		this.anims.create({
			key: "walk_side_" + key,
			frameRate: 6,
			frames: this.anims.generateFrameNames(getSheetKey(prefix + "-"), {
				prefix: prefix + "-",
				suffix: ".png",
				frames: [startFrame + 6, startFrame + 7, startFrame + 6, startFrame + 8],
			}),
			repeat: -1,
		});

		let waitFrames = [startFrame, startFrame + 3, startFrame + 6];
		this.anims.create({
			key: "stand_" + key,
			frameRate: 0.0001,
			frames: this.anims.generateFrameNames(getSheetKey(prefix + "-"), {
				prefix: prefix + "-",
				suffix: ".png",
				frames: waitFrames,
			}),
			repeat: -1,
		});
	}

	createAnimations() {
		for (let i = 0; i <= 16; i++) {
			let startFrame = i * 9;

			this.createPersonAnimation(i, startFrame);
		}
		const characters = moonheadNames;
		for (let i = 0; i < characters.length; i++) {
			const character = characters[i];
			this.createPersonAnimation(character, 0, character);
		}

		//mailman spin animation
		this.anims.create({
			key: "mailman-spin",
			frameRate: 6,
			frames: this.anims.generateFrameNames(getSheetKey("mailman-"), {
				prefix: "mailman-",
				suffix: ".png",
				frames: [0, 6, 3, 6],
			}),
			repeat: -1,
		});
	}

	resize() { }

	unpause() {
		for (let i = 0; i < this.scene.manager.scenes.length; i++) {
			let scene = this.scene.manager.scenes[i];
			if (scene.scene.key == "StreetController") continue;
			if (this.game.scene.isSleeping(scene)) continue;
			scene.unpause();
		}
	}

	resume() {
		if (Date.now() / 1000 - this.hiddenTimestamp > 7200) {
			this.game.destroy(true, true);
			window.location.reload(true);
			return false;
		}

		for (let i = 0; i < this.scene.manager.scenes.length; i++) {
			let scene = this.scene.manager.scenes[i];
			if (scene.scene.key == "StreetController") continue;
			if (this.game.scene.isSleeping(scene)) continue;
			scene.resume();
		}
	}

	pause() {
		for (let i = 0; i < this.scene.manager.scenes.length; i++) {
			let scene = this.scene.manager.scenes[i];
			if (scene.scene.key == "StreetController") continue;
			if (this.game.scene.isSleeping(scene)) continue;
			scene.pause();
		}
	}

	checkLoaded() {
		this.loadingInterval = setInterval(() => {
			if (this.game.scene.scenes.length <= 1) {
				return false;
			}
			for (let i = 0; i < this.game.scene.scenes.length; i++) {
				let scene = this.game.scene.scenes[i];
				if (typeof scene.loaded !== "undefined" && scene !== this) {
					if (!scene.loaded) {
						// console.log("not loaded: 2");
						return false;
					}
				}
			}
			window.mainVue.loading = false;
			window.mainVue.loaded = true;
			clearInterval(this.loadingInterval);
			this.loadingInterval = null;
		}, 10);
	}
	rainbowInterval() {
		this.rainbowObjects = [];
		this.hexRainbow = rca(30, "hex", true);
		this.rainbowIndex = 0;
		this.time.addEvent({
			delay: 50,
			startAt: 0,
			callback: () => {
				if (!this.rainbowObjects.length) return false;
				for (let i = 0; i < this.rainbowObjects.length; i++) {
					const gameObject = this.rainbowObjects[i][0];
					const instance = gameObject.scene.postFxPlugin.get(gameObject);
					if (!instance) continue;
					if (this._appleTest.isABadApple()) {
						instance[0].setOutlineColor(gameObject, parseInt(this.hexRainbow[this.rainbowIndex].hex, 16));
					} else {
						instance[0].setOutlineColor(parseInt(this.hexRainbow[this.rainbowIndex].hex, 16));
					}

				}
				this.rainbowIndex++;
				if (this.rainbowIndex >= this.hexRainbow.length) this.rainbowIndex = 0;
			},
			loop: true,
		});
	}

	addToRainbow(gameObject, hash, thickness = 6) {
		let found = false;
		let foundHash = false;
		for (let i = this.rainbowObjects.length - 1; i >= 0; i--) {
			const obj2 = this.rainbowObjects[i];
			if (gameObject === obj2[0]) {
				found = true;
				if (obj2[1] === hash) {
					foundHash = true;
				}
			}
		}
		if (!found) {
			gameObject.highlighted = true;
			gameObject.scene.postFxPlugin.add(gameObject, {
				thickness: toRes(thickness),
				outlineColor: 0x0bc2a6,
			});
		}
		if (!foundHash) {
			this.rainbowObjects.push([gameObject, hash]);
		}
	}

	removeFromRainbow(gameObject, hash) {
		if (!gameObject.highlighted) return false;
		let otherHash = false;
		for (let i = this.rainbowObjects.length - 1; i >= 0; i--) {
			const obj2 = this.rainbowObjects[i];
			if (gameObject === obj2[0]) {
				if (obj2[1] === hash) {
					this.rainbowObjects.splice(i, 1);
				} else {
					otherHash = true;
				}
			}
		}
		if (!otherHash) {
			gameObject.highlighted = false;
			gameObject.scene.postFxPlugin.remove(gameObject);
		}
	}
}
