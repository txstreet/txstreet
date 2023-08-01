<template>
	<div class="stat-item-inner" ref="container">
		<vue-bar-graph
			v-if="points.length"
			class="bar-graph"
			:points="points"
			bar-color="#0bc2a6"
			:height="height"
			:width="width"
			:labelHeight="14"
			textFont=""
			:show-values="true"
			:show-x-axis="true"
            :key="lastUpdated"
		/>
		<div class="load-container" v-else>
			<span style="display: inline-block" class="loader is-loading"></span>
		</div>
	</div>
</template>
<script>
import VueBarGraph from "vue-bar-graph";
import eventHub from "../../eventHub";
import { newStat } from "../controllers/statistic";

export default {
	props: ["slug"],
	components: {
		VueBarGraph,
	},
	data: function () {
		return {
			loaded: true,
			height: 100,
			width: 300,
			stat: null,
            lastUpdated: Date.now(),
		};
	},
	beforeMount() {
		this.stat = newStat("ETH", "osfpa-" + this.slug);
	},
    beforeDestroy() {
        this.stat.stop();
    },
	mounted() {
		eventHub.$on("resize-item", (e) => {
			if (e.i === this.i) {
				this.resize();
			}
		});
		eventHub.$on("windowWidth", this.resize);
		this.resize();
	},

	methods: {
		resize() {
			setTimeout(() => {
                if(!this.$refs.container) return;
				this.width = this.$refs.container.clientWidth;
				this.height = this.$refs.container.clientHeight;
			}, 10);
		},
		compressPoints(values, decimals) {
			let pointsObj = {};
			let points = [];
			for (let i = 0; i < values.length; i++) {
				decimals;
				const number = parseFloat(values[i].toFixed(decimals));
				if (!pointsObj[number]) pointsObj[number] = 0;
				pointsObj[number]++;
			}
			for (const label in pointsObj) {
				points.push({ label, value: pointsObj[label] });
			}

			points.sort((a, b) => a.label - b.label);
			return points;
		},
	},
	computed: {
		maxBars() {
			return this.width / 40;
		},
		points() {
			if (!this.values.length) return [];

			let decimals = 3;
			let points = this.compressPoints(this.values, decimals);
			while (points.length > this.maxBars && decimals >= 1) {
				decimals--;
				points = this.compressPoints(this.values, decimals);
			}
			return points;
		},
		values() {
            if(!this.stat?.history) return [];
			return this.stat.history[this.stat.history.length - 1]?.value || [];
		},
	},
    watch: {
		"points.length"() {
			this.lastUpdated = Date.now();
		},
	},
};
</script>
<style lang="scss" scoped>
.bar-graph {
	width: 100%;
	font-size: 1rem !important;
	font-family: "Inter", Arial, sans-serif !important;
}
</style>