<template>
	<Transactions
		v-bind="{
			thead: '',
			ticker: this.ticker,
			house: this.house,
			// txsEnabled: {},
		}"
	/>
</template>


<script>
import { newTransactions } from "../controllers/transactions";
import Transactions from "../../Transactions.vue";

export default {
	props: ["ticker", "house"],
	data() {
		return {
			transactions: null,
		};
	},
	beforeMount() {
		this.transactions = newTransactions(this.ticker);
	},
	beforeDestroy() {
		this.transactions.stop();
	},
	components: {
		Transactions,
	},
};
</script>
