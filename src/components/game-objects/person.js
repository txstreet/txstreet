import Phaser from "phaser";
import Popup from "./popup.js";
import { config, userSettings } from "./../config.js";
import { mirrorX, toRes, getSheetKey } from "./../utils/";

const Person = new Phaser.Class({
	Extends: Phaser.GameObjects[userSettings.globalSettings.animations.value ? "Sprite" : "Image"],
	initialize: function Person(scene) {
		Phaser.GameObjects[userSettings.globalSettings.animations.value ? "Sprite" : "Image"].call(this, scene, 0, 0);
		this.scene = scene;
		scene.add.existing(this);
		this.clickObject = "person";
		this.setVisible(false);
		this.setActive(false);
		this.setData("txHash", false);
		this.setDepth(this.scene.personDepth);
	},
});

Person.prototype.customResetData = function (char = "mailman") {
	if(userSettings.globalSettings.animations.value) this.animsEnabled = true;
	this.resetMoveList();
	this.setData("maxScale", 1);
	this.setData("spriteNo", char);
	this.setData("txHash", true);
	this.setVisible(true).setActive(true);
	this.charConfig = "default";
	if (!this.animsEnabled)
		this.setTexture(
			getSheetKey("person-"),
			char + "-0.png"
		);
}

Person.prototype.resetData = function (txData) {
	this.setData("spriteNo", txData.spriteNo);
	this.charConfig = this.scene.charConfig[txData.charType || "default"];
	this.setData("txHash", txData.tx);
	if (!this.animsEnabled) {
		if (typeof txData.char === "object") {
			this.scene.loadNFTSprite(this, txData.char.sheet, txData.char.texture, this.scene.charConfig[txData.char.sheet].pixelArt);
		}
		else {
			this.setTexture(
				getSheetKey("person-"),
				(txData.char ? txData.char + "-0" : "person-" + this.getData("spriteNo") * 9) + ".png"
			);
		}
	}
	if (txData.char) this.setDepth(this.scene.personDepth + 1);
	this.setLineData("person", this);
	this.setLineData("boarded", false);
	this.scene.setMaxScalePerson(this, this.scene.getModSize(txData));
	this.setData("feePaid", this.scene.config.getAndApplyFee(txData));
	this.setData("feeDifference", this.getFeeDifference());
	this.setData("bytes", txData.s);
	this.setData("house", typeof txData.h !== "undefined" ? txData.h : false);
	this.setData("boardedAnim", false);
	this.scaleSprite(0.33);
	this.setActive(true);
	this.setAlpha(1);
	setTimeout(() => {
		if (!this || !this.setInteractive) return false;
		this.setInteractive({ useHandCursor: true });
	}, 100);
};

Person.prototype.bye = function (final = false) {
	this.scene.customCallback("byePerson", "before", this);
	this.setVisible(false);
	this.setActive(false);
	if (typeof this.popup !== "undefined") {
		this.popup.destroy();
	}
	this.removeAllListeners();
	this.disableInteractive();
	if (this.animsEnabled && this.anims) {
		this.anims.stop();
		delete this.animsEnabled;
	}

	if (this.depth !== this.scene.personDepth) this.setDepth(this.scene.personDepth);
	window.txStreetPhaser.streetController.removeFromRainbow(this);

	this.setLineData("person", null);
	if (final) {
		this.setLineData("status", null);
		this.setLineData("spot", null);
	}

	this.resetMoveList();
	this.setData("boarding", null);
	this.setData("txHash", false);
	this.setData("feePaid", null);
	this.setData("bytes", null);
	this.setData("house", null);
	this.setData("moveInfo", undefined);
	this.setData("side", null);
	this.setData("feeDifference", null);
	this.status = null;
};

Person.prototype.setOffScreen = function () {
	this.setVisible(false);
	if (this.getLineData("status") == "waiting") this.setActive(false);
	this.disableInteractive();
};

Person.prototype.setOnScreen = function () {
	if (!this.isInUse()) return false;
	this.setVisible(true);
	this.setActive(true);
	this.setInteractive();
};

Person.prototype.isOnScreen = function () { };

Person.prototype.isInUse = function () {
	if (this.data.values.txHash) return true;
	return false;
};

Person.prototype.getFeeDifference = function () {
	let medianFee = 0;
	if (typeof this.scene.vue.stats[this.scene.medianFeeStat] !== "undefined") {
		medianFee = this.scene.vue.stats[this.scene.medianFeeStat].value;
		if (this.scene.vue.stats[this.scene.medianFeeStat].divide)
			medianFee /= this.scene.vue.stats[this.scene.medianFeeStat].divide;
	}
	let feeDifference = 0;
	if (medianFee !== "undefined" && medianFee) {
		feeDifference = (medianFee - this.getData("feePaid")) / 5; //will be negative if overpaid, positive if underpaid
	}
	if (feeDifference > 2) feeDifference = 2;
	if (feeDifference < -3) feeDifference = -3;

	let txData = this.getLineData("txData");
	if (txData?.e?.mailman) feeDifference = 2;

	return feeDifference;
};

Person.prototype.createHitArea = function () {
	let scale = this.getData("currentScale") * config.resolution * 64 * 0.8;
	if (!this.hitArea) {
		this.hitArea = new Phaser.Geom.Circle(0, 0, scale);
	} else {
		this.hitArea.setTo(0, 0, scale);
	}
};

Person.prototype.getLineData = function (key) {
	let entry = this.scene.lineManager[this.getData("txHash")];
	if (typeof entry === "undefined" || typeof entry[key] === "undefined") return false;
	return entry[key];
};

Person.prototype.setLineData = function (key, value) {
	if (this.status === value) return false;
	let hash = this.getData("txHash");
	if (typeof this.scene.lineManager[hash] === "undefined") return false;
	this.scene.lineManager[hash][key] = value;
	if (key == "status") this.status = value;
	return true;
};

Person.prototype.getLineSpot = function () {
	let spot = this.getLineData("spot");
	let cords = this.scene.getLineCords(spot);
	return cords;
};

Person.prototype.scaleSprite = function (scale) {
	scale *= this.charConfig.scaleAdjust;
	this.setData("currentScale", scale);
	this.setScale(scale * config.resolution);
	return this;
};

Person.prototype.resetMoveList = function () {
	if (this.scene.movingPeople.includes(this))
		this.scene.movingPeople.splice(this.scene.movingPeople.indexOf(this), 1);
	this.moveList = [];
	this.setData("moveInfo", undefined);
};

Person.prototype.addMove = function (x, y, cfg = {}) {
	if (!this.scene.movingPeople.includes(this)) this.scene.movingPeople.push(this);

	let lastMove = false;
	if (this.moveList.length) {
		lastMove = this.moveList[this.moveList.length - 1];
	} else {
		lastMove = {
			x: this.x,
			y: this.y,
		};
	}

	let distanceX = x - lastMove.x;
	let distanceY = y - lastMove.y;
	let distance = Math.sqrt(Math.pow(distanceX, 2) + Math.pow(distanceY, 2));

	let feeDifference = this.getData("feeDifference") || 0;

	let pixelsPerSecond =
		typeof cfg.pixelsPerSecond !== "undefined" ? cfg.pixelsPerSecond : this.scene.personPixelsPerSecond;
	pixelsPerSecond -= feeDifference;
	pixelsPerSecond *= 60 / this.scene.game.loop.actualFps;
	pixelsPerSecond = toRes(pixelsPerSecond);
	let totalSteps = distance / pixelsPerSecond;
	let duration = (totalSteps / this.scene.game.loop.actualFps) * 1000;
	if (typeof cfg.maxDuration !== "undefined") {
		if (duration > cfg.maxDuration) {
			totalSteps = (cfg.maxDuration / 1000) * this.scene.game.loop.actualFps;
			duration = cfg.maxDuration;
		}
	}
	if (typeof cfg.minDuration !== "undefined") {
		if (duration < cfg.minDuration) {
			totalSteps = (cfg.minDuration / 1000) * this.scene.game.loop.actualFps;
			duration = cfg.minDuration;
		}
	}

	let stepX = distanceX / totalSteps;
	let stepY = distanceY / totalSteps;

	let direction = this.getDirection(lastMove.x, lastMove.y, x, y);
	let scaleAdjust = 0.47 / this.getData("maxScale");
	let timeDifferenceWithFee = (distance * 7) / duration;
	let timeScale = timeDifferenceWithFee * scaleAdjust;
	if (timeScale > 1.5) timeScale = 1.5;

	let move = {
		x: x,
		y: y,
		stepX: stepX,
		stepY: stepY,
		step: 0,
		totalSteps: totalSteps,
		timeScale: timeScale,
		direction: direction,
		delay: cfg.delay ? cfg.delay : 0,
		paused: false,
		status: cfg.status,
		onComplete: () => {
			if (typeof cfg.onComplete === "function") cfg.onComplete();
			if (typeof cfg.scaleDelay !== "undefined" && cfg.scaleDelay === "complete") {
				//do scale on complete
				this.scaleTween(this, cfg.scale, 0, duration / 2.5);
			}
		},
		onStart: () => {
			if (typeof cfg.onStart === "function") cfg.onStart();
			if (typeof cfg.scale !== "undefined" /* && typeof this.scene !== "undefined"*/) {
				if (typeof cfg.scaleDelay === "undefined" || cfg.scaleDelay !== "complete") {
					//make sure it is not done on complete
					this.scaleTween(
						this,
						cfg.scale,
						typeof cfg.scaleDelay !== "undefined" ? cfg.scaleDelay : 0,
						duration / 2.5
					);
				}
			}
		},
	};
	if (cfg.data) move.data = cfg.data;

	this.moveList.push(move);
};

Person.prototype.scaleTween = function (target, scale, delay, duration) {
	scale *= this.charConfig.scaleAdjust;
	target.scene.add.tween({
		targets: target,
		scale: toRes(scale),
		duration: duration * window.txStreetPhaser.streetController.fpsTimesFaster,
		delay: delay,
	});
};

Person.prototype.setInitialPosition = function (status, boarded = null) {
	if (status == "new") {
		if (!this.scene.customCallback("setInitialPosition", "new", this)) {
			let house = this.getData("house");
			let side = 0;
			let yPos;
			let xPos;
			//check that the house exists on the street
			if (
				house &&
				Object.prototype.hasOwnProperty.call(this.scene.housePlans, house) &&
				typeof this.scene.housePlans[house].spawn !== "undefined"
			) {
				xPos = this.scene.housePlans[house].spawn[0];
				yPos = this.scene.housePlans[house].spawn[1] + toRes(40);
				side = xPos >= toRes(480) ? 1 : 0;
				if (side == 1) {
					xPos += toRes(51);
				} else {
					xPos -= toRes(51);
				}
			} else {
				// start from side under houses
				let houseY = this.scene.lowestHouseY || 0;
				yPos = Math.random() * toRes(500) + toRes(houseY + 100);
				xPos = mirrorX(-toRes(Math.random() * 100), this.scene.side);
			}
			this.setPosition(xPos, yPos);
		}
	} else if (status == "waiting") {
		let spot = this.getLineSpot();
		this.setPosition(spot[0], spot[1]);
	} else if (status == "exit_bus" || status == "change_bus") {
		let bus = this.scene.getBusFromId(boarded);
		if (bus) {
			let xOffset = Math.random() * toRes(50) * (Math.random >= 0.5 ? 1 : -1);
			this.setPosition(bus.x + xOffset, bus.exitY());
		}
	}
	let onScreen = this.scene.onScreen([this.y]);
	this.setVisible(onScreen[0]);
	this.scene.customCallback("setInitialPosition", "after", this);
};

Person.prototype.createMoveList = function () {
	if (this.scene.customCallback("createMoveList", "replace", this)) return;

	let house = this.getData("house");
	let side = 0;

	//check that the house exists on the street
	if (
		house &&
		Object.prototype.hasOwnProperty.call(this.scene.housePlans, house) &&
		typeof this.scene.housePlans[house].spawn !== "undefined"
	) {
		side = this.scene.housePlans[house].spawn[0] >= toRes(480) ? 1 : 0;
	}

	let xPos = this.x;
	let yPos = this.y;
	let peopleWaiting = typeof this.scene.inLineCount === "function" ? this.scene.inLineCount(true) : 0;

	//check that the house exists on the street
	if (house && Object.prototype.hasOwnProperty.call(this.scene.housePlans, house)) {
		const houseObj = this.scene.housePlans[house];
		if (houseObj.type === "mall") {
			let doorX = Math.random() > 0.5 ? 50 : 23; //double door
			let txData = this.getLineData("txData");
			if (txData?.e?.mailman) {
				doorX = 203; //ethereum post door
			}
			this.addMove(xPos + (side ? toRes(-doorX) : toRes(doorX)), yPos, { status: "house" });
			this.addMove(xPos + (side ? toRes(-doorX) : toRes(doorX)), yPos + toRes(50), {
				status: "leaving_house",
				onStart: () => {
					this.speechBubble();
				},
			});
			this.addMove(this.scene.walkingLane, yPos + toRes(50), {
				status: "leaving_house",
				scaleDelay: "complete",
				scale: this.getData("maxScale"),
			});
		} else {
			this.addMove(xPos + (side ? toRes(-87) : toRes(87)), yPos, { status: "house" });
			this.addMove(xPos + (side ? toRes(-87) : toRes(87)), yPos + toRes(40), {
				status: "leaving_house",
				onStart: () => {
					this.speechBubble();
				},
			});
			this.addMove(this.scene.walkingLane, yPos + toRes(40), {
				status: "leaving_house",
				scaleDelay: "complete",
				scale: this.getData("maxScale"),
			});
		}
		if (this.scene.side == "right") side = !side;
	} else {
		//move in from side, no house
		this.addMove(this.scene.walkingLane, yPos);
		this.scaleSprite(this.getData("maxScale"));
	}
	this.setData("side", side);

	//house on same side, if theres a line, move to back
	if (peopleWaiting) {
		//first use walking lane to get to back
		let spot = this.scene.lineStructure[this.getLineData("spot")];
		if (typeof spot === "undefined") spot = this.scene.lineStructure[1];
		this.addMove(this.scene.walkingLane, spot[1], { status: "to_board" });
	}

	if (this.scene.isMall)
		this.boardWalkway(false);
	else
		this.toBoardMove(false, false);
};

Person.prototype.exitBus = function (boardedId = false) {
	this.resetMoveList();
	this.scaleSprite(0.33);
	if (this.getLineData("spot") == "bus") this.setLineData("spot", this.scene.inLineCount(false, 1));
	let oldBus = this.scene.getBusFromId(boardedId);
	this.addMove(this.scene.curbX, this.y, {
		status: "exit_bus",
		scaleDelay: 1000,
		scale: this.getData("maxScale"),
		onComplete: () => {
			this.scene.customCallback("exitBusComplete", "after", this);
		},
		data: {
			busOriginId: boardedId,
		},
		onStart: () => {
			if (oldBus && !oldBus.endBus) oldBus.backDoorOpen();
		},
	});
};

Person.prototype.boardWalkway = function (restart) {
	if (restart) this.resetMoveList();
	let x = mirrorX(Math.floor((Math.random() * (450 + 1)) + 310), this.scene.side);
	this.addMove(x, toRes(400), {
		onComplete: () => {
			let letterY = this.y - toRes(Math.floor((Math.random() * (45 + 1)) + 35));
			let letter = this.scene.add.image(this.x, this.y, getSheetKey("envelope.png"), "envelope.png");
			letter.setScale(config.resolution);
			this.scene.letters.add(letter);
			this.scene.add.tween({
				targets: [letter],
				ease: "Power1",
				scale: 0.8 * config.resolution,
				duration: 500 * window.txStreetPhaser.streetController.fpsTimesFaster,
				y: letterY,
				rotation: Math.floor((Math.random() * (5)) + 1) * (Math.random() > 0.5 ? 1 : -1),
			});
		}
	});
	let xChange = Math.floor((Math.random() * (41)) + 1);
	if (Math.random() > 0.5) xChange *= -1;
	this.addMove(this.scene.busLane + toRes(xChange), toRes(400), {
		status: "walkway", onComplete: () => {
			this.setStill(true);
		}
	});
}

Person.prototype.toBoardMove = function (restart, teleport) {
	if (restart) this.resetMoveList();

	if (!this.scene.foundBoarding) {
		let spot = this.scene.lineStructure[this.getLineData("spot")];
		if (typeof spot === "undefined") spot = this.scene.lineStructure[1];

		if (teleport) {
			let onScreen = this.scene.onScreen([this.y, spot[1]]);
			if (!onScreen[0] && !onScreen[1]) {
				this.setPosition(spot[0], spot[1]);
				this.wait(true);
				return false;
			} else {
				if (!this.visible) {
					this.setOnScreen();
				}
				this.addMove(spot[0], spot[1], {
					ease: "Power1",
					pixelsPerSecond: 2,
					minDuration: 900 / this.scene.personPixelsPerSecond,
					maxDuration: 3000 / this.scene.personPixelsPerSecond,
					status: "teleporting",
				});
			}
		} else {
			this.addMove(spot[0], spot[1], { status: "to_board" });
		}
	} else {
		this.addMove(this.scene.boarding.x, this.scene.getBoardingY(this), { status: "to_board" });
	}
};

Person.prototype.getDirection = function (oldX, oldY, x, y) {
	//get direction
	if (
		!userSettings.globalSettings.animations.value
	)
		return false;

	let angle = Phaser.Math.Angle.Between(oldX, oldY, x, y);
	let direction = "up";
	if (angle > -0.7853981633974483 && angle <= 0.7853981633974483) {
		direction = "right";
	} else if (angle > 0.7853981633974483 && angle <= 2.356194490192345) {
		direction = "down";
	} else if (angle > 2.356194490192345 || angle <= -2.356194490192345) {
		direction = "left";
	}

	return direction;
};

Person.prototype.houseTween = function (house, tweenContents) {
	this.floatIcon = this.scene.add.image(this.x, this.y, getSheetKey("house_tween"), tweenContents + ".png");
	this.floatIcon.setDisplaySize(toRes(30), toRes(30));
	this.floatIcon.setDepth(this.scene.overlayDepth - 1);
	this.floatOffset = Math.random() * 40 * (Math.random() >= 0.5 ? -1 : 1);
	this.floatIconEnd = this.floatIcon.x + this.floatOffset;
	this.scene.tweens.add(
		{
			targets: this.floatIcon,
			x: {
				value: () => {
					return this.floatIconEnd;
				},
				duration: 1000 * window.txStreetPhaser.streetController.fpsTimesFaster,
				ease: "Sine.easeInOut",
				yoyo: 1,
				repeat: 10,
			},
			y: { value: this.floatIcon.y - toRes(100), duration: 3000 * window.txStreetPhaser.streetController.fpsTimesFaster, ease: "Sine", yoyo: 0 },
			alpha: { value: 0, duration: 3000 * window.txStreetPhaser.streetController.fpsTimesFaster },
			repeat: 0,
			onYoyo: function (tween, targets, that) {
				tween.data[0].start += that.floatOffset * 0.4;
				that.floatIconEnd += that.floatOffset * 0.4;
			},
			onComplete: function (tween, targets, icon) {
				icon.destroy();
				tween.remove();
			},
			onCompleteParams: [this.floatIcon],
			onYoyoParams: [this],
		},
		this
	);
};

Person.prototype.speechBubble = function () {
	let house = this.getData("house");
	let houseInfo = this.scene.housePlans[house];
	let txData = this.getLineData("txData");

	if (typeof txData.e === "undefined") return false;

	//if showbubble is true, skip tween and go to bubble
	if (
		typeof txData?.e?.houseTween !== "undefined" &&
		(typeof txData?.e?.showBubble === "undefined" || !txData?.e?.showBubble)
	) {
		//do tween instead of popup
		this.houseTween(house, txData?.e?.houseTween);
		return true;
	}

	if (typeof txData?.e?.houseContent !== "undefined" && txData?.e?.showBubble !== false) {
		//this house does do popups
		//we have popup content

		let lengthPerCharacter = houseInfo.popupLength;
		let length = txData?.e?.houseContent.length * lengthPerCharacter;
		if (length < 1200) length = 1200;

		this.popup = new Popup(this.scene, this.x, this.y, house, "bubble", txData?.e?.houseContent, length);
		this.popup.person = this;
		this.moveList[0].paused = true;

		this.scene.time.addEvent({
			delay: length,
			callback: () => {
				if (/*typeof this == "undefined" || typeof this.scene == "undefined" || */ !this.moveList.length)
					return false;
				this.moveList[0].paused = false;
			},
		});

		return true;
	} else {
		return false;
	}
};

Person.prototype.enterBus = function (boardingIndex, addToLoaded = true) {
	//add person tx data to bus
	let bus = this.scene.getBusFromId(boardingIndex);
	if (!bus) {
		this.toBoardMove(true, false);
		return false;
	}

	if (addToLoaded && !bus.endBus) {
		let txData = this.getLineData("txData");
		bus.loaded += txData[this.scene.sizeVar];
		bus.setFeeText();
	}
	const busId = bus.endBus ? "end_bus" : bus.getData("id");
	this.resetMoveList();
	this.setLineData("status", "on_bus");
	this.setLineData("spot", "bus");
	this.setLineData("boarded", busId);
	this.setLineData("destination", busId);
	this.scene.customCallback("enterBus", "after", [this, bus, addToLoaded]);
	this.bye();
};

Person.prototype.changeBus = function (oldIndex, newIndex) {
	this.resetMoveList();
	this.scaleSprite(0.33);

	let newBus = this.scene.getBusFromId(newIndex);
	let oldBus = this.scene.getBusFromId(oldIndex);
	if (!newBus) return false;
	let modCurb = this.scene.curbX + (this.scene.side == "right" ? -30 : 30);
	let boardingY = newBus.boardingY();

	if (typeof this.scene.changingBusCounts[oldIndex] === "undefined") this.scene.changingBusCounts[oldIndex] = 0;
	let delay = this.scene.changingBusCounts[oldIndex]++;
	delay /= 3;
	this.setData("boarding", newIndex);
	this.setLineData("destination", newIndex);

	this.addMove(modCurb, this.y, {
		delay: delay,
		status: "change_bus",
		scaleDelay: "complete",
		pixelsPerSecond: this.scene.personPixelsPerSecond + 3,
		scale: this.getData("maxScale"),
		data: {
			busOriginId: oldIndex,
		},
		onStart: () => {
			if (oldBus && !oldBus.endBus) oldBus.backDoorOpen();
		},
	});
	this.addMove(modCurb, boardingY, {
		status: "change_bus",
		pixelsPerSecond: this.scene.personPixelsPerSecond + 3,
		maxDuration: 3600 / this.scene.personPixelsPerSecond,
	});
	this.addMove(this.scene.busLane, boardingY, {
		status: "boarding",
		pixelsPerSecond: this.scene.personPixelsPerSecond + 3,
		scale: 0.33,
		onComplete: () => {
			this.enterBus(newIndex, false);
		},
		onStart: () => {
			newBus.doorOpen();
			this.scene.customCallback("board", "after", [this, newBus]);
		},
	});
	return true;
};

Person.prototype.speedUpStart = function () {
	if (
		(this.scene.side === "right" && this.x > this.scene.walkingLane) ||
		(this.scene.side !== "right" && this.x < this.scene.walkingLane)
	) {
		if (this.getData("house")) {
			this.addMove(this.x + (this.scene.side === "right" ? toRes(-87) : toRes(87)), this.y, {
				maxDuration: 1500 / this.scene.personPixelsPerSecond,
				status: "skipLine",
				pixelsPerSecond: this.scene.personPixelsPerSecond + 3,
			});
			this.addMove(this.x + (this.scene.side === "right" ? toRes(-87) : toRes(87)), this.y + toRes(40), {
				maxDuration: 1500 / this.scene.personPixelsPerSecond,
				status: "skipLine",
				pixelsPerSecond: this.scene.personPixelsPerSecond + 3,
			});
			this.addMove(this.scene.walkingLane, this.y + toRes(40), {
				maxDuration: 1500 / this.scene.personPixelsPerSecond,
				status: "skipLine",
				pixelsPerSecond: this.scene.personPixelsPerSecond + 3,
			});
		} else {
			this.addMove(this.scene.walkingLane, this.y, {
				maxDuration: 1500 / this.scene.personPixelsPerSecond,
				status: "skipLine",
				pixelsPerSecond: this.scene.personPixelsPerSecond + 3,
			});
		}
		return true;
	}
	return false;
}

Person.prototype.boardAndSkipLine = function (count, busId) {
	let bus = this.scene.getBusFromId(busId);
	if (!bus || bus.getData("leaving")) return false;
	this.resetMoveList();
	let boardingY = bus.boardingY();
	this.setData("boarding", busId);
	this.setLineData("destination", busId);
	this.setLineData("status", "skipLine");
	this.setLineData("spot", "bus");

	count /= 3;

	if (this.speedUpStart()) count = 0;
	this.addMove(this.scene.curbX, boardingY, {
		delay: count,
		maxDuration: 3600 / this.scene.personPixelsPerSecond,
		status: "skipLine",
		pixelsPerSecond: this.scene.personPixelsPerSecond + 3,
	});
	this.addMove(this.scene.busLane, boardingY, {
		status: "boarding",
		pixelsPerSecond: this.scene.personPixelsPerSecond + 3,
		scale: 0.33,
		onComplete: () => {
			let boardingIndex = this.getData("boarding");
			this.enterBus(boardingIndex, false);
		},
		onStart: () => {
			bus.doorOpen();
			this.scene.customCallback("board", "after", [this, bus]);
		},
	});
	return true;
};

Person.prototype.board = function () {
	if (!this.scene.foundBoarding) return false;

	let boardingIndex = this.getData("boarding");
	if (!boardingIndex) boardingIndex = this.scene.boarding.index;
	let bus = this.scene.getBusFromId(boardingIndex);
	let txData = this.getLineData("txData");
	if (bus.loaded + txData[this.scene.sizeVar] > this.scene.config.busCapacity) {
		bus.loaded = this.scene.config.busCapacity;
		this.scene.findBoarding();
		return false;
	}

	//not close enough to boarding point
	if (Math.abs(this.scene.getBoardingY(this) - this.y) > 2) {
		this.addMove(this.scene.curbX, this.scene.getBoardingY(this), { status: "to_board" });
		return true;
	}

	this.addMove(this.scene.busLane, this.scene.getBoardingY(this), {
		status: "boarding",
		scale: 0.33,
		onComplete: () => {
			this.enterBus(boardingIndex);
		},
	});
	this.setData("boarding", boardingIndex);
	this.setLineData("destination", boardingIndex);
	this.setLineData("status", "boarding");
	this.setLineData("spot", "bus");
	this.scene.customCallback("board", "after", [this, bus]);

	return true;
};


Person.prototype.setStill = function (randomDirection = false) {
	if (this.animsEnabled) {
		let frames = this.scene.anims.anims.entries["stand_" + this.getData("spriteNo")].frames;
		if (randomDirection) {
			let rand = Math.ceil(Math.random() * 3) - 1;
			+this.anims.play("stand_" + this.getData("spriteNo"), true);
			if (frames && frames[rand]) this.anims.setCurrentFrame(frames[rand]);
			this.setFlipX(Math.random() >= 0.5 ? true : false);
		} else {
			let key = this.anims.getName();
			let frame = 1;
			if (key.includes("down")) frame = 3;
			if (key.includes("up")) frame = 1;
			if (key.includes("side")) frame = 2;
			this.anims.play("stand_" + this.getData("spriteNo"), true);
			if (frames && frames[frame]) this.anims.setCurrentFrame(frames[frame]);
		}
		this.anims.timeScale = 1;
		this.anims.stop();
	}
}

Person.prototype.wait = function (randomDirection = false) {
	// if(typeof this.scene === "undefined") return false;
	if (this.getLineData("spot") > 0 && this.getLineData("status") !== "waiting") this.scene.inLineCount(true, 1);
	this.setLineData("status", "waiting");
	this.setStill(randomDirection);
	this.resetMoveList();
	this.removeAllListeners();
};

export default Person;
