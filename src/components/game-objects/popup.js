import Phaser from "phaser";
import { toRes, toResRev } from "./../utils/";

export default class Popup extends Phaser.GameObjects.Container {
	constructor(scene, x, y, house, type, text, length = false) {
		super(scene);
		this.scene = scene;
		scene.add.existing(this);

		this.setDepth(this.scene.overlayDepth);
		this.border = 0;
		this.side = "left";
		this.x = x;
		this.y = y;
		if (this.x > toRes(480)) this.side = "right";
		this.maxWidth = toRes(300);
		this.width = toRes(1000);
		this.height = toRes(1000);
		this.triangleSize = toRes(20);
		this.house = house ? this.scene.housePlans[house] : {};
		this.radius = toRes(16);
		this.contents = text;
		this.timeLength = length;
		this.createSpeechBubble();
		this.setDestroy();
		this.clickObject = "popup";
	}

	bye() {
		this.destroy();
	}

	setDestroy() {
		if (!this.timeLength) return false;
		setTimeout(() => {
			if (!this) return false;
			this.bye();
		}, this.timeLength);
	}

	createSpeechBubble() {
		if (!this.house.bubbleCount) this.house.bubbleCount = 0;

		this.bubbleText = this.scene.add.text(0, 0, this.contents, {
			fontSize: toRes(18) + "px",
			fontFamily: 'Arial, sans-serif',
			fill: "#000",
			wordWrap: { width: this.maxWidth, useAdvancedWrap: true },
			metrics: {
				ascent: toRes(17),
				descent: toRes(4),
				fontSize: toRes(21),
			},
		});
		this.bubbleText.setResolution(toResRev());
		this.add(this.bubbleText);
		this.width = this.bubbleText.width + toRes(20);
		this.height = this.bubbleText.height + toRes(20);
		if (this.height < this.radius * 2 + this.triangleSize) this.height = this.radius * 2 + this.triangleSize;
		if (this.width < this.radius * 2 + this.triangleSize) this.width = this.radius * 2 + this.triangleSize;

		this.bubbleText.setOrigin(0.5);
		this.bubbleText.setPosition(this.width / 2, this.height / 2);

		this.background = this.scene.add.graphics();
		this.background.fillStyle(0xffffff, 1);
		this.background.lineStyle(this.border, 0xffff00, 1);
		this.background.fillRoundedRect(0, 0, this.width, this.height, this.radius);
		if (this.border > 0) this.background.strokeRoundedRect(0, 0, this.width, this.height, this.radius);
		this.add(this.background);
		this.sendToBack(this.background);

		if (this.house.bubbleCount % 2) {
			this.createBubbleTriange(this.side == "right" ? "right" : "left", this.height, toRes(20));
		} else {
			this.createBubbleTriange("top", this.side == "right" ? this.width : 0, toRes(20));
		}
		this.house.bubbleCount++;
		let hitArea = new Phaser.Geom.Rectangle(this.width / 2, this.height / 2, this.width, this.height);
		this.setInteractive({
			hitArea: hitArea,
			hitAreaCallback: Phaser.Geom.Rectangle.Contains,
			useHandCursor: true,
		});
	}

	createBubbleTriange(position, offset, offset2) {
		let minOffset = this.radius;
		let maxOffset;
		let point1Y;
		let point2Y;
		let point3Y;
		let point1X;
		let point2X;
		let point3X;
		if (offset < minOffset) offset = Math.floor(minOffset);

		if (position == "top" || position == "bottom") {
			maxOffset = this.width - this.radius - this.triangleSize;
			if (offset > maxOffset) offset = Math.floor(maxOffset);
			point1X = offset;
			point2X = point1X + this.triangleSize;
			point3X = offset + this.triangleSize / 2;
			this.x -= offset + this.triangleSize / 2;
		}
		if (position == "top") {
			this.y += this.triangleSize + offset2;
			//triangle on opposite side
			point1Y = 1;
			point2Y = 1;
			point3Y = Math.floor(1 - this.triangleSize);
		}
		if (position == "bottom") {
			this.y -= this.height + this.triangleSize + offset2;
			point1Y = this.height - 1;
			point2Y = this.height - 1;
			point3Y = Math.floor(this.height - 1 + this.triangleSize);
		}
		if (position == "left" || position == "right") {
			maxOffset = this.height - this.radius - this.triangleSize;
			if (offset > maxOffset) offset = Math.floor(maxOffset);
			point1Y = offset;
			point2Y = offset + this.triangleSize;
			point3Y = offset + this.triangleSize / 2;
			this.y -= offset + this.triangleSize / 2;
		}
		if (position == "left") {
			this.x += this.triangleSize + offset2;
			point1X = 1;
			point2X = 1;
			point3X = Math.floor(1 - this.triangleSize);
		}
		if (position == "right") {
			this.x -= this.width + this.triangleSize + offset2;
			point1X = this.width - 1;
			point2X = this.width - 1;
			point3X = Math.floor(this.width - 1 + this.triangleSize);
		}
		this.background.fillTriangle(point1X, point1Y, point2X, point2Y, point3X, point3Y);
		if (this.border > 0) {
			this.background.lineBetween(point2X, point2Y, point3X, point3Y);
			this.background.lineBetween(point1X, point1Y, point3X, point3Y);
		}
	}
}
