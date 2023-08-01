<template>
	<div ref="landing" id="landing">
		<div v-if="sidebarActive" id="landing-sidebar">
			<img
				class="dash-logo"
				:src="'/static/img/icons/logo' + (darkMode ? '_darkmode' : '') + '.svg?v=' + $root.appVersion"
			/>
			<div class="buttons dash-buttons">
				<div class="button-container" v-for="(dashConfig, dashKey) in cPages" :key="dashKey">
					<a
						:href="'/d/' + dashKey"
						class="button theme-button dash-button"
						:class="{ 'is-active': dashKey === activeKey }"
						@click.prevent="changeDashboard(dashKey)"
						v-text="dashConfig.title"
						:style="dashConfig.depreciated ? 'opacity:0.3' : ''"
					></a>
				</div>
			</div>
			<div>
				<h2>Socials</h2>
				<div class="buttons social-buttons">
					<a href="https://twitter.com/txstreetCom" target="_blank" class="button is-twitter"
						><span class="fab fa-twitter"></span
					></a>
					<a href="https://bit.ly/3rWCRm6" target="_blank" class="button is-discord"
						><span class="fab fa-discord"></span
					></a>
				</div>
				<h2>Links</h2>
				<div class="buttons social-buttons">
					<a href="https://txstreet.com" target="_blank" class="button is-primary">TxStreet</a>
					<a href="https://github.com/txstreet/txstreet" target="_blank" class="button is-link"><span class="fab fa-github"></span
					></a>
				</div>
			</div>
		</div>
		<section id="landing-grid" class="section grid-section">
			<div class="landing-top">
				<div class="buttons top-left-buttons">
					<button @click="sidebarActive = !sidebarActive" class="button theme-button">
						<span class="fas fa-bars"></span>
					</button>
				</div>
				<div class="buttons top-right-buttons">
					<connect />
					<button v-if="!darkMode" @click="darkMode = !darkMode" class="button is-dark">
						<span class="fas fa-moon"></span>
					</button>
					<button v-else @click="darkMode = !darkMode" class="button is-white">
						<span class="fas fa-sun"></span>
					</button>
				</div>
				<div v-if="!activeConfig.hideTitle" class="landing-title">
					{{ activeConfig.pageTitle || activeConfig.title }}
				</div>
			</div>
			<MoonHeadAd v-if="activeConfig.hasAd" />
			<component :is="activeConfig.page" v-if="activeConfig.page"></component>
		</section>
	</div>
</template>
<script>
// @ts-nocheck
import { enabledConfig } from "../../config";
import { resetNeededRooms } from "../../utils";
import Home from "./pages/Home.vue";
import GasPrices from "./pages/GasPrices.vue";
import Happening from "./pages/Happening.vue";
import MoonHeadAd from "./templates/MoonHeadAd.vue";
import { getNeededRooms } from "./controllers";

export default {
	components: {
		Home,
		GasPrices,
		Happening,
		Transactions: () => import("./pages/Transactions.vue"),
		MoonHeadAd,
		Connect: () => import("../Connect.vue"),
	},
	data: function () {
		return {
			activeConfig: { title: "" },
			activeKey: "home",
			darkMode: true,
			sidebarActive: true,
			lastForceReload: Date.now(),
			pages: {
				home: {
					title: "🚌 Visualizer",
					page: "Home",
					hideTitle: true,
				},
				gas: {
					title: "⛽ ETH Gas Prices",
					pageTitle: "⛽ ETH Gas Prices (Gwei)",
					page: "GasPrices",
					description: "Ethereum gas prices in real time based on pending transactions in the mempool.",
					hasAd: true,
				},
				happening: {
					title: "👀 Happening",
					page: "Happening",
					description: "Free Alpha. See what's happening on Ethereum in real time.",
					hasAd: true,
				},
				txs: {
					title: "Transactions",
					page: "Transactions",
					lazyLoaded: true,
					hidden: true,
				},
			},
			defaultMeta: {
				description: "",
				img: "",
			},
		};
	},
	beforeMount() {
		this.defaultMeta.description = document.querySelector('meta[name="description"]').content;
		this.defaultMeta.img = document.querySelector('meta[name="og:image"]').content;

		let boolSettings = ["darkMode", "sidebarActive"];
		for (let i = 0; i < boolSettings.length; i++) {
			const settingName = boolSettings[i];
			let browserVal = localStorage.getItem(settingName);
			let val = browserVal;
			if (settingName === "sidebarActive" && window.innerHeight > window.innerWidth) val = false;
			if (browserVal) val = Boolean(JSON.parse(browserVal));
			if (typeof val === "boolean") {
				this[settingName] = val;
			}
		}
	},
	async mounted() {
		this.changeDashFromUrl();
		this.changeUrlDash(false, true);
		this.setVizMetadata();

		window.addEventListener("popstate", this.changeDashFromUrl);
	},
	beforeDestroy() {
		window.removeEventListener("popstate", this.changeDashFromUrl);
	},
	methods: {
		setVizMetadata() {
			if (this.activeKey === "home" && window.location.pathname.split("/").includes("v")) {
				if (this.$root.selectedCoins[0])
					this.$root.changeImg(
						"/static/img/banners/" +
							this.$root.selectedCoins[0].toLowerCase() +
							".jpg?v=" +
							process.env.VUE_APP_VERSION
					);
				let text = this.$root.getVizTitleFromURL(false, false, true);
				if (!text) return;
				text =
					text +
					" live transaction visualizer. Every tx is a person, and they fill up buses which represent blocks.";
				this.$root.changeDesc(text);
			}
		},
		changeDashFromUrl() {
			let urlPath = window.location.pathname.split("/");
			if (urlPath.includes("d")) {
				const pathDashKey = urlPath[urlPath.indexOf("d") + 1];
				const dashConfig = this.pages[pathDashKey];
				if (!pathDashKey || !dashConfig) {
					this.changeDashboard("home", false);
				} else {
					this.changeDashboard(pathDashKey, false);
				}
			} else {
				this.changeDashboard("home", false);
			}
		},
		changeUrlDash(pushState = true, notHome = false) {
			if (this.activeKey === "home") {
				if (!notHome) {
					this.$root.changeUrl("", "Blockchain Transaction Visualizer - TxStreet.com", true, pushState);
					this.$root.replaceVizPage();
				}
			} else {
				this.$root.changeUrl(
					"d/" + this.activeKey,
					this.activeConfig.title + " - TxStreet.com",
					true,
					pushState
				);
			}
			this.$root.changeDesc(this.activeConfig.description || this.defaultMeta.description);
			this.$root.changeImg(this.activeConfig.img || this.defaultMeta.img);
		},
		refresh(once = false) {
			if (once && Date.now() - this.lastForceReload < 1000) return;
			this.lastForceReload = Date.now();
			this.$forceUpdate();
		},
		async changeDashboard(key, changeUrl = true) {
			let dashConfig = this.pages[key];
			if (!dashConfig) {
				this.changeDashboard("home");
				return false;
			}
			this.activeConfig = dashConfig;
			this.activeKey = key;

			if (changeUrl) this.changeUrlDash();
			if (!dashConfig.lazyLoaded) this.checkSockets();
			return true;
		},
		checkSockets() {
			this.$nextTick(() => {
				let allNeeded = getNeededRooms();
				resetNeededRooms("dash", allNeeded);
			});
		},
	},
	watch: {
		"$root.selectedCoins"() {
			this.checkSockets();
		},
		darkMode(val) {
			this.$root.darkMode = val;
			localStorage.setItem("darkMode", Boolean(val));
		},
		sidebarActive(val) {
			localStorage.setItem("sidebarActive", Boolean(val));
		},
	},
	computed: {
		cPages() {
			const pages = {};
			for (const pageKey in this.pages) {
				const page = this.pages[pageKey];
				if (!page.hidden || this.activeKey === pageKey) pages[pageKey] = page;
			}
			return pages;
		},
		isMobile() {
			return this.isMobileScreen;
		},
		isMobileScreen() {
			return this.$root.windowWidth < 860;
		},
		coinsFromSelected() {
			let coins = [];
			for (let i = 0; i < this.$root.selectedCoins.length; i++) {
				const ticker = this.$root.selectedCoins[i];
				if (!ticker) continue;
				coins.push(enabledConfig[ticker.toUpperCase()]);
			}
			//if only one coin, add another
			if (coins.length < 2) {
				for (const ticker in enabledConfig) {
					if (coins[0].ticker === ticker) continue;
					coins.push(enabledConfig[ticker.toUpperCase()]);
					if (coins.length > 1) break;
				}
			}
			return coins;
		},
		enabledConfig() {
			return enabledConfig;
		},
		loadVisualizer() {
			return this.$root.loadVisualizer;
		},
	},
};
</script>
<style lang="scss">
#landing {
	position: fixed;
	z-index: 500;
	.landing-title {
		> span {
			margin-left: 10px;
		}
	}
	.social-buttons {
		justify-content: center;
		padding: 5%;
	}
	.vue-grid-layout {
		width: 100%;
		margin-bottom: 50px;
	}
	.mobile-grid {
		.vue-grid-item {
			position: relative !important;
			width: 100% !important;
			transform: none !important;
			margin-bottom: 1.5rem !important;
			left: initial !important;
			top: initial !important;
			&:not(.no-stretch-height) {
				height: auto !important;
			}
		}
		height: auto !important;
	}
	.image-box {
		img {
			position: absolute;
			max-width: 80%;
			max-height: 80%;
			width: auto;
			height: auto;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
		}
	}

	.landing-editing {
		box-shadow: inset 0 0 0px 10px #ffdd57;
		border-radius: 6px;
	}
	display: flex;
	background-color: rgb(245, 245, 245);
	width: 100%;
	height: 100vh;
	overflow: visible;
	.modal-content {
		overflow: auto;
		max-height: 100%;
		height: 100%;
		display: flex;
		align-items: flex-start;
		justify-content: flex-start;
		.box {
			width: 100%;
		}
	}
	.dash-logo {
		padding: 10px 35px;
		border-bottom: 1px solid rgba(0, 0, 0, 0.06);
	}
	#partners {
		padding: 5%;
		max-width: 250px;
		overflow: visible;
		.column {
			padding: 2% !important;
		}
	}
	.tx-list-container {
		margin-top: 1rem;
		height: calc(100% - 1rem) !important;
		.tx-list {
			height: 100% !important;
		}
	}
	#landing-grid {
		.landing-top {
			width: 100%;
			display: flex;
			flex-flow: row wrap;
			margin-bottom: 1rem;
			position: relative;
			z-index: 2;
			.buttons,
			.button {
				margin-bottom: 0;
			}
			> div {
				display: flex;
				align-items: center;
			}
			.landing-title {
				order: 2;
				margin-left: 1.5rem;
			}
			.top-right-buttons {
				order: 3;
				margin-left: auto;
			}
			.top-left-buttons {
				order: 1;
			}
		}
		float: left;
		flex-grow: 1;
		position: relative;
		overflow: auto;
		overflow-x: hidden;
		min-width: 320px !important;
		padding-bottom: 100px;
	}
	#landing-sidebar {
		box-shadow: 0 0.5em 1em -0.125em rgb(10 10 10 / 10%), 0 0px 0 1px rgb(10 10 10 / 2%);
		background: white;
		height: 100%;
		max-height: 100%;
		width: 250px;
		min-width: 250px !important;
		max-width: 250px !important;
		float: left;
		text-align: center;
		overflow: auto;
		overflow-x: hidden;
		display: flex;
		flex-direction: column;

		> div:last-of-type {
			margin-top: auto;
		}

		&::-webkit-scrollbar {
			display: none;
		}
		-ms-overflow-style: none;
		scrollbar-width: none;

		h2 {
			font-size: 1rem;
			opacity: 0.3;
		}
		.dash-button {
			font-size: 1.2rem;
		}
		.dash-buttons {
			padding: 0.5rem;
			.button-container:hover {
				.dash-actions {
					display: block;
				}
			}
			> .button-container {
				position: relative;
				width: 100%;
				> .button {
					margin-right: 0;
					width: 100%;
					justify-content: left;
				}
				> .button.is-active {
					color: #0bc2a6 !important;
				}
				.dash-actions {
					position: absolute;
					display: none;
					left: 0;
					top: calc(100% - 0.5rem);
					z-index: 4;
					.button {
						margin: 0;
					}
				}
			}
		}
	}
	font-size: 1.5rem;
	.grid-section {
		padding: 0.75rem;
	}
	.columns {
		overflow: auto;
	}
}
.loading-vis {
	opacity: 0.4;
	z-index: 0;
}
.grid-item:not(.loading-vis) {
	z-index: 1;
}
.moonhead-ad {
	margin-bottom: 20px;
}
</style>