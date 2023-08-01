<template>
	<div class="page-container">
		<div class="columns is-multiline">
			<div class="column is-half">
				<div class="vue-grid-item" style="height:440px">
                    <div class="stat-title">Trending Contracts (5 min)</div>
					<TrendingContracts v-bind="{ timeframe: '5min' }" />
				</div>
			</div>
			<div class="column is-half">
				<div class="vue-grid-item" style="height:auto">
                    <div class="stat-title">OpenSea Transactions</div>
					<Transactions style="height:400px"
						v-bind="{
							ticker: 'ETH',
							house: ['opensea'],
							// txsEnabled: {},
						}"
					/>
				</div>
			</div>
            <div class="column is-half">
				<div class="vue-grid-item" style="height:auto">
                    <div class="stat-title">Uniswap Transactions</div>
					<Transactions style="height:400px"
						v-bind="{
							ticker: 'ETH',
							house: ['uniswap'],
							// txsEnabled: {},
						}"
					/>
				</div>
			</div>
			<div class="column is-half">
				<div class="vue-grid-item" style="height:auto">
                    <div class="stat-title">Sushi Transactions</div>
					<Transactions style="height:400px"
						v-bind="{
							ticker: 'ETH',
							house: ['sushi'],
							// txsEnabled: {},
						}"
					/>
				</div>
			</div>
            <div class="column is-half">
				<div class="vue-grid-item" style="height:auto">
                    <div class="notification is-info">More coming soon!</div>
				</div>
			</div>
		</div>
	</div>
</template>


<script>
import TrendingContracts from "../templates/TrendingContracts.vue";
import Transactions from "../templates/Transactions.vue"

export default {
	data() {
		return {
			transactions: null,
		};
	},
	components: {
		TrendingContracts,
		Transactions,
	},
};
</script>
