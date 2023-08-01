<template>
	<div class="stat-item-chart" ref="container">
		<div v-show="loaded" class="chart" ref="chart"></div>
		<div class="load-container" v-if="!loaded">
			<span style="display: inline-block" class="loader is-loading"></span>
		</div>
		<div class="chart-buttons buttons">
			<button
				v-if="offTime"
				@click="goToRealTime"
				:class="{ 'is-dark': $root.$refs.landing.darkMode }"
				class="button"
			>
				<span class="fa fa-arrow-right"></span>
			</button>
			<div v-if="!customDuration" class="dropdown is-up is-hoverable">
				<div class="dropdown-trigger">
					<button :class="{ 'is-dark': $root.$refs.landing.darkMode }" class="button">
						<span>{{ durationOptions[currentDuration].title }}</span>
						<span class="icon is-small">
							<i class="fas fa-angle-up" aria-hidden="true"></i>
						</span>
					</button>
				</div>
				<div class="dropdown-menu is-dark" role="menu">
					<div class="dropdown-content">
						<a
							@click="changeDuration(duration)"
							:class="{ 'is-selected': duration === currentDuration }"
							class="dropdown-item"
							v-for="(option, duration) in durationOptions"
							:key="option.title"
						>
							{{ option.title }}
						</a>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>
<script>
import eventHub from "../../eventHub";
import Vue from "vue";
import { createChart } from "lightweight-charts";
import { enabledConfig } from "../../../config";
import { calcStatValue } from "../../../utils/";
import { newStat } from "../controllers/statistic";
export default {
	props: ["statConfig", "options"],
	data: function () {
		return {
			chart: undefined,
			chartInit: false,
			offTime: false,
			lineSeries: {},
			loaded: false,
			config: {},
			stats: {},
			title: "Title",
			durationOptions: {
				"52w": {
					title: "1 year",
					interval: "1d",
				},
				"4w": {
					title: "4 weeks",
					interval: "1h",
				},
				"1w": {
					title: "1 week",
					interval: "1h",
				},
				"1d": {
					title: "1 day",
					interval: "5m",
				},
				"1h": {
					title: "1 hour",
					interval: "5s",
				},
			},
			currentDuration: this.statConfig[0]?.duration || "1h",
			customDuration: Boolean(this.options?.customDuration || this.statConfig[0]?.interval),
		};
	},
	beforeMount() {
		for (let i = 0; i < this.statConfig.length; i++) {
			const ticker = this.statConfig[i].ticker;
			const key = this.statConfig[i].key;
			const statKey = ticker + "-stat-" + key;
			const stat = newStat(ticker, key);
			Vue.set(this.stats, statKey, stat);
			if (this.customDuration) {
				stat.getHistory(this.statConfig[i]?.duration || "1h", this.statConfig[i].interval || "5s");
			} else {
				stat.getHistory(this.currentDuration, this.durationOptions[this.currentDuration].interval);
			}
		}
	},
	mounted() {
		this.setConfig();
		this.startChart();
		eventHub.$on("windowWidth", this.autoResize);
	},
	beforeDestroy() {
		for (const statKey in this.stats) {
			this.stats[statKey].stop();
		}
		eventHub.$off("windowWidth", this.autoResize);
	},
	methods: {
		changeDuration(duration) {
			this.currentDuration = duration;
			for (const statKey in this.stats) {
				const stat = this.stats[statKey];
				stat.getHistory(this.currentDuration, this.durationOptions[this.currentDuration].interval);
                this.$forceUpdate();
			}
		},
		getValues() {
			for (let i = 0; i < this.config.values.length; i++) {
				const series = this.config.values[i];
				const history = this.stats[series.statKey].history;
				series.history = history;
				this.setHistory(series);
			}
		},
		setConfig() {
			this.title = this.options?.title || this.title;

			const firstCoinConfig = enabledConfig[this.statConfig[0].ticker];
			let config = {
				values: [],
				chartOptions: {
					localization: {
						priceFormatter: (price) => {
							return firstCoinConfig.stats?.[this.statConfig[0].key]
								? calcStatValue(firstCoinConfig.stats?.[this.statConfig[0].key], price)
								: parseFloat(price.toFixed(2));
						},
					},
				},
			};

			for (let i = 0; i < this.statConfig.length; i++) {
				const ticker = this.statConfig[i].ticker;
				const coinConfig = enabledConfig[ticker];
				const statKey = ticker + "-stat-" + this.statConfig[i].key;
				this.$watch(
					() => this.stats[statKey].history.length,
					() => {
						this.getValues();
					}
				);

				let toAdd = {
					color: coinConfig.color,
					key: ticker,
					statKey,
					title: this.statConfig[i]?.title || coinConfig.coinName,
					history: this.stats[statKey].history,
				};
				config.values.push(toAdd);
			}

			this.config = config;
		},
		autoResize(timeout = 10) {
			setTimeout(() => {
				this.resizeChart(this.$refs.container.clientWidth, this.$refs.container.clientHeight);
			}, timeout);
		},
		goToRealTime() {
			let timeScale = this.chart.timeScale();
			timeScale.scrollToRealTime();
		},
		setChartColorTheme(dark) {
			if (!this.chart) return;
			let colors = {};
			if (dark) {
				colors.background = "#1f1f1f";
				colors.text = "#E0E0E0";
				colors.lines = "#474747";
			} else {
				colors.background = "#ffffff";
				colors.text = "#1f1f1f";
				colors.lines = "#ebebeb";
			}
			let options = {
				layout: {
					backgroundColor: colors.background,
					textColor: colors.text,
				},
				watermark: {
					color: colors.text,
				},
				grid: {
					vertLines: {
						color: colors.lines,
					},
					horzLines: {
						color: colors.lines,
					},
				},
				leftPriceScale: {
					borderColor: colors.text,
				},
				timeScale: {
					borderColor: colors.text,
				},
			};
			this.chart.applyOptions(options);
		},
		startChart() {
			setTimeout(() => {
				if (this.chart) this.stopChart();
				this.chart = createChart(this.$refs.chart, {
					width: this.$refs.container.clientWidth - 20,
					height: this.$refs.container.clientHeight,
					layout: {
						fontSize: 12,
					},
					handleScroll: false,
					handleScale: false,
					timeScale: {
						timeVisible: true,
						secondsVisible: true,
					},
					watermark: {
						visible: true,
						fontSize: 20,
						fontFamily: "Arial, sans-serif",
						fontStyle: "bold",
						horzAlign: "center",
						vertAlign: "top",
						text: this.title,
					},
					rightPriceScale: {
						visible: false,
						// 			mode: 1,
						// 			scaleMargins: {
						// top: 0.1,
						// bottom: 0.1,
						// },
					},
					leftPriceScale: {
						visible: true,
						// mode: 1,
						// 			scaleMargins: {
						// top: 0.1,
						// bottom: 0.1,
						// },
					},
				});
				this.setChartColorTheme(this.$root.$refs.landing.darkMode);
				if (!this.chartInit) {
					let timeScale = this.chart.timeScale();
					timeScale.subscribeVisibleTimeRangeChange(() => {
						this.offTime = timeScale.scrollPosition() < 0;
					});
				}

				for (let i = 0; i < this.config.values.length; i++) {
					const value = this.config.values[i];
					let config = {};
					if (value.color) config.color = "#" + value.color;
					config.title = value.title;
					this.lineSeries[value.key] = this.chart.addLineSeries(config);
					this.setHistory(value);
				}
				this.chart.applyOptions(this.config.chartOptions);
				this.chartInit = true;
			}, 5);
		},
		resizeChart(width, height) {
			if (this.chart){
                this.chart.resize(width, height);
                this.chart.timeScale().fitContent();
            }
		},
		stopChart() {
			for (const coin in this.lineSeries) {
				const lineSeries = this.lineSeries[coin];
				if (this.chart) this.chart.removeSeries(lineSeries);
			}
			this.lineSeries = {};
			if (this.chart) this.chart.remove();
			this.chart = undefined;
		},
		setHistory(value) {
			if (!this.lineSeries[value.key]) return;
			let toSetData = value.history || [];
			this.lineSeries[value.key].setData(toSetData);
			this.chart.timeScale().fitContent();
			this.loaded = toSetData.length > 0;
		},
		setAllHistory() {
			for (let i = 0; i < this.config.values.length; i++) {
				const value = this.config.values[i];
				this.setHistory(value);
			}
		},
	},
	watch: {
        "$root.$refs.landing.sidebarActive"() {
            this.autoResize();
        },
		"$root.$refs.landing.darkMode"(newVal) {
			this.setChartColorTheme(newVal);
		},
	},
};
</script>
<style lang="scss" scoped>
.chart {
	width: 100%;
	height: 100%;
}
.tv-lightweight-charts {
	width: 100%;
}
.chart-buttons {
	position: absolute;
	bottom: 35px;
	right: 5px;
	z-index: 100;
}
</style>