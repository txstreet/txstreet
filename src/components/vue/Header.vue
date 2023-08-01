<template>
	<div>
		<a href="/d/home" class="home-button button header-button"
			><span class="fas fa-home"></span
		></a>
		<a @click="openSettings" class="settings-button button header-button"
			><span class="fas fa-cog"></span
		></a>
	</div>
</template>

<script>
// @ts-nocheck

import Phaser from "phaser";
import OutlinePipelinePlugin from "phaser3-rex-plugins/plugins/outlinepipeline-plugin.js";
import { createListeners } from "../listeners.js";
import { StreetController } from "../street-controller";
import { config, userSettings, applySavedSettings } from "../config.js";
import { getGPUTier } from "detect-gpu";

export default {
	async mounted() {
		if (this.$root.loaded) return;
		this.startViz();
	},
	methods: {
		startViz: async function () {
			await this.setGpuVars();
			config.scene = [StreetController];
			config.type = Phaser.WEBGL;
			config.scale = {
				mode: Phaser.Scale.NONE,
			};
			config.plugins = {
				global: [
					{
						key: "rexOutlinePipeline",
						plugin: OutlinePipelinePlugin,
						start: true,
					},
				],
			};
			window.txStreetPhaser = new Phaser.Game(config);
			createListeners(window.txStreetPhaser);
		},
		setGpuVars: async function () {
			if (
				!userSettings.globalSettings.fps.initialUserLoaded ||
				!userSettings.globalSettings.antialias.initialUserLoaded ||
				!userSettings.globalSettings.resWidth.initialUserLoaded
			) {
				console.log("analyzing gpu", Date.now());
				const gpuTier = await getGPUTier();
				console.log("done analyzing gpu", Date.now(), gpuTier);
				let fps = 60;
				let antialias = true;
				let resWidth = 1920;
				let tier = gpuTier?.tier || 3;
				if(gpuTier.gpu && gpuTier.gpu === "apple gpu (Apple GPU)") tier = 3;
				switch (tier) {
					case 0:
						fps = 10;
						antialias = false;
						break;
					case 1:
						fps = 15;
						antialias = false;
						break;
					case 2:
						fps = 30;
						antialias = false;
						break;
					case 3:
						fps = 60;
						break;
					default:
						break;
				}
				if (gpuTier.isMobile) {
					if (fps > 30) fps = 30;
					antialias = false;
				}
				if (tier < 2 && userSettings.globalSettings.resWidth.value > 1440) {
					resWidth = 1440;
				}
				if (!userSettings.globalSettings.resWidth.initialUserLoaded) {
					config.resolution = resWidth / 1920;
					userSettings.globalSettings.resWidth.value = resWidth;
				}
				if (!userSettings.globalSettings.fps.initialUserLoaded) {
					config.fps.target = fps;
					config.fps.min = fps;
					config.fps.forceSetTimeOut = fps < 60;
					userSettings.globalSettings.fps.value = fps;
				}
				if (!userSettings.globalSettings.antialias.initialUserLoaded) {
					config.antialias = antialias;
					userSettings.globalSettings.antialias.value = antialias;
				}
				applySavedSettings();
			}
		},
		openSettings: function () {
			let street = this.getStreet();
			street.vue.settingsTab = "globalSettings";
			if (!street.vue.activeWindows.includes("settings")) {
				//open settings
				street.vue.toggleWindow("settings");
			}
		},
		getStreet: function () {
			return window.txStreetPhaser.streetController.getLeftStreet();
		},
	},
};
</script>
<style lang="scss" scoped>
.header-button{
	line-height: 1.5rem;
	font-size: min(3.5vw, 1.5rem);
	position: fixed;
	top:0;
	z-index: 40;
	border: none;
}
.settings-button{
	right:0px;
}
.home-button{
	left:0px;
}
</style>