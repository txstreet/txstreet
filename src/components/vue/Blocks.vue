<template>
	<div>
		<div class="blocks">
			<transition-group name="fade" tag="div">
				<template v-for="block in blockList()">
					<div class="box blocks-block" v-bind:key="block.hash">
						<span v-if="block.uncle" class="far fa-exclamation-triangle"></span>
						<div>
							<p class="heading level">
								<a @click="openBlock(block)">#{{ block.height }} (...{{ block.hash.slice(-5) }})</a>
								<span>{{ timeAgo(block) }}</span>
							</p>
							<span class="tag is-danger" v-if="block.uncle">
								<span class="fas fa-times"></span>
								Uncle block (Replaced)
							</span>
							<span style="background: #f9ebdf" class="tag" v-if="block.size">
								<span class="fas fa-box"></span>
								{{ block.size.toLocaleString($i18n.locale) }} {{ $tc("general.bytes", 2) }}
							</span>
							<span style="background: #cdf5f6" class="tag" v-if="block.txs">
								<span class="fas fa-receipt"></span>
								{{ block.txs.toLocaleString($i18n.locale) }}
								{{ $tc("general.transaction", block.txs) }}
							</span>
							<template v-for="formatEntry in format">
								<span
									:style="formatEntry.color ? 'background: #' + formatEntry.color : ''"
									:key="formatEntry.key"
									class="tag"
									v-if="block[formatEntry.key]"
								>
									<span v-if="formatEntry.icon" :class="formatEntry.icon"></span>
									{{ $root.i18n(formatEntry.title) }}
									{{
										typeof formatEntry.format === "function"
											? formatEntry.format(block[formatEntry.key])
											: block[formatEntry.key]
									}}
								</span>
							</template>
						</div>
					</div>
				</template>
			</transition-group>
		</div>
	</div>
</template>

<script>
// @ts-nocheck
import { fds } from "../../i18n";
import { enabledConfig } from "../config";
import blockFactories from "../blocks";
export default {
	props: ["ticker"],
	data: function () {
		return {};
	},
	mounted() {
		this.blockFactory.on("addBlock", this.update);
	},
	beforeDestroy() {
		this.blockFactory.off("addBlock", this.update);
	},
	methods: {
		update() {
			this.$forceUpdate();
		},
		openBlock(block) {
			if (typeof this.$root.blockWindow === "function") this.$root.blockWindow(block.height);
			else window.open(enabledConfig[this.ticker].explorerBlockUrl + block.height);
		},
		blockList: function () {
			let blockchain = [...this.blockFactory.blockchain].reverse();
			return blockchain;
		},
	},
	computed: {
		blockFactory: function () {
			return blockFactories[this.ticker];
		},
		format: function () {
			return enabledConfig[this.ticker].blockFormat || [];
		},
		timeAgo() {
			return (block) => {
				window.mainVue.now;
				return fds(block.time * 1000, new Date(), {
					roundingMethod: "floor",
					addSuffix: true,
				});
			};
		},
	},
};
</script>
<style lang="scss" scoped>
.blocks {
	height: 100%;
	overflow: auto;
	.blocks-block {
		.heading {
			margin-bottom: 10px;
			font-size: 0.9rem;
		}
		.tag {
			margin: 2px;
			span {
				margin-right: 10px;
			}
			font-size: 0.9rem;
			color: #4a4a4a;
		}
		&::after {
			content: "";
			position: absolute;
			display: block;
			left: 5%;
			top: 100%;
			height: 1px;
			width: 90%;
			border-bottom: 1px solid rgba($color: #a0a0a0, $alpha: 0.3);
		}
		position: relative;
		box-shadow: none;
		padding: 1rem;
		margin-bottom: 1px;
	}
}
</style>