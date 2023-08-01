<template>
	<div class="container">
		<span v-html="title"></span>
		<br />
		<span
			><button v-if="showButton" @click="tutorialStep" class="button">{{ buttonText }}</button></span
		>
	</div>
</template>
<script>
import i18n from "../../../i18n";
export default {
	i18n,
	data: function () {
		return {
			title: i18n.t("messages.first-time"),
			buttonText: i18n.t("messages.show-around"),
			tutorialIntervalStep: 0,
			tutorialIntervalFunction: null,
			showButton: true,
			currentStep: 1,
		};
	},
	beforeDestroy() {
		this.closeTutorial();
	},
	methods: {
		closeTutorial() {
			this.tutorialIntervalStep = 1;
			if (typeof this.tutorialIntervalFunction === "function") this.tutorialIntervalFunction();
			localStorage.setItem("tutorialDone", true);
			if (this.tutorialInterval) clearInterval(this.tutorialInterval);
			window.txStreetPhaser.streetController.createLedgerTimeout();
		},
		tutorialStep() {
			if (typeof this.tutorialIntervalFunction === "function") {
				this.tutorialIntervalStep = 1;
				this.tutorialIntervalFunction();
			}

			clearInterval(this.tutorialInterval);
			this.tutorialInterval = false;
			this.tutorialIntervalFunction = false;
			this.tutorialIntervalStep = 0;
			this.buttonText = this.$i18n.t("general.continue");

			if (this.currentStep == 1) {
				this.title = this.$i18n.t("messages.tut-1");

				this.tutorialIntervalFunction = () => {
					if (this.tutorialIntervalStep % 2 === 0) {
						window.txStreetPhaser.streetController.colorSpriteGroup("people", 0x0bc2a6, true);
						window.txStreetPhaser.streetController.colorSpriteGroup("peopleWaiting", 0x0bc2a6, true);
					} else {
						window.txStreetPhaser.streetController.colorSpriteGroup("people", false);
						window.txStreetPhaser.streetController.colorSpriteGroup("peopleWaiting", false);
					}
					this.tutorialIntervalStep++;
				};
			} else if (this.currentStep == 2) {
				this.title = this.$i18n.t("messages.tut-2");
				this.tutorialIntervalFunction = () => {
					if (this.tutorialIntervalStep % 2 === 0) {
						window.txStreetPhaser.streetController.colorSpriteGroup("houses", 0x0bc2a6, false);
					} else {
						window.txStreetPhaser.streetController.colorSpriteGroup("houses", false);
					}
					this.tutorialIntervalStep++;
				};
			} else if (this.currentStep == 3) {
				this.title = this.$i18n.t("messages.tut-3");
				this.tutorialIntervalFunction = () => {
					if (this.tutorialIntervalStep % 2 === 0) {
						window.txStreetPhaser.streetController.colorSpriteGroup("buses", 0x0bc2a6, false);
						window.txStreetPhaser.streetController.colorSpriteGroup("busesLeaving", 0x0bc2a6, false);
					} else {
						window.txStreetPhaser.streetController.colorSpriteGroup("buses", false);
						window.txStreetPhaser.streetController.colorSpriteGroup("busesLeaving", false);
					}
					this.tutorialIntervalStep++;
				};
			} else if (this.currentStep == 4) {
				this.title = this.$i18n.t("messages.tut-4");
				this.tutorialIntervalFunction = () => {
					if (this.tutorialIntervalStep % 2 === 0) {
						window.txStreetPhaser.streetController.colorClass("coin-dropdown-button", "0bc2a6");
					} else {
						window.txStreetPhaser.streetController.colorClass("coin-dropdown-button", false);
					}
					this.tutorialIntervalStep++;
				};
			} else {
				this.title = this.$i18n.t("messages.tut-5");
				this.showButton = false;
				setTimeout(() => {
          this.closeTutorial();
					this.$emit("close-toast");
				}, 3000);
				return true;
			}
			this.currentStep++;

			if (typeof this.tutorialIntervalFunction === "function")
				this.tutorialInterval = setInterval(this.tutorialIntervalFunction, 750);
		},
	},
};
</script>