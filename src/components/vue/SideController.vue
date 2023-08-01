<template>
	<div class="side" :class="[side, { 'is-hidden': hidden, 'dark-mode': darkMode }]">
		<nav class="navbar" role="navigation" aria-label="navigation" :style="'justify-content:center'">
			<div
				class="coin-dropdown-button button is-medium"
				@click="dropdownActive = !dropdownActive"
				:class="{ 'is-primary': dropdownActive }"
			>
				<span
					class="coin-logo"
					:style="'background-color: ' + (darkMode ? 'transparent' : ' #' + coinConfig.color) + ';'"
				>
					<img
						:src="
							config.baseUrl +
							'static/img/singles/coin_logos/' +
							coinConfig.ticker.toLowerCase() +
							'.png?v=' +
							appVersion
						"
						width="48"
						height="48"
					/>
				</span>
				<span>{{ coinConfig.coinName }}</span>
				<span class="icon is-normal"><i class="fas fa-chevron-down"></i></span>
			</div>

			<div v-if="dropdownActive" class="coin-dropdown-container">
				<div class="coin-dropdown box">
					<search key="search" ref="search"></search>
					<div class="coin-dropdown-section section">
						<div class="subtitle is-4 has-text-centered">Change Street</div>
						<div class="columns is-multiline">
							<div
								v-for="(street, key) in game.streetController.enabledStreets"
								:key="key"
								class="column has-text-centered"
							>
								<div
									class="button is-medium"
									v-on:click="switchStreet(side, street)"
									:class="{ 'is-primary': street.config.coinName == coinConfig.coinName }"
								>
									<span
										class="coin-logo"
										:style="
											'background-color: ' +
											(darkMode ? 'transparent' : ' #' + street.config.color) +
											';'
										"
									>
										<img
											:src="
												config.baseUrl +
												'static/img/singles/coin_logos/' +
												street.config.ticker.toLowerCase() +
												'.png?v=' +
												appVersion
											"
											width="48"
											height="48"
										/>
									</span>
									<span>{{ street.config.coinName }}</span>
								</div>
							</div>
						</div>
						<div class="buttons has-addons is-centered">
							<button
								@click="switchStreet('full')"
								:class="{ 'is-primary': side === 'full' }"
								class="button"
							>
								{{ $t("general.single-view") }}
							</button>
							<button
								@click="switchStreet('left')"
								:class="{ 'is-primary': side !== 'full' }"
								class="button"
							>
								{{ $t("general.dual-view") }}
							</button>
						</div>
					</div>
					<div class="coin-dropdown-section section">
						<div class="subtitle is-4 has-text-centered">Toggle Window</div>
						<div class="columns is-multiline">
							<div v-for="item in navigation" :key="item.key" class="column has-text-centered">
								<div
									class="button is-medium"
									v-on:click="item.hasWindow ? toggleWindow(item.key) : {}"
									:class="{ 'is-primary': activeWindows.includes(item.key) }"
								>
									<span style="margin-right: 7px" v-html="item.html"></span>
									<span
										v-html="typeof item.tooltip === 'function' ? item.tooltip() : item.tooltip"
									></span>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</nav>
		<div @click="toggleWindow('stats')" class="open-stats button is-large" :style="(side === 'right' ? 'right' : 'left') + ':-2px;'" v-if="!activeWindows.includes('stats') && !compactView"><span class='fas fa-chart-area'></span>&nbsp; Stats</div>
		<Window
			:ref="window"
			:key="window"
			:window-key="window"
			:window-data="windowDataObj[window]"
			v-on:toggleWindow="toggleWindow(window)"
			v-for="window in activeWindows"
		></Window>
		<div class="floating-menu canvas-overlay">
			<Following :followers-hashes="txFollowersHashes" ref="following"></Following>
		</div>
	</div>
</template>

<script>
/* eslint-disable vue/no-unused-components */
// @ts-nocheck
import Vue from "vue";
import { fds, default as i18n } from "../../i18n";
import Window from "./Window.vue";
import Search from "./Search.vue";
import Following from "./Following.vue";
import { resizeAll } from "../listeners.js";
import { config, userSettings, enabledConfig } from "../config.js";
import Notification from "./toasts/Notification";
import eventHub from "./eventHub";

export default Vue.extend({
	i18n,
	components: {
		Window,
		Search,
		Following,
	},
	props: ["coinConfig", "stats", "side", "txFollowersHashes"],
	data() {
		return {
			sortedCount: 0,
			sizeTitle: false,
			sizeAltTitle: false,
			showDropdown: false,
			settingsTab: false,
			isConnected: true,
			searchActive: false,
			dropdownActive: false,
			missingRecentErrors: {},
			navigation: [
				{
					key: "stats",
					html: "<span class='fas fa-chart-area'></span>",
					title: () => {
						return this.$tc("general.stat", 2);
					},
					tooltip: this.$tc("general.stat", 2),
					hasWindow: true,
				},
				{
					key: "txs",
					html: "<span class='fas fa-receipt'></span>",
					tooltip: this.$tc("general.transaction", 2),
					title: () => {
						return this.$tc("general.transaction", 2);
					},
					hasWindow: true,
				},
				{
					key: "blocks",
					html: "<span class='fas fa-cube'></span>",
					title: () => {
						return this.$tc("general.block", 2);
					},
					tooltip: this.$tc("general.block", 2),
					hasWindow: true,
				},
			],
			activeWindows: this.defaultWindows(),
			// activeWindows: [],
			windowData: [
				{
					key: "txs",
					title: () => {
						return this.$t("general.recent") + " " + this.$tc("general.transaction", 2);
					},
					components: [
						{
							name: "Transactions",
							props: {
								thead: false,
								ticker: this.coinConfig.ticker,
							},
						},
					],
					styles: {
						width: "22rem",
					},
				},
				{
					key: "editSign",
					title: "Edit Sign",
					components: [
						{
							name: "EditSign",
							props: {
								coin: this.coinConfig.ticker,
							},
						},
					],
					styles: {
						width: "25rem",
						height: "45rem",
					},
				},
				{
					key: "blocks",
					title: () => {
						return this.$tc("general.block", 2);
					},
					components: [
						{
							name: "Blocks",
							props: {
								ticker: this.coinConfig.ticker,
							},
						},
					],
					styles: {
						width: "32rem",
						height: "55rem",
					},
				},
				{
					key: "stats",
					title: () => {
						return this.$tc("general.stat", 2);
					},
					components: [
						{
							name: "Statistics",
							props: {},
						},
					],
					styles: {
						width: "25rem",
						height: "23rem",
					},
					position: "bottom-corner",
				},
				{
					key: "settings",
					title: () => {
						return this.$tc("general.setting", 2);
					},
					components: [
						{
							name: "Settings",
							props: {},
						},
					],
					styles: {
						width: "30rem",
						height: "40rem",
					},
				},
			],
			hidden: false,
		};
	},
	watch: {
		now: function () {
			//now will change every second
			//set recent block timeago
			if (this.blockchainLength > 0) {
				let recentBlock = this.coinConfig.liveBlocks[this.coinConfig.liveBlocks.length - 1];
				let recentBlockTime = recentBlock.time;
				let recent = fds(recentBlockTime * 1000, new Date(), {
					roundingMethod: "floor",
					addSuffix: true,
				});
				if (!recent) return;
				this.stats["lastBlock"].value = recent;

				let timeSinceLastBlock = Date.now() / 1000 - recentBlockTime;
				if(this.coinConfig?.ignoreMissingRecent) return;
				if (this.stats["medianBlockTime"] && timeSinceLastBlock > this.stats["medianBlockTime"].value * (15 * (this.coinConfig?.missingRecentMultiplier || 1))) {
					if (
						this.missingRecentErrors[this.coinConfig.ticker] &&
						Date.now() - this.missingRecentErrors[this.coinConfig.ticker] < 120000
					)
						return;
					this.missingRecentErrors[this.coinConfig.ticker] = Date.now();
					window.mainVue.$toast.error(
						{
							component: Notification,
							props: {
								title: this.$t("messages.missing-recent"),
								html:
									"<button onclick='window.location.reload(true)' class='button is-small is-danger'>" +
									this.$t("general.click-here") +
									"</button> " +
									this.$t("messages.to-refresh-page"),
							},
						},
						{
							// position: "bottom-center",
							position: "bottom-" + this.side,
							timeout: 10000,
							id: this.coinConfig.ticker + "-refresh",
						}
					);
				}
			}
		},
		isConnected: function (val) {
			let street = this.getStreet();
			street.setConnected(val);
		},
	},
	computed: {
		appVersion: function () {
			return process.env.VUE_APP_VERSION;
		},
		compactView: function () {
			return window.innerWidth < 601;
		},
		now: function () {
			return window.mainVue.now;
		},
		config: function () {
			return config;
		},
		game: function () {
			return window.txStreetPhaser;
		},
		blockchainLength: function () {
			return this.coinConfig.liveBlocks.length;
		},
		windowDataObj: function () {
			let obj = {};
			for (let i = 0; i < this.windowData.length; i++) {
				let data = this.windowData[i];
				obj[data.key] = data;
			}
			return obj;
		},
		darkMode: function () {
			return window.mainVue.darkMode;
		},
		sideWidth: function () {
			return this.$el.clientWidth;
		},
	},
	methods: {
		editSign: function () {
			this.toggleWindow("editSign");
		},
		i18n: function (val) {
			return typeof val === "function" ? val() : val;
		},
		addTx: function (tx, keep = false, unshift = false) {
			if (typeof tx.block === "undefined") tx.block = 0;
			if (typeof tx.bh === "undefined") tx.bh = false;
			tx.keep = keep;
			if (unshift) {
				enabledConfig[this.coinConfig.ticker].liveTxs.unshift(tx);
			} else {
				enabledConfig[this.coinConfig.ticker].liveTxs.push(tx);
			}
			this.emitTx(tx);
		},
		emitTx: function (tx) {
			eventHub.$emit("addTx-" + this.coinConfig.ticker, tx);
		},
		emitBlock: function (block) {
			eventHub.$emit("addBlock-" + this.coinConfig.ticker, block);
		},
		defaultWindows() {
			return [];
		},
		resetWindows: function () {
			this.activeWindows = this.defaultWindows();
		},
		switchStreet: function (side, street = false) {
			if (!street) street = this.game.streetController.enabledStreets[this.coinConfig.ticker];
			if (config.disabledStreets.includes(street.config.ticker)) {
				alert("Street disabled");
				return false;
			}
			this.game.streetController.switchStreet(side, street);
			this.dropdownActive = false;
		},
		getStreet: function () {
			return this.game.streetController.getCoinStreet(
				this.game.streetController.enabledStreets[this.coinConfig.ticker]
			);
		},
		txWindow: function (txData, dontClose = false) {
			let key = "tx-" + txData.tx;
			let data = {
				key: key,
				title: this.$tc("general.transaction", 1) + " ..." + txData.tx.substring(txData.tx.length - 5),
				components: [
					{
						name: "Transaction",
						key: key,
						props: {
							loadedTxData: txData,
							windowKey: key,
						},
					},
				],
				styles: {
					width: "35rem",
				},
			};
			this.createWindowData(data, dontClose);
		},
		addressWindow: function (address, dontClose = false) {
			let key = "addr-" + address.replace(":", "");
			let data = {
				key: key,
				title: this.$tc("general.address", 1) + " ..." + address.substring(address.length - 5),
				components: [
					{
						name: "Address",
						key: key,
						props: {
							userInput: address,
						},
					},
				],
				styles: {
					width: "35rem",
				},
			};
			this.createWindowData(data, dontClose);
		},
		htmlWindow: function (key, title, html) {
			let components = [];
			components.push({
				name: "HtmlBlock",
				key: key,
				props: {
					html: html,
				},
			});
			let data = {
				key: key,
				title: title,
				components: components,
				styles: {
					width: "35rem",
					"text-align": "center",
				},
			};
			this.createWindowData(data);
		},
		wikiWindow: function (title, paths) {
			let key = paths.join("-").hashCode();
			let components = [];
			for (let i = 0; i < paths.length; i++) {
				const path = paths[i];
				components.push({
					name: "LoadWiki",
					key: path,
					props: {
						path,
					},
				});
			}

			let data = {
				key: key,
				title: title,
				components: components,
				// classes: "transparent",
				styles: {
					width: "35rem",
				},
			};
			this.createWindowData(data);
		},
		blockWindow: function (blockData) {
			let height = blockData;
			if (typeof blockData === "object") height = blockData.height;
			let key = "block-" + height;
			let data = {
				key: key,
				title: () => {
					return this.$tc("general.block", 1) + " #" + height;
				},
				components: [
					{
						name: "Block",
						key: key,
						props: {
							data: blockData,
							windowKey: key,
						},
					},
				],
				styles: {
					width: "35rem",
					height: "25rem",
				},
			};
			this.createWindowData(data);
		},
		createWindowData(data, dontClose = false) {
			let exists = this.getWindow(data.key);
			if (!exists) {
				this.windowData.push(data);
			} else if (dontClose) {
				exists.moveToFront();
				return false;
			}
			this.toggleWindow(data.key);
		},
		removeWindowData(key) {
			for (let i = 0; i < this.windowData.length; i++) {
				let data = this.windowData[i];
				if (data.key == key) this.windowData.splice(i, 1);
			}
		},
		toggleWindow: function (key) {
			let i = this.activeWindows.indexOf(key);
			if (i === -1) this.activeWindows.push(key);
			else this.activeWindows.splice(i, 1);
			this.dropdownActive = false;
		},
		getWindow: function (key) {
			for (let i = 0; i < this.$children.length; i++) {
				const child = this.$children[i];
				if (!child.windowKey) continue;
				if (child.windowKey === key) {
					return child;
				}
			}
			return false;
		},
		setSetting(settingsKey, key, value) {
			userSettings[settingsKey][key].newValue = value;
			this.saveSetting(userSettings[settingsKey], settingsKey);
		},
		saveSetting(settings, settingsKey) {
			let saveJson = {};
			for (const settingKey in settings) {
				let setting = settings[settingKey];
				if (!setting.writable) continue;
				if (typeof setting.restart === "undefined" || !setting.restart) {
					if (userSettings[settingsKey][settingKey].value !== setting.newValue) {
						userSettings[settingsKey][settingKey].value = setting.newValue;
						this.$emit("changedSetting", settingKey, setting);
					}
					if (settingKey.length > 13 && settingKey.slice(-13) === "Notifications" && setting.newValue) {
						//request permission for notifications
						if ("Notification" in window) window.Notification.requestPermission();
					}
				}
				saveJson[settingKey] = setting.newValue;
			}
			localStorage.setItem(settingsKey, JSON.stringify(saveJson));
		},
	},
	mounted() {
		var dropdowns = this.$el.querySelectorAll(".has-dropdown .navbar-link");
		dropdowns.forEach((dropdown) => {
			dropdown.addEventListener("touchend", function (event) {
				event.stopPropagation();
				dropdown.parentNode.classList.toggle("is-active");
				dropdown.parentNode.classList.remove("is-hoverable");
			});
		});
		resizeAll(this.game);
		this.settingsTab = this.coinConfig.ticker + "Settings";
	},
});
</script>
<style lang="scss" scoped>
.navbar {
	padding: 0rem;
	height: auto;
	min-height: auto !important;
}

.coin-dropdown-button {
	line-height: 1.3rem;
	font-size: min(3.5vw, 1.3rem);
	margin: 0.35rem;
}

.coin-dropdown-container {
	position: absolute;
	left: 0;
	right: 0;
	top: 100%;
	max-width: 100%;
	z-index: 2;
	text-align: center;

	.coin-dropdown {
		display: inline-block;
		width: 100%;
		max-width: 1100px;
		padding: 1rem;
		background: white;
		border-radius: 6px;
		border-top-right-radius: 0px;
		border-top-left-radius: 0px;
		box-shadow: inset 0 0.5em 1em -0.125em rgb(10 10 10 / 10%), 0 0px 0 1px rgb(10 10 10 / 2%);
		max-height: calc(100vh - 40px);
		overflow: auto;
	}

}
.open-stats{
		position: fixed;
		bottom:-2px;
		z-index: 3;
	}
</style>