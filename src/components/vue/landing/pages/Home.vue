<template>
	<div>
		<div :style="'height:' + sectionHeight" class="launcher">
			<viz-launcher ref="launcher" />
		</div>
		<div :style="'top:' + sectionHeight" class="below-content">
			<MoonHeadAd class="moonhead-ad" />
			<section class="hero is-primary is-medium" style="position: relative">
				<picture class="alien-moving">
					<source srcset="/static/img/singles/webp/alien-side.webp" type="image/webp" />
					<img src="/static/img/singles/characters/alien-0.png" />
				</picture>
				<div class="hero-body">
					<p class="title">See the Blockchain. Live.</p>
					<p class="subtitle">Technically the mempool.</p>
					<p>
						TxStreet is a live transaction and mempool visualizer featuring Bitcoin, Ethereum, Bitcoin Cash,
						Monero and Litecoin. When a new transaction is broadcasted to a cryptocurrency network, a person
						appears and attempts to board a bus in real time. If the transaction has a high enough fee, they
						will board the first bus and be ready to be included in the next mined block. If there are too
						many transactions to be included in the next block, and the transaction didn't pay a high enough
						fee, the person will either wait in line or board a different bus. The movement speed of a
						person represents how high of a fee they paid compared to the current median fee. The size of a
						person represents the size of the transaction in bytes or gas.
					</p>
				</div>
			</section>
			<section class="hero is-medium second">
				<div class="hero-body">
					<div class="columns">
						<div class="column is-two-thirds">
							<p class="title">Track your Transactions.</p>
							<p class="subtitle">And anyone else's.</p>
							<p>
								Enter your address in the search bar at the top of the visualizer and click "Follow" to
								automatically track any new transaction that you send and recieve. You'll be able to see
								exactly how close each transaction is to confirming and speed them up if needed.
							</p>
							<br />
							<p>
								You can also see everyone else's transactions. What goes on in the mempool? Watch and
								find out.
							</p>
						</div>
						<div class="column is-one-third">
							<Transactions
								style="height: 320px; width: 100%"
								v-bind="{
									ticker: this.$root.selectedCoins[0],
									// txsEnabled: {},
								}"
								:key="this.$root.selectedCoins[0]"
							/>
						</div>
					</div>
				</div>
			</section>
			<section class="hero is-primary is-medium">
				<div class="hero-body">
					<p class="title">Latest Blocks.</p>
					<p class="subtitle">These are buses that have left the street.</p>
					<div class="columns">
						<div v-if="$root.selectedCoins[0]" class="column is-half">
							<div class="title">{{ enabledConfig[$root.selectedCoins[0]].coinName }}</div>
							<Blocks
								:key="$root.selectedCoins[0]"
								style="max-height: 500px; height: 500px; overflow: auto"
								v-bind="{ ticker: $root.selectedCoins[0] }"
							/>
						</div>
						<div v-if="$root.selectedCoins[1]" class="column is-half">
							<div class="title">{{ enabledConfig[$root.selectedCoins[1]].coinName }}</div>
							<Blocks
								:key="$root.selectedCoins[1]"
								style="max-height: 500px; height: 500px; overflow: auto"
								v-bind="{ ticker: $root.selectedCoins[1] }"
							/>
						</div>
					</div>
				</div>
			</section>
			<section class="hero is-medium second">
				<div class="hero-body">
					<p class="title">Some Statistics.</p>
					<p class="subtitle">In real time.</p>
					<div class="columns">
						<div v-if="$root.selectedCoins[0]" class="column is-half">
							<div class="title" :style="'color: #' + enabledConfig[$root.selectedCoins[0]].color">
								{{ enabledConfig[$root.selectedCoins[0]].coinName }}
							</div>
							<template v-for="(stat, statKey) in enabledConfig[$root.selectedCoins[0]].stats">
								<div v-if="stat.value" class="box" :key="statKey">
									<div
										:style="'color: #' + enabledConfig[$root.selectedCoins[0]].color"
										class="title is-5"
									>
										{{ $root.i18n(stat.title) }}
									</div>
									<div class="subtitle is-4">{{ calcStatValue(stat) }}</div>
								</div>
							</template>
						</div>
						<div v-if="$root.selectedCoins[1]" class="column is-half">
							<div class="title" :style="'color: #' + enabledConfig[$root.selectedCoins[1]].color">
								{{ enabledConfig[$root.selectedCoins[1]].coinName }}
							</div>
							<template v-for="(stat, statKey) in enabledConfig[$root.selectedCoins[1]].stats">
								<div v-if="stat.value" class="box" :key="statKey">
									<div
										:style="'color: #' + enabledConfig[$root.selectedCoins[1]].color"
										class="title is-5"
									>
										{{ $root.i18n(stat.title) }}
									</div>
									<div class="subtitle is-4">{{ calcStatValue(stat) }}</div>
								</div>
							</template>
						</div>
					</div>
				</div>
			</section>
            <section class="hero is-link socials">
				<div class="hero-body">
					<div class="columns has-text-centered">
						<div  class="column is-half">
							<a href="https://twitter.com/txstreetCom" target="_blank">
                            <div class="subtitle">Twitter</div><img src="/static/img/banners/twitter.png" /></a>
						</div>
						<div  class="column is-half">
							<a href="https://bit.ly/3rWCRm6" target="_blank">
                            <div class="subtitle">Discord</div><img src="/static/img/banners/discord.png" /></a>
						</div>
					</div>
				</div>
			</section>
		</div>
	</div>
</template>


<script>
import VizLauncher from "../templates/VizLauncher.vue";
import MoonHeadAd from "../templates/MoonHeadAd.vue";
import Transactions from "../templates/Transactions.vue";
import Blocks from "../templates/Blocks.vue";
import { enabledConfig } from "../../../config";
import { calcStatValue } from "../../../utils/";

export default {
	components: {
		VizLauncher,
		MoonHeadAd,
		Transactions,
		Blocks,
	},
	methods: {
		calcStatValue(stat) {
			return calcStatValue(stat);
		},
	},
	computed: {
		sectionHeight() {
			return Number(Math.max(Math.min(this.$root.softWindowHeight, 1200), 400)) + "px";
		},
		enabledConfig() {
			return enabledConfig;
		},
	},
};
</script>

<style lang="scss" scoped>
@keyframes movingPerson {
	0% {
		-webkit-transform: translateX(0px);
		transform: translateX(0px);
	}
	80% {
		-webkit-transform: translateX(-120vw);
		transform: translateX(-120vw);
	}
    100% {
		-webkit-transform: translateX(-120vw);
		transform: translateX(-120vw);
	}
}
.alien-moving {
	position: absolute;
	bottom: -6px;
	right: -70px;
	animation: movingPerson linear infinite 12s 2s;
    will-change: transform;
}
.launcher {
	width: 100%;
	position: absolute;
	left: 0;
	top: 0;
}
.below-content {
	width: 100%;
	position: absolute;
	left: 0;

	.moonhead-ad {
		margin: 50px 0;
	}
}
.socials{
    img{
        max-height: 150px;
        width: auto;
    }
}
</style>