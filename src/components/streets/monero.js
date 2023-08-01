import { Street } from "../street.js";
import { mirrorX, toRes, toResRev, getSheetKey } from "../utils/";
import { XMR } from "../config.js";
import { default as i18n } from "../../i18n";
import Popup from "../game-objects/popup";

export default class XMRStreet extends Street {
	constructor(side) {
		super(XMR, side);
	}

	init() {
		this.foundBoarding = false;
		this.busStop = toRes(200);
		this.busDoorFromTop = toRes(42);
		this.personPixelsPerSecond = 3;
		this.decelerationArea = toRes(500);
		this.sceneHeight = toRes(10000);
		this.lineLength = 9500;

		this.streetInit();
		this.stringLengths = {
			tx: [64],
		};
		this.sizeVar = "s";
		this.medianFeeStat = "medianFee-aByte";
		this.vueTxFormat = [
			{
				title: () => {
					return i18n.t(this.ticker.toLowerCase() + ".pid");
				},
				key: "pid",
			},
			{
				title: () => {
					return i18n.t(this.ticker.toLowerCase() + ".aByte");
				},
				key: "nByte",
			},
			{
				title: () => {
					return i18n.t(this.ticker.toLowerCase() + ".f");
				},
				key: "fx",
			},
			{
				title: () => {
					return i18n.t(this.ticker.toLowerCase() + ".s");
				},
				key: "s",
			},
		];
		this.bottomStats = this.config.stats;
	}

	beforeNewTx(data) {
		data.char = "isabella";
		data.nByte = Math.round(data.aByte / 1000);
		data.fx = data.f * 0.000000000001;
	}

	moneroBuses() {
		this.buses = this.add.group();
		let value = this.vue.stats.blockSizeLimit.value;
		this.config.busCapacity = value;
		this.config.busCapacityVisual = value * (value < 1000000 ? 1 + (1000000 - value) / 100000 / 20 : 1);
		if (typeof this.config.busCapacity === "undefined" || !this.config.busCapacity || !value) {
			setTimeout(() => {
				this.moneroBuses();
			}, 100);
			return false;
		}
		this.createBuses();
	}

	create() {
		super.create();
		this.createPeople();
		this.housesCreated = true;
		this.noHouses = true;
		this.noHousesArea = false;
		this.backgroundColor = "#f0de9c";
		this.streetCreate();
		this.houseCurb.setTintFill(0xf0d329);
		this.vue.busFeeTitle = "N/B";
		(this.vue.busFeeTitleLong = () => {
			return i18n.t(this.ticker.toLowerCase() + ".aByte");
		}),
			(this.vue.sizeTitle = () => {
				return i18n.t(this.ticker.toLowerCase() + ".sizeTitle");
			}),
			this.moneroBuses();
		this.createIsabella();
		this.createClouds();
		this.events.on("changeSide", () => {
			for (let i = this.clouds.children.entries.length - 1; i >= 0; i--) {
				const cloud = this.clouds.children.entries[i];
				this.destroyCloud(cloud);
			}
			this.destroyIsabella();
			this.createIsabella();
			this.createClouds();
		});
		this.events.on("checkView", obj => {
			let topMeasure = obj.cameraY - toRes(400);
			let bottomMeasure = obj.bottom + toRes(300);
			for (let i = 0; i < this.clouds.children.entries.length; i++) {
				let cloud = this.clouds.children.entries[i];
				let point = cloud.getLocalPoint(cloud.x, cloud.y);
				let y = cloud.y - point.y;
				if (y < topMeasure || y > bottomMeasure) {
					if (cloud.visible) {
						cloud.setVisible(false);
					}
				} else {
					if (!cloud.visible) {
						cloud.setVisible(true);
					}
				}
			}
		});
	}

	randomInteger(min, max) {
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}

	slightAdjust(value, random = Math.random(), intensity = 4) {
		let newValue = value * (1 - 1 / intensity / 2 + random / intensity);
		return newValue;
	}

	recreateCloud(cloud) {
		if (this.cloudHovered === cloud.origPos[4]) return false;
		let origPos = cloud.origPos;
		this.destroyCloud(cloud);
		this.createCloud(origPos[0], origPos[1], origPos[2], origPos[3], origPos[4]);
	}

	destroyCloud(cloud) {
		cloud.tween.remove();
		cloud.each(circle => {
			if (circle.tween) circle.tween.remove();
		});
		clearTimeout(cloud.timeout);
		cloud.timeout = null;
		cloud.destroy();
	}

	createCloud(width, height, posX, posY, depthAdd = this.clouds.children.entries.length) {
		let cloud = this.add.container(posX - width / 2, posY);
		this.clouds.add(cloud);
		cloud.origPos = [width, height, posX, posY, depthAdd];
		cloud.setDepth(this.overlayDepth + depthAdd);
		posY = this.slightAdjust(posY);
		//create big hump
		let humpLocation = Math.random() * (width * 0.4) + width * 0.3;
		let image = this.add.image(humpLocation, height / 2, "cloudCircle");
		let ds = this.slightAdjust(height * 0.85);
		image.setDisplaySize(ds, ds);
		cloud.add(image);

		image = this.add.image(
			humpLocation + this.slightAdjust(height / 2, Math.random(), 2),
			this.slightAdjust(height / 1.7),
			"cloudCircle"
		);
		ds = this.slightAdjust(height * 0.55);
		image.setDisplaySize(ds, ds);
		cloud.add(image);

		image = this.add.image(
			humpLocation - this.slightAdjust(height / 2, Math.random(), 2),
			this.slightAdjust(height / 1.7),
			"cloudCircle"
		);
		ds = this.slightAdjust(height * 0.55);
		image.setDisplaySize(ds, ds);
		cloud.add(image);

		//create bottom
		let bottomSize = height / 2.45;
		if (bottomSize > width) bottomSize = width / 2;
		let sizeWithGap = bottomSize / 2.2;

		let numCloudsWidth = Math.ceil(width / sizeWithGap);

		let row2height = 0;
		for (let i = 0; i < numCloudsWidth; i++) {
			let random = Math.random();
			let random2 = Math.random();
			let x = i * this.slightAdjust(sizeWithGap, random, 12);
			let y = this.slightAdjust(height - bottomSize / 2, random2, 14);
			let image = this.add.image(x, y, "cloudCircle");
			image.setDisplaySize(bottomSize, bottomSize);
			cloud.add(image);
			if (i > numCloudsWidth - 1) continue;
			row2height += x > humpLocation ? -1 : 1;

			let x2 = x + this.slightAdjust(bottomSize / 2);
			let y2 = y - this.slightAdjust((bottomSize / 5) * (1 + row2height / 3));
			image = this.add.image(x2, y2, "cloudCircle");
			image.setDisplaySize(bottomSize, bottomSize);
			cloud.add(image);
		}

		let colors = [0xecedef];
		let color = depthAdd % 2 == 0 ? 0xffffff : colors[Math.floor(Math.random() * colors.length)];
		cloud.each(circle => {
			if (!circle.setTint) return;
			circle.tween = this.add.tween({
				targets: circle,
				ease: "Sine.easeInOut",
				duration: Math.random() * 5000 + 5000,
				x: circle.x + Math.random() * 15 * (Math.random() > 0.5 ? 1 : -1),
				y: circle.y + Math.random() * 10 * (Math.random() > 0.5 ? 1 : -1),
				loop: -1,
				yoyo: true,
			});
			circle.tween.keep = true;
			circle.clickObject = "cloud";

			circle.setTint(color);
		});

		cloud.scrollFactorY = 1.5;
		cloud.tween = this.add.tween({
			targets: cloud,
			ease: "Sine.easeInOut",
			duration: Math.random() * 5000 + 5000,
			x: cloud.x + toRes(Math.random() * 18) * (Math.random() > 0.5 ? 1 : -1),
			y: cloud.y + toRes(Math.random() * 8) * (Math.random() > 0.5 ? 1 : -1),
			loop: -1,
			yoyo: true,
		});
		cloud.tween.keep = true;

		cloud.timeout = setTimeout(() => {
			this.recreateCloud(cloud);
		}, 120000 * Math.random() + 10000);
	}

	createCloudCords(y) {
		let width = Math.random() * 400 + 150;
		let height = 200;
		let x = Math.random() * 170 - 50;
		return [width, height, x, y];
	}

	createClouds() {
		if (!this.clouds) this.clouds = this.add.group();

		let clouds = [
			[400, 200, 90, -150],
			[150, 200, -10, 10],
			[201, 200, 15, 110],
			[300, 200, 65, 220],
			[400, 200, 115, 330],
			[250, 200, 300, 385],
		];

		for (let i = 440; i < toResRev(this.sceneHeight + 200) * 1.5; i += 110) {
			clouds.push(this.createCloudCords(i));

			if (Math.random() > 0.7) {
				let cords = this.createCloudCords(i + 55);
				cords[2] += 250;
				clouds.push(cords);
			}
		}

		for (let i = 0; i < clouds.length; i++) {
			const cloud = clouds[i];
			this.createCloud(toRes(cloud[0]), toRes(cloud[1]), mirrorX(cloud[2], this.side), toRes(cloud[3]));
		}
	}

	destroyIsabella() {
		clearInterval(this.isabella.isaChange);
		this.isabella.destroy();
		this.isapop.destroy();
	}

	cycleIsaMessage() {
		if (!this.isabella.isaChange) {
			this.isabella.currentMessage = 0;
			this.isabella.isaChange = setInterval(() => {
				this.cycleIsaMessage();
			}, 30000);
		}

		if (this.isapop) this.isapop.destroy();
		if (!this.isabella.messages[this.isabella.currentMessage]) {
			clearInterval(this.isabella.isaChange);
			delete this.isabella.isaChange;
			return;
		}
		this.isapop = new Popup(
			this,
			mirrorX(700, this.side),
			toRes(170),
			false,
			"bubble",
			this.isabella.messages[this.isabella.currentMessage++]
		);
	}

	createIsabella() {
		this.isabella = this.add.image(mirrorX(700, this.side), toRes(160), getSheetKey("isabella-0.png"), "isabella-0.png");
		this.isabella.setDisplaySize(toRes(64), toRes(64));
		this.isabella.setInteractive({ useHandCursor: true });
		this.isabella.on("pointerup", () => {
			this.cycleIsaMessage();
		});
		this.isabella.setDepth(this.personDepth);
		this.isabella.messages = [
			"Welcome to Monero Street! I'm Isabella.",
			"Are you an angel or is that a ring signature on your head?",
			"Why do we all look the same? We represent Monero's fungibility and privacy!",
			"That bus will automatically get larger in the future when the street gets busy. Monero has a dynamic block size limit.",
			"Don't ask where we come from. Without a sender's view key, it's impossible to see addresses associated with a transaction.",
		];
		this.cycleIsaMessage();
	}

	newSetInitialPosition(person) {
		let count = this.inLineCount(true);
		let cords = this.getLineCords(count);
		let yPos;
		let xPos;
		//check that the house exists on the street
		yPos = Math.random() * (cords[1] + toRes(1100));
		xPos = mirrorX(0, this.side);
		if (yPos < this.busStop) {
			yPos = -10;
			xPos = mirrorX(Math.random() * 150 + 50, this.side);
		}
		person.setPosition(xPos, yPos);
		person.halo = this.add.image(xPos, yPos - person.displayHeight / 2, getSheetKey("halo.png"), "halo.png");
		person.halo.setScale(person.scale * 2);
		person.halo.setDepth(500);
		person.halo.setAlpha(0.7);
	}

	replaceCreateMoveList(person) {
		let yPos = person.y;
		let minY = this.busStop - toRes(30);
		person.scaleSprite(person.getData("maxScale"));

		if (yPos < minY) {
			person.addMove(mirrorX(256, this.side), minY);
		}

		let peopleWaiting = this.inLineCount(true);
		let spot = this.lineStructure[person.getLineData("spot")];
		if (typeof spot === "undefined") spot = this.lineStructure[1];

		//house on same side, if theres a line, move to back
		if (peopleWaiting) {
			//first use walking lane to get to back
			person.addMove(this.walkingLane, spot[1], { status: "to_board" });
		}

		person.toBoardMove(false, false);
	}

	setMaxScalePerson(person = false, txSize) {
		let scale = 0.35;
		if (txSize < 1000) {
			scale = 0.35;
		} else if (txSize < 1200) {
			scale = 0.4;
		} else if (txSize < 1500) {
			scale = 0.45;
		} else if (txSize < 2500) {
			scale = 0.55;
		} else if (txSize < 7500) {
			scale = 0.65;
		} else if (txSize < 50000) {
			scale = 0.8;
		} else {
			scale = 1;
		}
		if (person) person.setData("maxScale", scale);
		return scale;
	}

	beforeByePerson(person) {
		if (person.halo) {
			person.halo.destroy();
			delete person.halo;
		}
	}

	update() {
		this.streetUpdate();
		for (let i = this.movingPeople.length - 1; i >= 0; i--) {
			let person = this.movingPeople[i];
			if (person.halo) {
				let halo = person.halo;
				halo.x = person.x;
				halo.y = person.y - person.displayHeight / 2;
				let toPass = mirrorX(256, this.side);
				let passed = ((person.x < toPass && this.side === "right") || (person.x > toPass && this.side !== "right"));
				if (passed && !person.halo.deleting) {
					person.halo.deleting = true;
					this.add.tween({
						targets: [halo],
						duration: 500 * window.txStreetPhaser.streetController.fpsTimesFaster,
						alpha: {
							getStart: () => 0.7,
							getEnd: () => 0,
						},
						onComplete: () => {
							if (halo) halo.destroy();
							if (person) delete person.halo;
						},
					});
				}
			}
		}
	}

	afterResume() {}
}

XMRStreet.config = XMR;
