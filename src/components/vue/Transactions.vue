<template>
	<div>
		<template v-if="txsEnabled">
			<div class="tx-list-header" v-if="thead">{{ thead }}</div>
			<div
				class="tx-list-container"
				:data-content="this.$t('messages.not-updating')"
				:class="!updating ? '' : 'shadow'"
				@mouseenter="updating = true"
				@mouseleave="updating = false"
				@click="txWindow"
			>
				<virtual-list
					:class="!updating ? '' : 'shadow'"
					class="tx-list"
					:data-key="'tx'"
					:data-sources="txs"
					:data-component="txComp"
					item-tag="li"
					wrap-tag="ul"
					:keep="15"
					:estimate-size="24"
				/>
			</div>
		</template>
		<div v-else>
			<div class="is-divider"></div>
			<article class="message is-warning">
				<div class="message-body">{{ $t("messages.not-tracked", { title: plans.title }) }}</div>
			</article>
		</div>
	</div>
</template>

<script>
// @ts-nocheck
import VirtualList from "vue-virtual-scroll-list";
import TransactionListItem from "./TransactionListItem.vue";
import { enabledConfig } from "../config";
import eventHub from "./eventHub";

export default {
	props: {
		house: {
			default: function () {
				return [];
			},
		},
		thead: {
			default: "Recent Transactions",
		},
		ticker: null,
		txsEnabled: {
			default: true,
		},
		plans: {},
		customList: {
			default: false,
		},
	},
	components: { "virtual-list": VirtualList },
	data: function () {
		return {
			txs: [],
			listener: null,
			lastGet: 0,
			getTimeout: null,
			updating: false,
			txComp: TransactionListItem,
		};
	},
	methods: {
		txWindow: function (e) {
			const element = e.target.closest(".tx-link");
			if (!element) return;
			const hash = element.getAttribute("data-tx");
			if (!hash) return;
			const tx = this.getTx(hash);
			if (!tx) return;

			if (typeof this.$root.getStreet === "undefined") {
				if (tx.chain) {
					window.open(enabledConfig[tx.chain].explorerTxUrl + tx.tx);
				}
				return;
			}
			let street = this.$root.getStreet();
			if (Object.keys(tx).length > 2 || street.lineManager[tx.tx]) {
				this.$root.txWindow(tx);
			} else {
				if (this.$root.$refs.search) {
					this.$root.$refs.search.searchTransaction(tx.tx, false);
				}
			}
		},
		getTx(hash) {
			for (let i = 0; i < this.txs.length; i++) {
				const tx = this.txs[i];
				if (tx.tx === hash) {
					return tx;
				}
			}
			return false;
		},
		getTxList: function () {
			//limit to once every 100 milliseconds
			if (Date.now() - this.lastGet < 100 || this.updating) {
				if (this.getTimeout) clearTimeout(this.getTimeout);
				this.getTimeout = setTimeout(() => {
					this.getTxList();
				}, 100);
				return false;
			}
			this.lastGet = Date.now();
			this.updating = true;
			//get current tx list with hash as object key for easy lookup
			let currentTxs = {};
			for (let i = 0; i < this.txs.length; i++) {
				const tx = this.txs[i];
				currentTxs[tx.tx] = tx;
			}

			let newList = [];

			//if we already have the tx object, use it instead of overwriting
			if (this.customList) {
				for (let i = 0; i < this.customList.length; i++) {
					const entry = this.customList[i];
					let toPush = typeof entry === "object" ? entry : { tx: entry };
					if (currentTxs[toPush.tx]) toPush = currentTxs[toPush.tx];
					newList.push(toPush);
				}
			} else {
				let added = 0;
				for (let i = enabledConfig[this.ticker].liveTxs.length - 1; i >= 0; i--) {
					if (added >= 30) break;
					let tx = enabledConfig[this.ticker].liveTxs[i];
					if (!this.house.length || this.house.includes(tx.h)) {
						added++;
						if (currentTxs[tx.tx]) tx = currentTxs[tx.tx];
						newList.push(tx);
					}
				}
			}
			this.txs = newList;
			this.updating = false;
			return true;
		},
		addTxEvent(tx) {
			if (!this.house.length || this.house.includes(tx.h)) {
				this.getTxList();
			}
		},
		addBlockEvent(block) {
			if (!block.txFull) return false;
			if (!this.customList) return false;
			for (let i = 0; i < this.txs.length; i++) {
				const tx = this.txs[i];
				if (tx.bh) continue;
				if (block.txFull[tx.tx]) {
					//found matching tx
					this.txs[i].bh = block.hash;
				}
			}
			this.$forceUpdate();
		},
	},
	mounted() {
		this.getTxList();

		if (this.ticker) {
			eventHub.$on("addTx-" + this.ticker, this.addTxEvent);
			eventHub.$on("addBlock-" + this.ticker, this.addBlockEvent);
		}
	},
	beforeDestroy() {
		eventHub.$off("addTx-" + this.ticker, this.addTxEvent);
		eventHub.$off("addBlock-" + this.ticker, this.addBlockEvent);
		if (this.getTimeout) clearTimeout(this.getTimeout);
	},
	watch: {
		"customList.length": function () {
			this.getTxList();
		},
	},
};
</script>