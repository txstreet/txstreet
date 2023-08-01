<template>
	<div id="vue-main" :class="{ 'dark-mode': darkMode }">
		<transition name="fade">
			<Landing
				:ref="'landing'"
				:class="loading ? 'loading-disabled' : ''"
				v-if="loadError || (!loaded && (!loadVisualizer || loading) && !autoLoading)"
			/>
		</transition>
		<transition name="fade">
			<VizLauncher v-if="(autoLoading && loading) || (loading && loaded)" />
		</transition>
		<Header id="main-header" ref="header" v-if="loadVisualizer && !loadError" />
		<transition name="fade">
			<div class="disable-auto-launch tag has-text-centered" v-if="autoLoading && loading && !loaded">
				Toggle auto launch in the visualizer settings.
			</div>
		</transition>
	</div>
</template>

<script>
import Landing from "./landing/Landing.vue";
import { config, enabledConfig } from "../config.js";
import Vue from "vue";
import { leaveStaleRooms } from "../utils";
import eventHub from "./eventHub";
import VizLauncher from "./landing/templates/VizLauncher.vue";
// @ts-nocheck

export default {
	components: {
		Header: () => import("./Header.vue"),
		Landing,
		VizLauncher,
	},
	data: function () {
		return {
			loading: false,
			loaded: false,
			loadError: false,
			loadVisualizer: false,
			darkMode: true,
			autoLoad: false,
			autoLoading: false,
			selectedCoins: ["ETH", "BTC"],
			now: 0,
			nowMinute: 0,
			moonHeadAds: [],
			windowWidth: window.innerWidth,
			windowHeight: window.innerHeight,
			softWindowHeight: window.innerHeight,
			previousSoftWindowHeight: window.innerHeight,
		};
	},
	beforeMount() {
		let boolSettings = ["autoLoad", "darkMode"];
		for (let i = 0; i < boolSettings.length; i++) {
			const setting = boolSettings[i];
			let val = localStorage.getItem(setting);
			if (val) val = Boolean(JSON.parse(val));
			if (typeof val === "boolean") {
				this[setting] = val;
			}
		}

		this.setAutoLoad();
		this.replaceVizPage();
	},
	mounted() {
		this.nowInterval();
		this.getAd();

		//temp disable
		setInterval(() => {
			leaveStaleRooms();
		}, 10000);
		this.$nextTick(() => {
			window.addEventListener("resize", () => {
				this.windowWidth = window.innerWidth;
				eventHub.$emit("windowWidth", this.windowWidth);
				this.windowHeight = window.innerHeight;
				eventHub.$emit("windowHeight", this.innerHeight);

				if (this.relDiff(window.innerHeight, this.previousSoftWindowHeight) > 15) {
					this.softWindowHeight = window.innerHeight;
					this.previousSoftWindowHeight = window.innerHeight;
					eventHub.$emit("softWindowHeight", this.softWindowHeight);
				}
			});
		});
	},
	computed: {
		appVersion: function () {
			return process.env.VUE_APP_VERSION;
		},
		config: function () {
			return config;
		},
		enabledConfig: function () {
			return enabledConfig;
		},
	},
	methods: {
		relDiff(a, b) {
			return 100 * Math.abs((a - b) / ((a + b) / 2));
		},
		setAutoLoad() {
			let pathArray = window.location.pathname.split("/");
			if (this.autoLoad || pathArray[pathArray.length - 1] === "launch") {
				if (!pathArray.includes("d")) {
					this.autoLoading = true;
					this.loading = true;
					this.loadVisualizer = true;
				}
			}
		},
		bgColor(ticker) {
			if (!ticker) return "000000";
			let coinConfig = this.enabledConfig[ticker];
			return coinConfig?.color || "000000";
		},
		async getAd(retry = 0) {
			if (retry > 3) return;
			let url = process.env.VUE_APP_MOONHEADS_SERVER + "/api/currentAd";
			let response = await fetch(url);
			let json = await response.json();
			if (Array.isArray(json)) {
				Vue.set(this, "moonHeadAds", json);
			} else {
				setTimeout(() => {
					retry++;
					this.getAd(retry);
				}, 5000);
			}
		},
		nowInterval() {
			setInterval(() => {
				this.now = Math.floor(Date.now() / 1000);
			}, 1000);

			setInterval(() => {
				this.nowMinute = Math.floor(Date.now() / 1000);
			}, 60000);
		},
		changeVisDropdown(i, coin, setTitle = true) {
			let otherIndex = !i ? 1 : 0;
			if (this.selectedCoins[otherIndex] === coin) this.selectedCoins[otherIndex] = this.selectedCoins[i];
			Vue.set(this.selectedCoins, i, coin);
			if (setTitle) this.setTitleFromDropdown();
		},
		setTitleFromDropdown() {
			let dual = this.selectedCoins[0] && this.selectedCoins[1];
			this.$root.changeHomeUrl(
				dual
					? this.selectedCoins[0] + "-" + this.selectedCoins[1]
					: this.selectedCoins[0] || this.selectedCoins[1],
				false,
				true
			);
		},
		openVisualizer() {
			this.loading = true;
			this.loadVisualizer = true;
		},
		getVizTitleFromURL(pathname = false, updateDrops = false, onlyName = false) {
			let title = "";
			let names = [];
			let pathArray = (pathname || window.location.pathname).split("/");
			if (updateDrops && pathArray.includes("v")) this.selectedCoins = [null, null];
			for (let i = 0; i < pathArray.length; i++) {
				let pathPart = pathArray[i];
				if (pathPart == "v" && typeof pathArray[i + 1] !== "undefined") {
					let streetsString = pathArray[i + 1];
					let streetsArray = streetsString.split("-");
					for (let j = 0; j < streetsArray.length; j++) {
						let street = streetsArray[j];
						for (var ticker in this.enabledConfig) {
							if (street.toUpperCase() === ticker) {
								if (updateDrops) Vue.set(this.selectedCoins, j, ticker);
								names.push(this.enabledConfig[ticker].coinName);
							}
						}
					}
				}
			}
			if (names.length === 1) {
				title = names[0];
			} else if (names.length === 2) {
				title = names[0] + " & " + names[1];
			} else {
				return false;
			}
			if (onlyName) return title;
			title += " Transaction Visualizer - TxStreet.com";
			return title;
		},
		getVizTitleFromStreets(changeHomeUrl = true, pushState = false) {
			if (!window.txStreetPhaser || !window.txStreetPhaser.streetController) return false;
			let endingString = "";
			let title = "";
			let possibleArray = [
				window.txStreetPhaser.streetController.getSideStreet("left"),
				window.txStreetPhaser.streetController.getSideStreet("right"),
				window.txStreetPhaser.streetController.getSideStreet("full"),
			];
			for (let i = 0; i < possibleArray.length; i++) {
				let possible = possibleArray[i];
				if (!possible || window.txStreetPhaser.scene.isSleeping(possible)) continue;
				if (endingString.length) endingString += "-";
				if (possible.side == "full") endingString = "";
				endingString += possible.ticker;
				title += possible.config.coinName + " & ";
			}
			title = title.slice(0, -3);
			title += " Transaction Visualizer - TxStreet.com";
			if (changeHomeUrl) this.changeHomeUrl(endingString, title, true, pushState);
			return title;
		},
		changeHomeUrl(endingString, title = false, changeTitle = false, pushState = false) {
			if (!title) title = this.getVizTitleFromURL("v/" + endingString);
			this.changeUrl("v/" + endingString.toLowerCase(), title, changeTitle, pushState);
		},
		changeUrl(endingString, title = false, changeTitle = false, pushState = false) {
			history[pushState ? "pushState" : "replaceState"](
				endingString ? endingString : "d/home",
				title,
				window.location.origin +
					config.baseUrl +
					endingString +
					(!pushState && window.location.search ? window.location.search : "")
			);
			document
				.querySelector('meta[property="og:url"]')
				.setAttribute("content", window.location.origin + config.baseUrl + endingString);
			if (changeTitle) this.changeTitle(title);
		},
		replaceVizPage() {
			let title = "";
			if (!this.loaded) {
				title = this.getVizTitleFromURL(false, true);
			} else {
				title = this.getVizTitleFromStreets();
			}
			if (title) this.changeTitle(title);
		},
		changeTitle(title) {
			document.getElementsByTagName("title")[0].innerHTML = title;
			document.querySelector('meta[name="twitter:title"]').setAttribute("content", title);
			document.querySelector('meta[property="og:title"]').setAttribute("content", title);
		},
		changeDesc(desc) {
			document.querySelector('meta[property="og:description"]').setAttribute("content", desc);
			document.querySelector('meta[name="twitter:description"]').setAttribute("content", desc);
			document.querySelector('meta[name="description"]').setAttribute("content", desc);
		},
		changeImg(img) {
			document.querySelector('meta[name="twitter:image"]').setAttribute("content", img);
			document.querySelector('meta[name="og:image"]').setAttribute("content", img);
		},
		i18n: function (val) {
			return typeof val === "function" ? val() : val;
		},
	},
	watch: {
		darkMode(val) {
			localStorage.setItem("darkMode", Boolean(val));
		},
		autoLoad(val) {
			localStorage.setItem("autoLoad", Boolean(val));
		},
		selectedCoins(val) {
			if (val[0] === null && val[1] !== null) {
				this.selectedCoins[0] = val[1].toUpperCase();
				this.selectedCoins[1] = null;
			}
		},
	},
};
</script>
<style lang="scss" scoped>
.loading-disabled {
	pointer-events: none;
	* {
		opacity: 0.5;
	}
}

.fade-leave-active {
	transition: opacity 0.2s;
}
.fade-enter,
.fade-enter-active {
	opacity: 1;
}
.fade-leave-to {
	opacity: 0;
}
.disable-auto-launch {
	position: fixed;
	bottom: 0;
	left: 0;
	width: 100%;
	z-index: 501;
	border-radius: 0;
}
</style>