<template>
	<div>
		<table class="table is-striped is-narrow is-fullwidth">
			<tbody v-if="blockInfo && type == 'bus'">
				<tr>
					<td>
						<strong>{{ $t("general.confirmation-in") }}</strong>
					</td>
					<td class="break">{{ confirmationTime }}</td>
				</tr>
				<tr v-if="!mwebOnly">
					<td>
						<strong>{{ $root.i18n($root.busFeeTitleLong) }}</strong>
					</td>
					<td
						v-if="blockInfo.feeArray && blockInfo.feeArray.length > 10 && feeGraphPoints.length > 1"
						class="break"
					>
						<vue-bar-graph
							class="bar-graph"
							:bar-color="'#' + $root.coinConfig.color"
							:points="feeGraphPoints"
							:height="100"
							:width="300"
							:show-x-axis="true"
							:key="lastUpdated"
						/>
					</td>
					<td v-else-if="blockInfo.lowFee" class="break">{{ rangeValue }}</td>
				</tr>
				<tr v-if="!mwebOnly">
					<td>
						<strong>{{ $t("general.loaded") }}</strong>
					</td>
					<td class="break">
						<div class="progress-wrapper">
							<progress
								class="progress is-primary is-medium"
								:value="blockInfo.loaded"
								:max="blockInfo.busCapacity"
							></progress>
							<p class="progress-value">
								{{ Math.floor((blockInfo.loaded / blockInfo.busCapacity) * 100) + "%" }}
							</p>
						</div>
					</td>
				</tr>
				<template v-for="formatEntry in format">
					<tr v-if="blockInfo[formatEntry.key] && !mwebOnly" :key="formatEntry.key">
						<td>
							<strong>{{ $root.i18n(formatEntry.title) }}</strong>
						</td>
						<td class="break">
							{{ blockInfo[formatEntry.key] }}
							<span v-if="formatEntry.after">{{ formatEntry.after }}</span>
						</td>
					</tr>
				</template>
				<tr v-if="blockInfo.loaded && !mwebOnly">
					<td>
						<strong>{{ $t("general.loaded") }} ({{ $root.i18n($root.sizeTitle) }})</strong>
					</td>
					<td class="break">
						<span v-if="$root.sizeTitle === 'Gas'">~</span>
						{{ blockInfo.loaded.toLocaleString($i18n.locale) }}
					</td>
				</tr>
				<tr v-if="blockInfo.loadedAlt && !mwebOnly">
					<td>
						<strong>Loaded ({{ $root.i18n($root.sizeAltTitle) }})</strong>
					</td>
					<td class="break">{{ blockInfo.loadedAlt.toLocaleString($i18n.locale) }}</td>
				</tr>
				<tr v-if="blockInfo.txs">
					<td>
						<strong><span v-if="mwebOnly">MWEB </span>{{ $tc("general.transaction", 2) }}</strong>
					</td>
					<td class="break">
						<span v-if="mwebOnly">{{ blockInfo.mwebTxs }}</span>
						<span v-else>
							{{ blockInfo.txs.toLocaleString($i18n.locale) }}
							<span v-if="blockInfo.mwebTxs"
								><br />({{ blockInfo.mwebTxs.toLocaleString($i18n.locale) }} MWEB)</span
							>
						</span>
						<button v-if="Object.keys(blockInfo.txFull || {}).length" @click="showTx" class="right button">
							{{ !showTransactions ? $t("general.show-list") : $t("general.hide-list") }}
						</button>
					</td>
				</tr>
			</tbody>
			<tbody v-else-if="blockInfo && type == 'block'">
				<tr v-if="!mwebOnly">
					<td>
						<strong>{{ $t("general.hash") }}</strong>
					</td>
					<td class="break">
						<a :href="$root.coinConfig.explorerBlockUrl + String(blockInfo.height)" target="_blank">{{
							shortHash(blockInfo.hash, 10, true)
						}}</a>
					</td>
				</tr>
				<tr v-if="$root.coinConfig.ticker === 'LTC'">
					<td>
						<strong>MWEB {{ $t("general.hash") }}</strong>
					</td>
					<td class="break">
						<a :href="$root.coinConfig.mwebExplorerBlockUrl + String(blockInfo.height)" target="_blank">{{
							shortHash(blockInfo.mweb.hash, 10, true)
						}}</a>
					</td>
				</tr>
				<tr>
					<td>
						<strong>{{ $t("general.confirmed") }}</strong>
					</td>
					<td class="break">{{ confirmedTime }}</td>
				</tr>
				<tr v-if="blockInfo.lowFee && !mwebOnly">
					<td>
						<strong>{{ $root.i18n($root.busFeeTitleLong) }}</strong>
					</td>
					<td v-if="blockInfo.feeArray && blockInfo.feeArray.length > 1" class="break">
						<vue-bar-graph
							class="bar-graph"
							:bar-color="'#' + $root.coinConfig.color"
							:points="feeGraphPoints"
							:height="100"
							:width="350"
							:show-x-axis="true"
						/>
					</td>
					<td v-else-if="blockInfo.lowFee" class="break">{{ rangeValue }}</td>
				</tr>
				<tr v-else-if="blockInfo.verbose === false && !mwebOnly">
					<td>
						<strong>{{ $root.i18n($root.busFeeTitleLong) }}</strong>
					</td>
					<td class="break">
						<button @click="loadBlock(blockInfo.hash, false)" class="button">Load Data</button>
					</td>
				</tr>
				<tr v-if="blockInfo.size && !mwebOnly">
					<td>
						<strong>{{ $t("general.size") }}</strong>
					</td>
					<td class="break">
						{{ blockInfo.size.toLocaleString($i18n.locale) }} {{ $tc("general.bytes", 2) }}
					</td>
				</tr>
				<template v-for="formatEntry in format">
					<tr v-if="blockInfo[formatEntry.key] && !mwebOnly" :key="formatEntry.key">
						<td>
							<strong>{{ $root.i18n(formatEntry.title) }}</strong>
						</td>
						<td class="break">
							{{ blockInfo[formatEntry.key] }}
							<span v-if="formatEntry.after">{{ formatEntry.after }}</span>
						</td>
					</tr>
				</template>
				<tr v-if="!mwebOnly">
					<td>
						<strong>{{ $tc("general.transaction", 2) }}</strong>
					</td>
					<td class="break">
						{{ blockInfo.txFull ? blockInfo.txs.toLocaleString($i18n.locale) : 0 }}
						<button
							v-if="blockInfo.txFull && Object.keys(blockInfo.txFull || {}).length"
							@click="showTx"
							class="right button"
						>
							{{ !showTransactions ? $t("general.show-list") : $t("general.hide-list") }}
						</button>
						<button
							@click="loadBlock(blockInfo.hash)"
							class="right button"
							v-else-if="!Object.keys(blockInfo.txFull).length && blockInfo.verbose === false"
						>
							Load List
						</button>
					</td>
				</tr>
				<tr v-else>
					<td>
						<strong>MWEB {{ $tc("general.transaction", 2) }}</strong>
					</td>
					<td class="break">
						{{ blockInfo.mweb.num_kernels.toLocaleString($i18n.locale) }}
					</td>
				</tr>
			</tbody>
		</table>
		<transactions
			v-if="showTransactions && blockInfo.txs"
			:key="height + '-txs'"
			v-bind="{ thead: $tc('general.transaction', 2), txsEnabled: true, customList: customList }"
		></transactions>
	</div>
</template>

<script>
// @ts-nocheck
/* eslint-disable vue/no-unused-components */
import Transactions from "./Transactions.vue";
import VueBarGraph from "vue-bar-graph";
import { add } from "date-fns";
import { fds } from "../../i18n";
import { shortHash } from "../utils";

export default {
	props: {
		data: {
			type: Number,
		},
		windowKey: {
			type: String,
		},
		mwebOnly: {
			type: Boolean,
			default() {
				return false;
			},
		},
	},
	components: {
		Transactions,
		VueBarGraph,
	},
	data: function () {
		return {
			height: 0,
			blockInfo: false,
			type: false,
			showTransactions: false,
			checkBlockInterval: false,
			lastUpdated: Date.now(),
			loadingFull: false,
		};
	},
	computed: {
		customList() {
			const list = [];
			if (!this?.blockInfo?.txFull) return list;
			for (const tx in this.blockInfo.txFull) {
				if (this.mwebOnly && !this.blockInfo.txFull[tx]?.e?.mweb) continue;
				list.push(this.blockInfo.txFull[tx]);
			}
			return list;
		},
		rangeValue() {
			let lastBlock = this.$root.coinConfig.liveBlocks[this.$root.coinConfig.liveBlocks.length - 1];
			if (this.height == lastBlock.height + 1) return "> " + this.blockInfo.lowFee;
			if (this.blockInfo.lowFee === this.blockInfo.highFee) return this.blockInfo.lowFee;
			return this.blockInfo.lowFee + " - " + this.blockInfo.highFee;
		},
		format() {
			let street = this.$root.getStreet();
			if (!street) return false;
			return street.vueBlockFormat;
		},
		confirmationTime() {
			let lastBlock = this.$root.coinConfig.liveBlocks[this.$root.coinConfig.liveBlocks.length - 1];
			let lastHeight = lastBlock.height;
			let thisHeight = this.blockInfo.height;
			let difference = thisHeight - lastHeight;
			let blockTime = this.$root.stats.medianBlockTime.value;
			let ago = fds(new Date(), add(new Date(), { seconds: difference * blockTime }), {
				roundingMethod: "floor",
			});
			return "~" + ago;
		},
		confirmedTime() {
			this.$root.now;
			if (this.type !== "block") return false;
			return fds(this.blockInfo.time * 1000, new Date(), { addSuffix: true, roundingMethod: "floor" });
		},
		sortedCount() {
			return this.$root.sortedCount;
		},
		blockchainLength() {
			return this.$root.blockchainLength;
		},
		feeGraphPoints() {
			let barCount = 100;
			let lowFee = this.blockInfo.lowFee;
			let highFee = this.blockInfo.highFee;
			let range = highFee - lowFee;
			let increment = range / barCount;

			let points = [];
			let start = lowFee - increment / 2;
			this.addPoints(points, barCount, start, increment);
			this.combineTail(points, barCount);

			let retries = 0;
			while (points.length < barCount && retries < 9) {
				let maxValue = Math.max.apply(
					Math,
					points.map(function (o) {
						return o.value;
					})
				);
				for (let i = 0; i < points.length; i++) {
					const point = points[i];
					if (maxValue === point.value) {
						let newIncrement = (point.stop - point.start) / 2;
						if (point.start - newIncrement < 0.5) continue;
						points.splice(i, 1);
						this.addPoints(points, 1, point.start, newIncrement);
						break;
					}
				}
				retries++;
			}

			let values = {};
			let finalPoints = [];
			for (let i = 0; i < points.length; i++) {
				const point = points[i];
				if (!values[point.label]) values[point.label] = 0;
				values[point.label] += point.value;
			}
			for (const label in values) {
				const value = values[label];
				finalPoints.push({
					label: label,
					value: value,
				});
			}

			finalPoints.sort((a, b) => a.label - b.label);
			if (finalPoints.length > 14) {
				//remove lables so only 10 labels max
				let labelEvery = Math.ceil(finalPoints.length / 14);
				for (let i = 0; i < finalPoints.length; i++) {
					const point = finalPoints[i];
					if (i % labelEvery && i !== 0) {
						point.label = "";
					}
				}
			}
			if (!finalPoints.length) {
				finalPoints.push({
					label: lowFee,
					value: this.blockInfo.txs,
				});
			}
			return finalPoints;
		},
	},
	watch: {
		sortedCount: function () {
			if (this.type == "block") return false;
			this.blockInfo = this.getBlockInfo();
		},
		blockchainLength: function () {
			if (this.type == "block") return false;
			this.blockInfo = this.getBlockInfo();
		},
		"blockInfo.feeArray": function () {
			this.lastUpdated = Date.now();
		},
	},
	methods: {
		shortHash(hash, chars = 3, dots = false) {
			return shortHash(hash, chars, dots);
		},
		async loadBlock(hash, openTxs = true) {
			this.loadingFull = true;
			try {
				let response = await fetch(
					`${process.env.VUE_APP_REST_API}/static/blocks/${this.$root.coinConfig.ticker}/${hash}`
				);
				let json = await response.json();
				if (json) {
					for (let i = 0; i < this.$root.coinConfig.liveBlocks.length; i++) {
						const block = this.$root.coinConfig.liveBlocks[i];
						if (block.hash === json.hash) {
							json.processed = true;
							this.$root.coinConfig.liveBlocks[i] = json;
							this.$root.coinConfig.calcBlockFeeArray(json);
							this.blockInfo = Object.seal(this.cloneBlock(json));
							if (openTxs) this.showTransactions = true;
							this.$forceUpdate();
							break;
						}
					}
				}
				this.loadingFull = false;
			} catch (err) {
				console.log(err);
				this.loadingFull = false;
			}
		},
		combineTail(points) {
			if (!points.length) return false;
			let txCount = this.blockInfo.feeArray.length;
			let stop = points[points.length - 1].stop;
			let start = 0;
			let value = 0;
			for (let i = points.length - 1; i >= 0; i--) {
				const point = points[i];
				if (point.value / txCount > 0.01) break;
				points.splice(i, 1);
				value += point.value;
				start = point.start;
			}
			if (start) {
				let labelRaw = start + stop / 2;
				points.push({
					label: Math.round(labelRaw),
					labelRaw: labelRaw,
					value: value,
					start: start,
					stop: stop,
				});
			}
		},
		addPoints(points, amount, start, increment) {
			let currentInc = start;
			for (let i = 0; i <= amount; i++) {
				let txs = 0;
				for (let j = 0; j <= this.blockInfo.feeArray.length; j++) {
					const fee = this.blockInfo.feeArray[j];
					if (fee < currentInc + increment && fee >= currentInc) txs++;
				}
				let labelRaw = currentInc + increment / 2;
				let label = Math.round(labelRaw);
				if (txs > 0) {
					points.push({
						label: label,
						labelRaw: labelRaw,
						value: txs,
						start: currentInc,
						stop: currentInc + increment,
					});
				}
				// }
				currentInc += increment;
			}
		},
		pointsContainLabel(points, value) {
			for (let i = 0; i < points.length; i++) {
				if (points[i].label === value) return points[i];
			}
			return false;
		},
		showTx() {
			this.showTransactions = !this.showTransactions;
			if (this.$parent && this.$parent.windowData) {
				this.$parent.adjustHeight();
			}
		},
		cloneBlock(block) {
			let blockClone = JSON.parse(JSON.stringify(block));
			if (typeof blockClone.txFull === "undefined") {
				blockClone.txFull = {};
			}
			return blockClone;
		},
		getBlockFromStreet(){
			let street = this.$root.getStreet();
			for (let i = 0; i < this.$root.coinConfig.liveBlocks.length; i++) {
				const block = this.$root.coinConfig.liveBlocks[i];
				if (block.height === this.height) {
					this.type = "block";
					return Object.seal(this.cloneBlock(block));
				}
			}
			for (let i = 0; i < street.buses.children.entries.length; i++) {
				const bus = street.buses.children.entries[i];
				if (bus.data.values.id === this.height) {
					this.type = "bus";
					return Object.seal(bus.blockFormat());
				}
			}
			return false;
		},
		getBlockInfo() {
			let block = this.getBlockFromStreet();
			return block;
		},
	},
	mounted() {
		if (typeof this.data === "object") {
			this.height = this.data.height;
			this.type = "block";
			this.blockInfo = Object.seal(this.data);
		} else {
			this.height = Number(this.data);
			this.blockInfo = this.getBlockInfo();
		}
		this.checkBlockInterval = setInterval(() => {
			if (this.type == "bus") {
				let lastBlock = this.$root.coinConfig.liveBlocks[this.$root.coinConfig.liveBlocks.length - 1];
				let lastHeight = lastBlock.height;
				let thisHeight = this.blockInfo.height;
				if (lastHeight >= thisHeight) this.blockInfo = this.getBlockInfo();
			}
		}, 1000);
	},
	beforeDestroy: function () {
		this.$root.removeWindowData(this.windowKey);
		clearInterval(this.checkBlockInterval);
	},
};
</script>
