
<template>
	<div class="stat-item-inner">
		<div class="stat-item-value">
			<div class="load-container" v-if="!loaded">
				<span style="display: inline-block" class="loader is-loading"></span>
			</div>
			<div v-else class="table-container">
				<table class="table is-striped is-fullwidth is-narrow">
					<thead class="unselectable">
						<tr>
							<th class="break" v-for="heading in headings" :key="heading">
								{{ heading }}
							</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="(row, i) in table" :key="i">
							<td class="break" v-for="(data, i) in row" :key="'data' + i" v-html="data"></td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</div>
</template>
<script>
import { shortHash } from "@/components/utils";
import { newJsonRefresher } from "../controllers/jsonRefresher";

export default {
	props: ["timeframe"],
	data: function () {
		return {
            headings: ["Name", "Txs"],
			options: [
				{
					key: "5min",
					title: "5 minutes",
				},
				{
					key: "1hour",
					title: "1 hour",
				},
				{
					key: "1day",
					title: "1 day",
				},
			],
			jsonRefresher: null,
            loaded:false
		};
	},
	beforeMount() {
		this.jsonRefresher = newJsonRefresher(
			process.env.VUE_APP_REST_API + "/static/live/trending-contracts-ETH-" + this.timeframe,
			5000
		);
	},
    beforeDestroy(){
        this.jsonRefresher.stop();
    },
	methods: {
		formatJson(json) {
			const table = [];
			for (let i = 0; i < json.length; i++) {
				const entry = json[i];
				let name = entry.contract.name || entry.hash;
				if (name.length > 22) name = shortHash(name, 10, true);
				name = '<a target="_blank" href="https://etherscan.io/address/' + entry.hash + '">' + name + "</a>";
				let newEntry = [name, entry.transactions];
				table.push(newEntry);
			}
			return table;
		},
	},
	computed: {
		table() {
			if (!this.jsonRefresher?.value || !Array.isArray(this.jsonRefresher.value)) return [];
			return this.formatJson(this.jsonRefresher.value);
		},
	},
    watch: {
		table(newVal) {
			if (newVal.length) {
				this.loaded = true;
			}
		},
	},
};
</script>