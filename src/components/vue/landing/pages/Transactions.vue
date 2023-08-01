<template>
	<div class="page-container">
		<div class="columns is-multiline">
            <div class="column is-full">
				<div class="vue-grid-item" style="height:500px">
					<Transactions style="height:400px"
						v-bind="{
							thead: 'All Transactions',
							ticker: 'ETH',
						}"
					/>
				</div>
			</div>
		</div>
	</div>
</template>


<script>
import { newTransactions } from "../controllers/transactions";
import Transactions from "../../Transactions.vue";

export default {
	data() {
		return {
			transactions: null,
		};
	},
	beforeMount() {
		this.transactions = newTransactions("ETH");

        //if this is a lazy loaded page, must call this function in mount
        this.$root.$refs.landing.checkSockets();
	},
	beforeDestroy() {
		this.transactions.stop();
	},
	components: {
		Transactions,
	},
};
</script>
