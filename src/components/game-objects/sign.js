import Phaser from "phaser";
import { config, userSettings, zoomerNames } from "../config.js";
import { toRes, calcStatValue, getSheetKey } from "../utils/";

export default class Sign extends Phaser.GameObjects.Container {
	constructor(scene) {
		super(scene);
		this.scene = scene;
		scene.add.existing(this);

		this.setDepth(this.scene.personDepth - 1);
		this.y = this.scene.busStop - toRes(105);
		this.signWidth = toRes(430);
		this.adBanner = this.scene.ticker === "ETH" && process.env.VUE_APP_SIGN_ADS === "true" ? true : false;
		this.resetAd();
		this.createSign();
	}

	resetAd() {
		this.adText = "Your Ad Here with MoonHeads";
		this.adLink = "https://moonheads.io/ads";
		if (!this.adSprites) return;
		for (let i = 0; i < this.adSprites.length; i++) {
			const adSprite = this.adSprites[i];
			adSprite.setVisible(true);
		}
	}

	recreate() {
		if(this.leftPole) this.leftPole.destroy();
		if(this.rightPole) this.rightPole.destroy();
		if(this.poles) this.poles.destroy();
		this.signBg.destroy();
		if (this.signOutline) this.signOutline.destroy();
		// this.coinNameText.destroy();
		this.middleText.destroy();
		this.bottomText.destroy();
		this.createSign();
	}

	createSign() {
		this.x =
			(this.scene.side == "right" ? this.signWidth / 2 + toRes(4) : -this.signWidth / 2 - toRes(4)) +
			this.scene.curbX;

		let leftPoleX = -(this.signWidth / 2);
		let RightPoleX = this.signWidth / 2;


		if (this.scene.isMall) {
			this.poles = this.scene.add.graphics({ fillStyle: { color: 0xBEBEC0 } });
			this.poles.fillRect(leftPoleX + toRes(50), toRes(-100), toRes(20), toRes(100));
			this.poles.fillRect(RightPoleX - toRes(70), toRes(-100), toRes(20), toRes(100));
			this.poles.fillRect(RightPoleX, toRes(-20), toRes(50), toRes(10));
			this.poles.fillRect(leftPoleX - toRes(50), toRes(-20), toRes(50), toRes(10));

			this.add(this.poles);

			this.blockchainSign = this.scene.add.image(this.scene.side === "right" ? leftPoleX - toRes(55) : RightPoleX + toRes(55), toRes(-15), getSheetKey("spotlight_sign.png"), "stoplight_sign.png");
			this.blockchainSign.clickObject = "stoplight";
			this.blockchainSign.setInteractive({ cursor: "help" });
			this.blockchainSign.setScale(config.resolution);
			this.add(this.blockchainSign);

			this.rollupSign = this.scene.add.image(this.scene.side === "right" ? RightPoleX + toRes(55) : leftPoleX - toRes(55), toRes(-15), getSheetKey("rollup_sign" + (this.scene.side == "right"?"_right":"") + ".png"), "rollup_sign" + (this.scene.side == "right"?"_right":"") + ".png");
			this.rollupSign.clickObject = "rollup";
			this.rollupSign.setInteractive({ cursor: "help" });
			this.rollupSign.setScale(config.resolution);
			this.add(this.rollupSign);
		}
		else {
			this.leftPole = this.scene.add.image(leftPoleX, 0, getSheetKey("sign_pole.png"), "sign_pole.png");
			this.leftPole.setScale(config.resolution);
			this.rightPole = this.scene.add.image(RightPoleX, 0, getSheetKey("sign_pole.png"), "sign_pole.png");
			this.rightPole.setScale(config.resolution);
			this.rightPole.setFlipX(true);
			this.add(this.leftPole);
			this.add(this.rightPole);
		}

		let signTop = -(toRes(151) / 2);
		let signLeft = leftPoleX + toRes(7);
		let signHeight =
		toRes(151) - toRes(config.theme.signPolePadding) - toRes(this.adBanner ? 60 : 30);

		this.signBg = this.scene.add.graphics({ fillStyle: { color: config.theme.signBgColor } });
		this.signBg.fillRect(signLeft, signTop, this.signWidth - toRes(14), signHeight);

		this.fontSize = Math.floor(this.signWidth / (this.adBanner ? 13 : 11.5));
		let sixthSize = signHeight / 6;

		let signFontColor = Phaser.Display.Color.HexStringToColor(config.theme.signFontColor);
		this.middleText = this.scene.add.bitmapText(
			0,
			signTop + sixthSize * 2,
			"highway",
			"Loading...",
			this.fontSize
		);
		this.middleText.setOrigin(0.5, 0.5);
		this.middleText.setTint(signFontColor.color);

		this.bottomText = this.scene.add.bitmapText(0, signTop + sixthSize * 4, "highway", "", this.fontSize);
		this.bottomText.setOrigin(0.5, 0.5);
		this.bottomText.setTint(signFontColor.color);

		if (this.scene.isMall) {
			this.signOutline = this.scene.add.graphics({ fillStyle: { color: 0xBEBEC0 } });
			this.signOutline.fillRoundedRect(signLeft - toRes(8), signTop - toRes(8), this.signWidth + toRes(2), signHeight + toRes(16), toRes(6));
			this.add(this.signOutline);
		}
		this.add(this.signBg);
		this.add(this.middleText);
		this.add(this.bottomText);

		this.signEdit = this.scene.add.image(
			signLeft + this.signWidth - toRes(28),
			signTop + toRes(12),
			getSheetKey("edit.png"),
			"edit.png"
		);
		this.signEdit.setScale(toRes(0.5));
		this.signEdit.setAlpha(0.5);
		this.signEdit.setOrigin(0.5, 0.5);
		this.signEdit.setInteractive({ useHandCursor: true });
		this.signEdit.on("pointerup", e => {
			if (e.downElement.nodeName.toLowerCase() !== "canvas") return;
			this.scene.vue.editSign();
		});
		this.add(this.signEdit);

		if (this.adBanner) {
			//adSprites
			let adSpriteY = signTop + signHeight + toRes(50);
			this.adSprites = [];
			let adSpriteX = -((this.fontSize * (zoomerNames.length - 1)) / 2);
			for (let i = 0; i < zoomerNames.length; i++) {
				const name = zoomerNames[i];
				const fullName = name[0].toUpperCase() + name.substring(1);
				const adSprite = this.scene.add.image(adSpriteX, adSpriteY, getSheetKey(name + "-0.png"), name + "-0.png");
				adSprite.setScale(toRes(0.5));
				this.adSprites.push(adSprite);
				this.add(adSprite);
				adSpriteX += this.fontSize;
				let url =
					"https://opensea.io/collection/moonheads-zoomers?search[sortAscending]=true&search[sortBy]=PRICE&search[stringTraits][0][name]=Clan&search[stringTraits][0][values][0]=" + fullName;
				adSprite.setInteractive({ useHandCursor: true });
				adSprite.on("pointerup", e => {
					if (e.downElement.nodeName.toLowerCase() !== "canvas") return;
					window.open(url);
				});
			}

			this.bannerBg = this.scene.add.graphics({
				fillStyle: { color: Phaser.Display.Color.HexStringToColor("181818").color },
			});
			let outlineColor = Phaser.Display.Color.HexStringToColor("7a7b7c");
			this.bannerBg.fillRoundedRect(
				signLeft - toRes(11),
				signTop + signHeight,
				this.signWidth + toRes(8),
				toRes(32),
				toRes(5)
			);

			this.bannerBg.fillStyle(outlineColor.color);
			this.bannerBg.fillCircle(signLeft - toRes(2), signTop + signHeight + toRes(16), toRes(3));
			this.bannerBg.fillCircle(signLeft + this.signWidth - toRes(11), signTop + signHeight + toRes(16), toRes(3));
			this.add(this.bannerBg);
			this.scene.postFxPlugin.add(this.bannerBg, {
				thickness: toRes(1),
				outlineColor: outlineColor.color,
			});

			this.bannerInfo = this.scene.add.image(
				signLeft + this.signWidth - toRes(28),
				signTop + signHeight + toRes(15),
				getSheetKey("info.png"),
				"info.png"
			);
			this.bannerInfo.setScale(toRes(0.5));
			this.bannerInfo.setAlpha(0.5);
			this.bannerInfo.setOrigin(0.5, 0.5);
			this.bannerInfo.setInteractive({ useHandCursor: true });
			this.bannerInfo.on("pointerup", e => {
				if (e.downElement.nodeName.toLowerCase() !== "canvas") return;
				this.scene.vue.htmlWindow(
					"ad-info",
					"Your Ad Here",
					`The community places free ads here using MoonHeads. You can too! <a href="https://moonheads.io/ads" target="_blank">Click here</a> for more information.`
				);
			});
			this.add(this.bannerInfo);

			this.bannerText = this.scene.add.text(0, signTop + signHeight + toRes(16), this.adText, {
				fontSize: this.fontSize * 0.8,
				fontFamily: "Arial, sans-serif",
				fill: "#" + this.scene.config.busColor,
				metrics: {
					ascent: ((this.fontSize * 0.8) / toRes(18)) * toRes(17),
					descent: ((this.fontSize * 0.8) / toRes(18)) * toRes(4),
					fontSize: ((this.fontSize * 0.8) / toRes(18)) * toRes(21),
				},
			});
			this.bannerText.setOrigin(0.5, 0.5);
			this.bannerText.setInteractive({ useHandCursor: true });
			this.bannerText.on("pointerup", e => {
				if (e.downElement.nodeName.toLowerCase() !== "canvas") return;
				this.adClick();
			});
			this.add(this.bannerText);
			this.getAd();
			//simple solution to check again for the ad variable if it failed loading from api the first time
			setTimeout(() => {
				this.getAd();
			}, 15000);
		}
	}

	adClick() {
		if (this.adLink) window.open(this.adLink);
	}

	getAd() {
		for (let i = 0; i < window.mainVue.moonHeadAds.length; i++) {
			const ad = window.mainVue.moonHeadAds[i];
			if (ad.location === "ethSign") {
				this.setAd(ad);
			}
		}
	}

	setAd(ad) {
		if (!ad.text || !ad.link) return;
		if (!this.bannerText) return false;
		this.adText = ad.text;
		this.adLink = ad.link;
		this.bannerText.setText(this.adText);
		for (let i = 0; i < this.adSprites.length; i++) {
			const sprite = this.adSprites[i];
			sprite.setVisible(false);
		}
	}

	alternateStats(shorts = userSettings[this.scene.ticker + "Settings"].signArray.value) {
		this.currentShort = 0;
		this.alternatingShorts = shorts;
		if (this.alternatingTimer) {
			this.alternatingTimer.destroy();
		}
		this.alternatingTimer = this.scene.time.addEvent({
			delay: 5000,
			startAt: 4000,
			callback: function () {
				this.setSignToStat(this.alternatingShorts[this.currentShort], true);
				this.currentShort++;
				if (this.currentShort >= this.alternatingShorts.length) this.currentShort = 0;
			},
			callbackScope: this,
			loop: true,
		});
	}

	fitTextToSign(textObject) {
		if (parseFloat(textObject.fontSize) !== this.fontSize) textObject.setFontSize(this.fontSize);
		let widthFit = textObject.width / (this.signWidth - toRes(20));
		if (widthFit > 1) {
			textObject.setFontSize(this.fontSize / widthFit);
		}
	}

	setSignToStat(short, reset) {
		if (typeof this.scene.vue === "undefined" || typeof this.scene.vue.stats[short] === "undefined") return false;
		let stat = this.scene.vue.stats[short];
		if (typeof stat.title === "undefined" || typeof stat.value === "undefined") return false;
		let title = stat.signTitle ? stat.signTitle : stat.title;

		if (this.middleText.text != title) {
			this.middleText.setText(title);
			this.fitTextToSign(this.middleText);
		}
		let displayedValue = calcStatValue(stat);
		if (this.bottomText.text != displayedValue) {
			this.bottomText.setText(displayedValue);
			this.fitTextToSign(this.bottomText);
		}

		if (reset) {
			if (typeof this.signStatInterval !== "undefined") this.signStatInterval.destroy();
			this.signStatInterval = this.scene.time.addEvent({
				delay: 100,
				callback: function () {
					this.setSignToStat(short, false);
				},
				callbackScope: this,
				loop: true,
			});
		}
	}
}
