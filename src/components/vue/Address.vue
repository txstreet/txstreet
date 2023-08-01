<template>
	<div>
		<article
			v-if="$root.coinConfig.ticker === 'btc' || $root.coinConfig.ticker === 'bch'"
			class="message is-warning"
		>
			<div class="message-body">
				{{ $t("messages.monitoring-not-reliable", { ticker: $t("general." + $root.coinConfig.ticker) }) }}
			</div>
		</article>
		<h2 class="subtitle has-text-centered">
			<a :href="$root.coinConfig.explorerAddressUrl + address" target="_blank">{{ userInput }}</a>
		</h2>
		<div class="has-text-centered">
			<button class="button is-centered" :class="addressFollowed ? 'is-danger' : ''" @click="followAddress">
				{{ addressFollowed ? $t("general.unfollow") : $t("general.follow") }}
			</button>
		</div>
		<div v-if="fromTransactions.length">
			<transactions
				:style="'width:' + (toTransactions.length ? '50' : '100') + '%; float:left;'"
				key="sent"
				v-bind="{ thead: $t('general.sent-transactions'), customList: fromTransactions, txsEnabled: true }"
			></transactions>
		</div>
		<div v-if="toTransactions.length">
			<transactions
				:style="'width:' + (fromTransactions.length ? '50' : '100') + '%; float:left;'"
				key="received"
				v-bind="{ thead: $t('general.received-transactions'), customList: toTransactions, txsEnabled: true }"
			></transactions>
		</div>
		<article v-if="!toTransactions.length && !fromTransactions.length" class="message is-warning">
			<div class="message-body">{{ $t("messages.no-recent") }}</div>
		</article>
	</div>
</template>

<script>
// @ts-nocheck
import Transactions from "./Transactions.vue";
import eventHub from "./eventHub";

export default {
	props: ["userInput"],
	components: {
		Transactions,
	},
	data: function () {
		return {
			toTransactions: [],
			fromTransactions: [],
			address: "",
		};
	},
	methods: {
		followAddress() {
			let street = this.$root.getStreet();
			street.followAddress(this.address, true);
		},
		getFromApi() {
			let street = this.$root.getStreet();
			let recentBlock = this.$root.coinConfig.liveBlocks[this.$root.coinConfig.liveBlocks.length - 1];
			let result = street.apiAddress(this.address, { startBlock: recentBlock.height - 2056 });

			result.then((res) => {
				if (res) {
					for (let i = 0; i < res.length; i++) {
						const tx = res[i];
						this.addTx(tx);
					}
				}
			});
		},
		addTx(tx, before = false) {
			let from = tx.fr;
			let to = tx.to;
			if (typeof from === "string") from = [from];
			if (typeof to === "string") to = [to];
			if (to && to.includes(this.address) && !this.existsInList(this.toTransactions, tx)) {
				if (before ? this.toTransactions.unshift(tx) : this.toTransactions.push(tx));
			} else if (from && from.includes(this.address) && !this.existsInList(this.fromTransactions, tx)) {
				if (before ? this.fromTransactions.unshift(tx) : this.fromTransactions.push(tx));
			}
		},
		addTxEvent(tx) {
			this.addTx(tx, true);
		},
		existsInList(arr, tx) {
			for (let i = 0; i < arr.length; i++) {
				const entry = arr[i];
				if (entry.tx === tx.tx) return true;
			}
			return false;
		},
		checkList() {
			for (let i = 0; i < this.$root.coinConfig.liveTxs.length; i++) {
				const tx = this.$root.coinConfig.liveTxs[i];
				this.addTx(tx);
			}
		},
	},
	computed: {
		addressFollowed: function () {
			return Boolean(this.$root.$refs.following.followedAddresses[this.address]);
		},
	},

	mounted() {
		let street = this.$root.getStreet();
		this.address = typeof street.formatAddr === "function" ? street.formatAddr(this.userInput) : this.userInput;
		this.checkList();
		eventHub.$on("addTx-" + street.config.ticker, this.addTxEvent);

		this.getFromApi();
	},
	beforeDestroy() {
		let street = this.$root.getStreet();
		eventHub.$off("addTx-" + street.config.ticker, this.addTxEvent);
	},
};
</script>