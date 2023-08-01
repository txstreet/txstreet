<template>
	<div class="html-container">
		<div
			v-if="!$root.loadError"
			:class="{ 'grow-trans': $root.loading, splash: splash }"
			class="box launch-visualizer"
		>
			<div class="launch-bg-overlay"></div>
			<div class="launch-bg-container">
				<div class="launch-bg launch-bg-left">
					<div class="launch-bg-inner" :style="bgInnerStyle(0)"></div>
				</div>
				<div class="launch-bg launch-bg-right">
					<div class="launch-bg-inner" :style="bgInnerStyle(1)"></div>
				</div>
			</div>
			<div class="launch-container">
				<div class="launcher-logo-container">
					<img
						v-if="splash"
						class="launcher-logo tag"
						:src="
							'/static/img/icons/logo' +
							($root.darkMode ? '_darkmode' : '') +
							'.svg?v=' +
							$root.appVersion
						"
					/>
				</div>
				<div v-if="!$root.loading">
					<div class="launcher-box">
						<button @click="launch()" class="button is-large is-primary is-rounded">Launch</button>
						<div class="field dual-view unselectable">
							<div>
								<input
									v-model="autoLoad"
									class="switch"
									id="auto-load"
									type="checkbox"
									name="auto-load"
								/>
								<label for="auto-load">Auto Launch</label>
							</div>
							<div
								v-if="
									$root.$refs.landing &&
									$root.$refs.landing.isMobile &&
									$root.selectedCoins[1] !== null
								"
							>
								<input
									v-model="dualView"
									class="switch"
									id="dual-view"
									type="checkbox"
									name="dual-view"
								/>
								<label for="dual-view">Load Two (Desktop)</label>
							</div>
						</div>
						<div v-if="!$root.loading" id="zoomer_video" class="columns is-centered box no-box">
							<video
								class="column is-half"
								ref="header_video"
								muted="muted"
								loop="loop"
								playsinline=""
								autoplay="autoplay"
							>
								<source
									src="https://player.vimeo.com/progressive_redirect/playback/710188193/rendition/360p/file.mp4?loc=external&signature=118de6a983ba09acdbe6d6198ce28b2aaa31ff662302c3ac2082c1575a0bc7c6"
								/>
							</video>
							<div class="column zoomer-info">
								<div class="title is-3"><a href="https://moonheads.io" target="_blank">TxStreet NFTs</a></div>
								<div class="subtitle is-6">🚀 Backed by rETH 🚀</div>
								<a
									href="https://pro.opensea.io/collection/moonheads-zoomers"
									target="_blank"
									class="button is-success"
									>Buy</a
								>
							</div>
						</div>
					</div>
				</div>
				<div v-else class="lds-ellipsis">
					<div></div>
					<div></div>
					<div></div>
					<div></div>
				</div>
			</div>
			<div class="buttons">
				<div
					v-for="(coin, i) in selectedCoins"
					:key="'dropdown-' + coin"
					class="dropdown is-hoverable is-up"
					:class="{
						'is-right': i === 1,
					}"
				>
					<div class="dropdown-trigger">
						<button
							:class="{ 'half-opacity': !coin }"
							class="button theme-button is-large"
							style="line-height: 28px"
						>
							<span
								v-if="coin"
								class="coin-logo"
								:style="'background-color: #' + $root.bgColor(coin) + ';'"
							>
								<img
									:src="
										config.baseUrl +
										'static/img/singles/coin_logos/' +
										coin.toLowerCase() +
										'.png?v=' +
										$root.appVersion
									"
									width="28"
									height="28"
								/>
							</span>
							<span v-if="$root.$refs.landing && $root.$refs.landing.enabledConfig[coin] && $root.$refs.landing.enabledConfig[coin].coinName">{{$root.$refs.landing.enabledConfig[coin].coinName}}</span
							>
							<span v-else>?</span>
							<span class="icon is-normal"><span class="fas fa-chevron-up"></span></span>
						</button>
					</div>
					<div v-if="$root.$refs.landing" class="dropdown-menu">
						<div class="dropdown-content">
							<template v-for="dropCoin in $root.$refs.landing.enabledConfig">
								<a
									:key="'dropdownopt-' + dropCoin.ticker"
									@click="changeVisDropdown(i, dropCoin.ticker)"
									class="dropdown-item navbar-item"
									><span
										class="coin-logo"
										:style="'background-color: #' + $root.bgColor(dropCoin.ticker) + ';'"
									>
										<img
											:src="
												config.baseUrl +
												'static/img/singles/coin_logos/' +
												dropCoin.ticker.toLowerCase() +
												'.png?v=' +
												$root.appVersion
											"
											width="28"
											height="28"
										/> </span
									><span>{{ $root.$refs.landing.enabledConfig[dropCoin.ticker].coinName }}</span></a
								>
							</template>
							<hr class="dropdown-divider" />
							<a @click="changeVisDropdown(i, null)" class="dropdown-item navbar-item"
								><span class="fas fa-times-circle"></span>&nbsp;NONE</a
							>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="box has-text-centered has-text-danger" v-else>
			<span class="fas fa-exclamation-circle"></span> Error loading. Please refresh the page.
		</div>
	</div>
</template>
<script>
import { config, enabledConfig } from "../../../config";
import { newStat } from "../controllers/statistic";
export default {
	data: function () {
		return {
			dualView: false,
			autoLoad: this.$root.autoLoad,
			statistics: {},
			// neededRooms: [],
		};
	},
	methods: {
		launch() {
			this.$root.selectedCoins = this.selectedCoins;
			this.$root.openVisualizer();
		},
		changeVisDropdown(i, ticker) {
			this.$root.changeVisDropdown(i, ticker, this.$root.$refs.landing.activeKey === "home");
			if (i === 1) this.dualView = true;
			this.$root.$refs.landing.refresh();
			this.$forceUpdate();
		},
		bgInnerStyle(i) {
			let otherIndex = !i ? 1 : 0;
			let ticker = null;
			if (this.selectedCoins[i]) {
				ticker = this.selectedCoins[i];
			} else if (this.selectedCoins[otherIndex]) {
				ticker = this.selectedCoins[otherIndex];
			}

			let bannerTicker = ticker;
			if (bannerTicker === "ARBI") bannerTicker = "ETH";
			let style = bannerTicker
				? "background-image: url(/static/img/banners/" +
				bannerTicker.toLowerCase() +
				".jpg?v=" +
				process.env.VUE_APP_VERSION +
				");"
				: "";
			return style;
		},
		getNeededStats(tickers) {
			for (let i = 0; i < tickers.length; i++) {
				const ticker = tickers[i];
				if (!ticker) continue;
				if (!this.statistics[ticker]) this.statistics[ticker] = [];
				const coinConfig = enabledConfig[ticker];
				for (const key in coinConfig.stats) {
					const stat = coinConfig.stats[key];
					if (!stat.socket) continue;
					const statInstance = newStat(ticker, key);
					this.statistics[ticker].push(statInstance);
				}
			}
			for (const ticker in this.statistics) {
				if (tickers.includes(ticker)) continue;
				const existingStatTicker = this.statistics[ticker];
				for (let i = existingStatTicker.length - 1; i >= 0; i--) {
					const stat = existingStatTicker[i];
					stat.stop();
					existingStatTicker.splice(i, 1);
				}
				delete this.statistics[ticker];
			}
		},
	},
	beforeDestroy() {
		this.getNeededStats([]);
	},
	mounted() {
		const tickers = this.selectedCoins;
		this.getNeededStats(tickers);
	},
	computed: {
		selectedCoins: {
			get() {
				if (this.$root.$refs.landing && this.$root.$refs.landing.isMobile && !this.dualView) {
					return [this.$root.selectedCoins[0], null];
				}
				return this.$root.selectedCoins;
			},
			set(val) {
				this.$root.selectedCoins = val.toUpperCase();
				return val;
			},
		},
		config() {
			return config;
		},
		splash() {
			return (this.$root.loading && this.$root.loaded) || (this.$root.autoLoading && this.$root.loading);
		},
	},
	watch: {
		autoLoad(val) {
			this.$root.autoLoad = val;
		},
		selectedCoins(newVal) {
			this.getNeededStats(newVal);
		},
	},
};
</script>
<style lang="scss" scoped>
#zoomer_video {
	.title,
	.subtitle {
		color: black !important;
	}
	.zoomer-info {
		padding-left: 2rem;
		padding-right: 2rem;
	}
	margin-top: 2rem;
	padding: 0.5rem !important;
	video {
		height: 180px;
		width: 180px;
		border-radius: 10px;
		display: inline-block;
	}
	.button {
		font-size: 1.4rem !important;
	}
}
.launch-visualizer {
	border-radius: 0 !important;
	.launch-bg-overlay {
		position: absolute;
		height: 100%;
		width: 100%;
		top: 0;
		left: 0;
		background: rgba($color: #1f1f1f, $alpha: 0.8);
		z-index: 0;
		backdrop-filter: blur(5px);
	}
	.launch-bg {
		border-radius: 0 !important;
	}
	.launcher-box {
		display: inline-block;
		background: rgba(0, 0, 0, 0.3);
		padding: 20px;
		border-radius: 20px;
		box-shadow: 0px 0px 100px 100px rgba(0, 0, 0, 0.3);
	}
}
.launch-visualizer.splash {
	position: fixed;
	width: 100%;
	height: 100%;
	top: 0;
	left: 0;
	pointer-events: initial !important;
	z-index: 501 !important;
	.launch-bg-overlay {
		display: none;
	}
	.launch-bg {
		filter: brightness(1) !important;
	}
	.launch-container {
		bottom: 60%;
	}
	.launcher-logo-container {
		display: block;
		width: 100%;
		text-align: center;
		img {
			width: 500px;
			max-width: 60%;
			min-height: 100px;
			padding: 20px;
			display: inline-block;
		}
	}
}
.dual-view {
	white-space: nowrap;
}
label {
	color: white;
}

.lds-ellipsis {
	display: inline-block;
	position: relative;
	width: 80px;
	height: 80px;
}
.lds-ellipsis div {
	position: absolute;
	top: 33px;
	width: 13px;
	height: 13px;
	border-radius: 50%;
	background: #fff;
	animation-timing-function: cubic-bezier(0, 1, 1, 0);
}
.lds-ellipsis div:nth-child(1) {
	left: 8px;
	animation: lds-ellipsis1 0.6s infinite;
}
.lds-ellipsis div:nth-child(2) {
	left: 8px;
	animation: lds-ellipsis2 0.6s infinite;
}
.lds-ellipsis div:nth-child(3) {
	left: 32px;
	animation: lds-ellipsis2 0.6s infinite;
}
.lds-ellipsis div:nth-child(4) {
	left: 56px;
	animation: lds-ellipsis3 0.6s infinite;
}
@keyframes lds-ellipsis1 {
	0% {
		transform: scale(0);
	}
	100% {
		transform: scale(1);
	}
}
@keyframes lds-ellipsis3 {
	0% {
		transform: scale(1);
	}
	100% {
		transform: scale(0);
	}
}
@keyframes lds-ellipsis2 {
	0% {
		transform: translate(0, 0);
	}
	100% {
		transform: translate(24px, 0);
	}
}
</style>