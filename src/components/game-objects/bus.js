import Phaser from "phaser";
import { config, ethUnits } from "./../config.js";
import { toRes, getSheetKey } from "./../utils/";

const Bus = new Phaser.Class({
	Extends: Phaser.GameObjects.Container,
	initialize: function Bus(scene) {
		Phaser.GameObjects.Container.call(this, scene, 0, 0);
		this.scene = scene;
		scene.add.existing(this);
		this.clickObject = "bus";
		this.setDepth(this.scene.topDepth);
		this.x = this.scene.busLane;

		this.drawers = {};
		this.drawersUsed = {};
		this.setData("color", Phaser.Display.Color.HexStringToColor(this.scene.config.busColor));
		this.floorColor = this.getData("color")
			.clone()
			.darken(40);
		this.textColor = this.scene.config.busColorText
			? Phaser.Display.Color.HexStringToColor(this.scene.config.busColorText)
			: this.floorColor;
		this.wallColor = this.getData("color")
			.clone()
			.darken(45);
		this.logoColor = this.scene.config.busColorLogo
			? Phaser.Display.Color.HexStringToColor(this.scene.config.busColorLogo)
			: this.getData("color")
				.clone()
				.darken(18);
		this.setScale(config.resolution);

		this.busHeight = this.scene.calcBusHeight(this.scene.config.busCapacityVisual || this.scene.config.busCapacity);
		if (this.busHeight < 1) this.busHeight = 1;

		//sprites
		this.busTopSprite = this.scene.add.image(0, -87, getSheetKey("bus_top.png"), "bus_top.png");
		this.busTopSprite.setTint("0x" + this.scene.config.busColor);
		this.busBottomSprite = this.scene.add.image(0, this.busHeight - 10, getSheetKey("bus_bottom.png"), "bus_bottom.png");
		this.busBottomSprite.setTint("0x" + this.scene.config.busColor);
		this.bottomSpriteName = "busBottomSprite";
		this.busMiddle = this.scene.add.rectangle(0, -59, 120, this.busHeight, "0x" + this.scene.config.busColor, 1);
		this.busMiddle.originalFill = "0x" + this.scene.config.busColor;
		this.busMiddle.setOrigin(0.5, 0);
		this.text1 = this.scene.add.bitmapText(-1, -91, "roboto", "" + this.getData("id"), 19);
		this.text1.setTint(this.textColor.color);
		this.text1.originalTint = this.textColor.color;
		this.text1.setOrigin(0.5);
		this.text2 = this.scene.add.bitmapText(0, -69, "roboto", "", 24);
		this.text2.setTint(this.textColor.color);
		this.text2.originalTint = this.textColor.color;
		this.text2.setOrigin(0.5);
		this.text3 = this.scene.add.bitmapText(0, -48, "roboto", "", 19);
		this.text3.setTint(this.textColor.color);
		this.text3.originalTint = this.textColor.color;
		this.text3.setOrigin(0.5);

		this.logo = this.scene.add.image(0, -35, getSheetKey("coin_logo"), this.scene.ticker.toLowerCase() + ".png");
		this.logo.setScale(0.6);
		this.logo.setTint(this.logoColor.color);
		this.logo.originalTint = this.logoColor.color;
		this.logo.setOrigin(0.5, 0);

		this.lightsSprite = [];
		this.lightsSprite[0] = this.scene.add.image(0, 107 + this.busHeight - 80, getSheetKey("lights.png"), "lights.png");
		this.doorSprite = this.scene.add.image(57, -76, getSheetKey("door.png"), "door.png");
		this.doorSprite.setTint("0x" + this.scene.config.busColor);
		this.backDoorSprite = this.scene.add.image(57, 45 + this.busHeight - 80, getSheetKey("door.png"), "door.png");
		this.backDoorSprite.setTint("0x" + this.scene.config.busColor);
		if (this.scene.side !== "right") {
			this.busTopSprite.setFlipX(true);
			this.busBottomSprite.setFlipX(true);
			this.doorSprite.setFlipX(true);
			this.backDoorSprite.setFlipX(true);
			this.doorSprite.x = -57;
			this.backDoorSprite.x = -57;
		}

		this.add(this.busMiddle);
		this.add(this.busTopSprite);
		this.add(this.busBottomSprite);
		this.add(this.logo);
		this.add(this.text1);
		this.add(this.text2);
		this.add(this.text3);
		this.add(this.doorSprite);
		this.add(this.backDoorSprite);
		this.add(this.lightsSprite[0]);

		this.tintObjects = [
			this.busTopSprite,
			this.busBottomSprite,
			this.logo,
			this.text1,
			this.text2,
			this.text3,
			this.doorSprite,
			this.backDoorSprite,
		];
		this.fillObjects = [this.busMiddle];
		this.busFloor = this.scene.add.rectangle(
			this.scene.side === "right" ? this.x + toRes(53) : this.x - toRes(60),
			this.y - toRes(100),
			7,
			toRes(this.busHeight + 90),
			this.floorColor.color,
			1
		);
		this.scene.busFloors.add(this.busFloor);
		this.busFloor.setOrigin(0, 0);
		this.busFloor.setScale(config.resolution);
		this.busFloor.setVisible(false);
		this.busFloor.setActive(false);

		this.hitArea = new Phaser.Geom.Rectangle(-60, -120, 120, 0);
		this.scene.customCallback("busConstructor", "after", this);
	},
});

Bus.prototype.newBus = function (atStop = true) {
	this.loaded = 0;
	this.loadedAlt = 0;
	this.feeArray = [];
	this.tx = [];
	this.lowFee = null;
	this.medianFee = null;
	this.highFee = null;
	this.baseFee = null;

	this.setData("created", Date.now());
	this.closeBackDoorTimer = false;
	this.hasTriggeredLight = false;
	this.setData("leaving", false);
	let busIndex = 1;
	let lastBus = false;
	for (let i = 0; i < this.scene.buses.children.entries.length; i++) {
		const loopBus = this.scene.buses.children.entries[i];
		if (loopBus.getData("leaving")) continue;
		if (loopBus.getData("id")) {
			lastBus = loopBus;
			if (lastBus.getData("id")) busIndex++;
		}
	}

	this.setData("id", this.scene.blockchain[this.scene.blockchain.length - 1].height + busIndex);

	this.busHeight = this.scene.calcBusHeight(this.scene.config.busCapacityVisual || this.scene.config.busCapacity);
	if (this.busHeight < 1) this.busHeight = 1;

	this.positionLogo();
	let y = this.scene.busStop + toRes(140);

	if (lastBus) {
		let lastBusBottom = lastBus[lastBus.bottomSpriteName].getBottomLeft(null, true).y;
		y = lastBusBottom + toRes(140);

		//move behind last bus in array
		this.scene.buses.children.entries.splice(
			this.scene.buses.children.entries.indexOf(lastBus) + 1,
			0,
			this.scene.buses.children.entries.splice(this.scene.buses.children.entries.indexOf(this), 1)[0]
		);
	} else {
		this.scene.buses.children.entries.splice(
			this.scene.buses.children.entries.length,
			0,
			this.scene.buses.children.entries.splice(this.scene.buses.children.entries.indexOf(this), 1)[0]
		);
	}
	if (!atStop) {
		y += toRes(500);
	}
	this.y = y;

	if (typeof this.scene.busArticulated !== "undefined") {
		let busChunk = (this.busHeight + 115) / this.scene.busArticulated;
		this.articulated = [];
		for (let i = 0; i < this.scene.busArticulated - 1; i++) {
			let art = this.scene.add.image(0, i * busChunk + 98, getSheetKey("bus_articulated.png"), "bus_articulated.png");
			art.setTint("0x" + this.scene.config.busColor);
			this.articulated.push(art);
			this.tintObjects.push(art);
			this.add(art);
		}
	}

	this.setActive(true);
	this.setVisible(true);

	this.busMiddle.displayHeight = this.busHeight;

	this.busFloor.setActive(true);
	this.busFloor.setY(y - toRes(100));
	this.busFloor.displayHeight = toRes(this.busHeight + 90);

	this.busBottomSprite.y = this.busHeight - 10;
	this.lightsSprite[0].y = 107 + this.busHeight - 80;
	this.backDoorSprite.y = 45 + this.busHeight - 80;

	this.text1.setText("#" + this.getData("id"));
	this.setFeeText();

	this.braking = false;
	this.brake();

	let totalHeight =
		this.busMiddle.displayHeight + this.busTopSprite.displayHeight + this.busBottomSprite.displayHeight;

	this.hitArea.setSize(120, totalHeight);
	this.setInteractive({
		hitArea: this.hitArea,
		hitAreaCallback: Phaser.Geom.Rectangle.Contains,
		useHandCursor: true,
	});
	this.scene.busInsideSingle(this);
	this.scene.customCallback("newBus", "after", this);
};

Bus.prototype.resize = function (size) {
	return size;
};

Bus.prototype.bye = function () {
	this.scene.busIdCache = {};
	this.scene.customCallback("byeBus", "before", this);
	this.setData("id", false);
	this.busFloor.setVisible(false);
	this.busFloor.setActive(false);
	this.setVisible(false);
	this.setActive(false);
	window.txStreetPhaser.streetController.removeFromRainbow(this);
	this.removeAllListeners();
	this.disableInteractive();
	if (typeof this.articulated !== "undefined") {
		for (let i = 0; i < this.articulated.length; i++) {
			let index = this.tintObjects.indexOf(this.articulated[i]);
			if (index) this.tintObjects.splice(index, 1);
			this.articulated[i].destroy();
		}
		this.articulated = [];
	}
	if (this.pplRt) {
		this.pplRt.destroy();
		delete this.pplRt;
	}
	if (this.mwebPplRt) {
		this.mwebPplRt.destroy();
		delete this.mwebPplRt;
	}
	if (this.roofCutout) {
		this.roofCutout.destroy();
		delete this.roofCutout;
	}
	if (this.boardedAnimTween) {
		this.boardedAnimTween.remove();
		delete this.boardedAnimTween;
	}
	if (this.entryArc) {
		this.entryArc.destroy();
		delete this.entryArc;
	}
	this.disableInteractive();
	this.scene.customCallback("byeBus", "after", this);
};

Bus.prototype.blockFormat = function () {
	let tx = this.tx;

	let obj = {};
	if (this.mwebTx) {
		tx = tx.concat(this.mwebTx);
		obj.mwebTxs = this.mwebTx.length;
	}
	obj.height = this.getData("id");
	obj.lowFee = typeof this.lowFee !== "undefined" && this.lowFee ? this.lowFee : 0;
	obj.highFee = typeof this.highFee !== "undefined" && this.highFee ? this.highFee : 0;
	obj.feeArray = typeof this.feeArray !== "undefined" && this.feeArray ? this.feeArray : false;
	obj.loaded = typeof this.realLoaded !== "undefined" && this.realLoaded ? Math.round(this.realLoaded) : 0;
	obj.loadedAlt = typeof this.loadedAlt !== "undefined" && this.loadedAlt ? Math.round(this.loadedAlt) : 0;
	obj.tx = tx;
	obj.txFull = tx;
	obj.txs = this.txsOverride ? this.txsOverride : tx.length;
	obj.busCapacity = this.scene.config.busCapacity;
	if (this.baseFee) obj.baseFee = ethUnits(this.baseFee);
	return obj;
};

Bus.prototype.switchSide = function (newSide) {
	this.x = this.scene.busLane;
	let flipped = newSide !== "right";
	this.busTopSprite.setFlipX(flipped);
	this.busBottomSprite.setFlipX(flipped);
	this.doorSprite.setFlipX(flipped);
	this.backDoorSprite.setFlipX(flipped);
	this.doorSprite.x = 57 * (flipped ? -1 : 1);
	this.backDoorSprite.x = 57 * (flipped ? -1 : 1);
	this.busFloor.x = flipped ? this.x - toRes(60) : this.x + toRes(53);
	if (this.entryArc) {
		this.entryArc.destroy();
		delete this.entryArc;
	}
};

Bus.prototype.getIndex = function (group = "buses") {
	for (let i = 0; i < this.scene[group].children.entries.length; i++) {
		let bus = this.scene[group].children.entries[i];
		if (bus.getData("uid") == this.getData("uid")) return i;
	}
	return false;
};

Bus.prototype.positionLogo = function () {
	if (this.busHeight < 60) {
		let newScale = (this.busHeight + 30) / 100;
		if (newScale > 0.6) newScale = 0.6;
		this.logo.setScale(newScale);
	} else {
		this.logo.setScale(0.6);
	}
};

Bus.prototype.setFeeText = function () {
	let text2 = this.feeText
		? this.feeText
		: this.lowFee
			? Math.ceil(this.lowFee) + " " + this.scene.vue.busFeeTitle
			: "";
	if (text2 !== this.text2.text) this.text2.setText(text2);

	let text3 = this.feeText2 || "";
	if (text3 !== this.text3.text) this.text3.setText(text3);
};

Bus.prototype.getAge = function () {
	let created = this.getData("created");
	if (!created) return false;
	let age = Date.now() - created;
	return age;
};

Bus.prototype.leave = function (block) {
	this.setData("leaving", true);
	let peopleBoarding = false;
	for (let i = 0; i < this.scene.people.children.entries.length; i++) {
		let person = this.scene.people.children.entries[i];
		if (!person.active) continue;
		if (person.getData("boarding") == this.getData("id")) peopleBoarding = true;
	}
	if (peopleBoarding) {
		setTimeout(() => {
			this.leave(block);
		}, 100);
	} else {
		let newHeight = this.scene.calcBusHeightFromBlock(block);
		if (newHeight < 0) newHeight = 0;
		let difference = Math.abs(this.busHeight - newHeight);

		let duration = 750;
		if (difference < 400) duration = 150;
		if (difference < 5) duration = 0;

		this.moveLength(
			newHeight,
			() => {
				this.leaveTween();
				this.unbrake();
				this.scene.forceCorrectLine = true;
			},
			duration,
			true
		);
	}
};

Bus.prototype.leaveTween = function () {
	if (this.movingTween) return;
	let distance = this.y + toRes(500 + this.busHeight);

	let duration = (distance / toRes(75)) * 100;
	duration *= window.txStreetPhaser.streetController.fpsTimesFaster;

	let doOnUpdate = true;

	this.movingTween = this.scene.add.tween({
		targets: [this],
		y: toRes(-500 - this.busHeight),
		ease: "Cubic.easeIn",
		duration: duration,
		onStart: () => {
			this.scene.busesMoving = true;
		},
		onComplete: () => {
			this.movingTween = null;
			this.bye();
			if (!this.scene.buses.countActive()) {
				let newBus = this.scene.addBus(false);
				newBus.moveToStop();
			}
		},
		onUpdate: tween => {
			if (!doOnUpdate) return false;
			this.busFloor.y = this.y - toRes(100);
			let firstWaiting = this.scene.firstBusWaiting();

			if (!firstWaiting) return;
			let gap = firstWaiting.y - (this.scene.busStop + toRes(140));
			if (gap <= 1) {
				this.scene.busesMoving = false;
				doOnUpdate = false;
				return;
			}
			let difference = tween.data[0].previous - tween.data[0].current;
			let braking = false;
			if (gap < 100) {
				let modifier = gap / 100;
				if (modifier < 0.1) modifier = 0.1;
				difference *= modifier;
				braking = true;
			}

			for (let i = 0; i < this.scene.buses.children.entries.length; i++) {
				let bus = this.scene.buses.children.entries[i];
				if (bus.getData("leaving")) continue;
				if (!bus.active) continue;

				bus.setY(bus.y - difference);
				bus.busFloor.y = bus.y - toRes(100);
				if (braking) {
					bus.brake();
				} else {
					bus.unbrake();
				}
			}
		},
	});
};

Bus.prototype.moveToStop = function (duration = 1400) {
	if (this.movingTween) return;
	duration *= window.txStreetPhaser.streetController.fpsTimesFaster;
	this.movingTween = this.scene.add.tween({
		targets: [this],
		y: this.scene.busStop + toRes(140),
		ease: "Cubic.easeInOut",
		duration: duration,
		onStart: () => {
			this.scene.busesMoving = true;
		},
		onComplete: () => {
			this.movingTween = null;
			this.scene.busesMoving = false;
		},
		onUpdate: () => {
			this.busFloor.y = this.y - toRes(100);
		},
	});
};

Bus.prototype.moveLength = function (value, callback, duration = 1000, moveBelow = false) {
	if (this.moveLengthActive) return;
	duration *= window.txStreetPhaser.streetController.fpsTimesFaster;
	let difference = this.busMiddle.displayHeight - value;
	if (this.roofCutout && this.roofCutout.visible && duration > 0) this.pplBlitter(true, true, value);
	let activeBuses = this.scene.activeBuses(false);
	let busId = Number(this.getData("id"));
	this.moveLengthActive = this.scene.add.tween({
		targets: [this.busMiddle],
		displayHeight: value,
		ease: "Power1",
		duration: duration,
		onComplete: () => {
			this.moveLengthActive = null;
			if (this.roofCutout) {
				this.createInside(true);
				if (this.roofCutout.visible) {
					this.pplBlitter(true, false, value);
				}
			}
			if (typeof callback === "function") callback();
		},
		onUpdate: e => {
			let change = toRes(e.data[0].current - e.data[0].previous);
			this.busFloor.displayHeight += change;
			if (moveBelow) {
				for (let i = 0; i < activeBuses.length; i++) {
					const belowBus = activeBuses[i];
					let belowBusId = Number(belowBus.getData("id"));
					if (belowBusId > busId) {
						belowBus.setY(belowBus.y + change);
						belowBus.busFloor.y = belowBus.y - toRes(100);
					}
				}
			}
			this.busHeight = this.busMiddle.displayHeight;
			this.hitArea.setSize(
				120,
				this.busMiddle.displayHeight + this.busTopSprite.displayHeight + this.busBottomSprite.displayHeight
			);
			this.positionLogo();
			if (typeof this.articulated !== "undefined") {
				for (let i = this.articulated.length - 1; i >= 0; i--) {
					let art = this.articulated[i];
					if (this.busMiddle.displayHeight < art.y + art.height) {
						art.destroy();
					}
				}
			}
			if (this.roofCutout && this.roofCutout.visible) {
				this.createInside(true);
			}
		},
	});
	this.moveLengthActive2 = this.scene.add.tween({
		targets: [this.busBottomSprite, this.backDoorSprite].concat(this.lightsSprite),
		y: target => {
			return target.y - difference;
		},
		ease: "Power1",
		duration: duration,
		onComplete: () => {
			this.moveLengthActive2 = null;
		},
	});

	this.scene.customCallback("moveLength", "after", [this, duration, value, difference]);
};

Bus.prototype.boardingY = function () {
	return this.busTopSprite.getTopLeft(null, true).y + this.scene.busDoorFromTop;
};

Bus.prototype.exitY = function () {
	return this.y + toRes(this.backDoorSprite.y);
};

Bus.prototype.brake = function () {
	if (this.braking) return true;
	this.lightsSprite.forEach(lightSprite => {
		lightSprite.tintFill = true;
		lightSprite.setTintFill(0xff3838);
	});
	this.braking = true;
};

Bus.prototype.unbrake = function () {
	if (!this.braking) return true;
	this.lightsSprite.forEach(lightSprite => {
		lightSprite.clearTint();
	});
	this.braking = false;
	this.doorClose();
	this.backDoorClose();
	this.busFloor.setVisible(false);
};

Bus.prototype.doorOpen = function () {
	this.doorSprite.setVisible(false);
	this.busFloor.setVisible(true);
};

Bus.prototype.backDoorOpen = function () {
	this.backDoorSprite.setVisible(false);
	this.busFloor.setVisible(true);
	let config = {
		delay: 1500,
		callback: function () {
			if (typeof this.closeBackDoorTimer.destroy === "undefined") return false;
			this.closeBackDoorTimer.destroy();
			this.closeBackDoorTimer = false;
			this.backDoorClose();
		},
		callbackScope: this,
		loop: false,
	};
	if (this.closeBackDoorTimer) {
		this.closeBackDoorTimer.reset(config);
		return true;
	}
	this.closeBackDoorTimer = this.scene.time.addEvent(config);
	return true;
};

Bus.prototype.doorClose = function () {
	if (this.doorSprite.visible) return false;
	for (let i = 0; i < this.scene.people.children.entries.length; i++) {
		let person = this.scene.people.children.entries[i];
		if (person.getData("boarding") == this.getData("id")) return false;
	}
	this.doorSprite.setVisible(true);
	return true;
};

Bus.prototype.backDoorClose = function () {
	this.backDoorSprite.setVisible(true);
};

Bus.prototype.createInside = function (redraw = false) {
	if (!redraw && !this.roofCutout) {
		this.roofCutout = this.scene.add.graphics();
	} else {
		this.roofCutout.clear();
	}
	this.roofCutout.fillStyle(this.floorColor.color, 1);
	this.roofCutout.fillRoundedRect(-55, -115, 110, this.busHeight + 103, 10);

	//mweb bus
	if (this.scene.ticker === "LTC") {
		this.roofCutout.fillStyle(0x154880, 1);
		this.roofCutout.fillRoundedRect(-48, this.busHeight + 180, 96, 64, 6);
	}

	this.roofCutout.fillStyle(this.wallColor.color, 1);
	this.roofCutout.fillRoundedRect(-55, -115, 110, 32, { tl: 10, tr: 10, br: 0, bl: 0 });
	this.roofCutout.fillStyle(0x55565a, 1);
	this.roofCutout.fillRoundedRect(-50, -110, 100, 22, 5);

	if (this.scene.ticker === "LTC") {
		this.roofCutout.fillRoundedRect(-45, this.busHeight + 183, 90, 20, 3);
	}
	if (!redraw) this.add(this.roofCutout);
};

//specifically for litecoin
Bus.prototype.pplBlitterMWEB = function (force = false, skipErase = false, overrideHeight = false, blockInfo) {
	let rtHeight = 54 * 4;
	let rtWidth = 442 - 75;
	blockInfo;
	let percentLoaded = this.mwebTx.length / 500;
	let rowsTotal = Math.floor((rtHeight - 15) / 15);
	rtHeight = Math.min(rtHeight, 5000);
	let rowsToFill = overrideHeight ? rowsTotal : Math.ceil(rowsTotal * percentLoaded);
	let pplPerRow = Math.ceil(this.mwebTx.length / rowsToFill);
	let everyX = Math.round(pplPerRow / 20);
	let spacing = (rtWidth - 64) / (pplPerRow - 1);
	if (pplPerRow < 2) spacing = rtWidth;

	if (!this.mwebPplRt) {
		this.mwebPplRt = this.scene.add.renderTexture(-45, 270, rtWidth, rtHeight);
		this.mwebPplRt.setDepth(200);
		this.add(this.mwebPplRt);
	} else {
		this.mwebPplRt.clear();
		this.mwebPplRt.resize(rtWidth, rtHeight);
	}
	if (!this.mwebDrawer)
		this.mwebDrawer = this.scene.add.blitter(0, 0, "characters").setVisible(false);
	this.mwebDrawer.clear();
	let xPos = 0;
	let row = 0;
	let randPos = false;
	if (spacing > 3) randPos = true;
	let rows = [];
	let draws = [];

	for (let i = 0; i < this.mwebTx.length; i++) {
		const tx = this.mwebTx[i];
		let newRow = Math.floor(i / pplPerRow) * 15;
		if (newRow > row) {
			xPos = 0;
			row = newRow;
			draws.sort(function (a, b) {
				return a[1] - b[1];
			});
			rows.push(draws);
			draws = [];
		}
		//if there are too many to see, skip every so often;
		if (pplPerRow < 11 || everyX < 3 || i % everyX == 0) {
			let random = (tx.random - 0.5) * 2;
			let finalXPos = randPos ? xPos + random * spacing : xPos;
			if (finalXPos < 0) finalXPos = Math.abs(finalXPos) / 3;
			if (finalXPos > rtWidth - 64) finalXPos = rtWidth - 64 - (finalXPos - (rtWidth - 64)) / 3;
			let finalYPos = row + random * 5;
			if (finalYPos < 0) finalYPos = 0;

			let textureFile = "ltc-0.png";
			let arr = [finalXPos,
				finalYPos,
				textureFile];

			draws.push(arr);
		}
		xPos += spacing;
	}
	if (draws.length) {
		draws.sort(function (a, b) {
			return a[1] - b[1];
		});
		rows.push(draws);
	}
	let drawerUsed = false;
	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		for (let j = 0; j < row.length; j++) {
			const draw = row[j];
			this.mwebDrawer.create(draw[0], draw[1], draw[2]);
			drawerUsed = true;
		}
	}

	if (!drawerUsed) return;
	this.mwebPplRt.draw(this.mwebDrawer, 0, 0);
	skipErase;
	force;
	this.mwebPplRt.setScale(0.25);
}

Bus.prototype.pplBlitter = function (force = false, skipErase = false, overrideHeight = false) {
	if (!this.visible) return false;

	let blockInfo = this.blockFormat();
	if (
		!force &&
		this.blitterBlock &&
		this.blitterBlock.txs === this.tx.length &&
		this.blitterBlock.loaded === blockInfo.loaded
	)
		return false;
	this.blitterBlock = blockInfo;

	//do mweb blitter
	if (this.scene.ticker === "LTC") this.pplBlitterMWEB(force, skipErase, overrideHeight, blockInfo);

	let busHeight = overrideHeight ? overrideHeight : this.busHeight;
	let rtHeight = (busHeight + 119) * 2;
	let rtWidth = 221;
	let percentLoaded = blockInfo.loaded / blockInfo.busCapacity;
	let rowsTotal = Math.floor((rtHeight - 15) / 15);
	rtHeight = Math.min(rtHeight, 5000);
	let rowsToFill = overrideHeight ? rowsTotal : Math.ceil(rowsTotal * percentLoaded);
	let pplPerRow = Math.ceil(this.tx.length / rowsToFill);
	let everyX = Math.round(pplPerRow / 20);
	let spacing = (rtWidth - 64) / (pplPerRow - 1);
	if (pplPerRow < 2) spacing = rtWidth;

	if (!this.pplRt) {
		this.pplRt = this.scene.add.renderTexture(-55, -98, rtWidth, rtHeight);
		this.add(this.pplRt);
	} else {
		this.pplRt.clear();
		this.pplRt.resize(rtWidth, rtHeight);
	}
	if (!this.drawers.sheet) {
		this.drawers.sheet = this.scene.add.blitter(0, 0, "characters").setVisible(false);
	}
	for (const sheet in this.scene.charConfig) {
		const c = this.scene.charConfig[sheet];
		if (sheet === "default") continue;
		const sheetKey = String(c.scaleAdjust) + String(c.pixelArt);
		if (!this.drawers[sheetKey]) {
			this.drawers[sheetKey] = this.scene.add.renderTexture(0, 0, rtWidth / c.scaleAdjust, rtHeight / c.scaleAdjust).setVisible(false);
			this.drawers[sheetKey].setScale(c.scaleAdjust);
			//FIX BLUR
			if (c.pixelArt) this.drawers[sheetKey].texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
		}
	}
	this.clearDrawers();
	let xPos = 0;
	let row = 0;
	let randPos = false;
	if (spacing > 3) randPos = true;
	let rows = [];
	let topRows = [];
	let draws = [];
	let topDraws = [];
	let followed = this.scene.txFollowersHashes.reduce((ac, a) => ({ ...ac, [a]: true }), {});
	for (let i = 0; i < this.tx.length; i++) {
		const tx = this.tx[i];
		let newRow = Math.floor(i / pplPerRow) * 15;
		if (newRow > row) {
			xPos = 0;
			row = newRow;
			draws.sort(function (a, b) {
				return a[1] - b[1];
			});
			topRows.push(topDraws);
			rows.push(draws);
			topDraws = [];
			draws = [];
		}
		//if there are too many to see, skip every so often;
		if (pplPerRow < 11 || everyX < 3 || i % everyX == 0 || tx.char || followed[tx.tx]) {
			let random = (tx.random - 0.5) * 2;
			let finalXPos = randPos ? xPos + random * spacing : xPos;
			if (finalXPos < 0) finalXPos = Math.abs(finalXPos) / 3;
			if (finalXPos > rtWidth - 64) finalXPos = rtWidth - 64 - (finalXPos - (rtWidth - 64)) / 3;
			let finalYPos = row + random * 5;
			if (finalYPos < 0) finalYPos = 0;

			let textureFile = (tx.char ? typeof tx.char === "string" ? tx.char + "-0.png" : tx.char?.texture : "person-" + tx.spriteNo * 9 + ".png");
			let arr = [finalXPos / (this.scene.charConfig?.[tx?.char?.sheet]?.scaleAdjust || 1),
			finalYPos / (this.scene.charConfig?.[tx?.char?.sheet]?.scaleAdjust || 1),
			tx?.char?.sheet || "characters",
				textureFile];
			if (tx.char || followed[tx.tx]) {
				arr.push(followed[tx.tx] ? true : false);
				topDraws.push(arr);
			} else {
				draws.push(arr);
			}
		}
		xPos += spacing;
	}
	if (draws.length) {
		draws.sort(function (a, b) {
			return a[1] - b[1];
		});
		rows.push(draws);
	}
	if (topDraws.length) {
		topRows.push(topDraws);
	}
	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		for (let j = 0; j < row.length; j++) {
			const draw = row[j];
			const sheet = draw[2];
			if (sheet === "characters") {
				this.drawers.sheet.create(draw[0], draw[1], draw[3]);
				this.drawersUsed.sheet = true;
			}
		}
	}
	this.doDraws();
	if (topRows.length) {
		this.clearDrawers();
		for (let i = 0; i < topRows.length; i++) {
			const row = topRows[i];
			for (let j = 0; j < row.length; j++) {
				const draw = row[j];
				const sheet = draw[2];
				if (sheet === "characters") {
					this.drawers.sheet.create(draw[0], draw[1], draw[3]);
					this.drawersUsed.sheet = true;
				}
				else {
					const c = this.scene.charConfig[sheet];
					const sheetKey = String(c.scaleAdjust) + String(c.pixelArt);
					this.drawers[sheetKey].drawFrame(sheet + "-" + draw[3], null, draw[0], draw[1]);
					this.drawersUsed[sheetKey] = true;
				}
			}
		}
		this.doDraws();
	}
	if (!skipErase) this.pplRt.erase(window.txStreetPhaser.streetController.busErase, 110, rtHeight - 43);
	this.pplRt.setScale(0.5);
};

Bus.prototype.clearDrawers = function () {
	for (const sheet in this.drawers) {
		const drawer = this.drawers[sheet];
		if (!this.drawersUsed[sheet]) continue;
		drawer.clear();
	}
	this.drawersUsed = {};
}

Bus.prototype.doDraws = function () {
	for (const sheet in this.drawers) {
		const drawer = this.drawers[sheet];
		if (!this.drawersUsed[sheet]) continue;
		this.pplRt.draw(drawer, 0, 0);
	}
}

Bus.prototype.openTop = function () {
	if (!this.roofCutout) {
		this.createInside();
	}
	this.pplBlitter();
	if (this.pplRt) this.pplRt.setVisible(true);
	if (this.mwebPplRt) this.mwebPplRt.setVisible(true);
	if (this.roofCutout) this.roofCutout.setVisible(true);
	if (this.entryArc) this.entryArc.setVisible(true).setAlpha(0);
};

Bus.prototype.closeTop = function () {
	if (this.pplRt) this.pplRt.setVisible(false);
	if (this.mwebPplRt) this.mwebPplRt.setVisible(false);
	if (this.roofCutout) this.roofCutout.setVisible(false);
	if (this.entryArc) this.entryArc.setVisible(false);
};

Bus.prototype.boardedAnim = function (person) {
	if (this.visible && this.roofCutout && this.roofCutout.visible) {
		if (typeof this.boardedAnimTween !== "undefined") this.boardedAnimTween.remove();
		if (!this.entryArc) {
			if (this.scene.side === "right") {
				this.entryArc = this.scene.add.arc(55, -79, 17, 90, 270, false, 0xffffff);
			} else {
				this.entryArc = this.scene.add.arc(-55, -79, 17, 270, 90, false, 0xffffff);
			}
			this.add(this.entryArc);
		}
		let maxScale = person.getData("maxScale");
		this.entryArc.setScale(maxScale * 3 - 0.8, 1);
		this.entryArc.setAlpha(maxScale);
		this.boardedAnimTween = this.scene.add.tween({
			targets: this.entryArc,
			alpha: 0,
			scaleX: this.entryArc.scaleX * 0.5,
			ease: "Expo.easeOut",
			duration: 1500 * window.txStreetPhaser.streetController.fpsTimesFaster,
		});
	}
};

Bus.prototype.setTint = function () { };

Bus.prototype.setTintFill = function () { };

Bus.prototype.clearTint = function () { };

export default Bus;
