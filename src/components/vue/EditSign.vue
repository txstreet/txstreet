<template>
	<div>
        <div class="message is-info"><div class="message-body">Select which stats to show on the sign. They will alternate every few seconds.</div></div>
		<multiselect
			v-model="selected"
			:options="stats"
            selectLabel="Select"
            deselectLabel="Remove"
			label="signTitle"
			track-by="key"
			:multiple="true"
			:placeholder="'Select stats'"
		></multiselect>
	</div>
</template>

<script>
import Multiselect from "vue-multiselect";
// @ts-nocheck
export default {
	data: function () {
		return {};
	},
	components: {
		Multiselect,
	},

	computed: {
		selected: {
			get() {
				let selectedArr = [];
				let arr = this.$root.coinConfig.userSettings.signArray.value;
				for (let i = 0; i < arr.length; i++) {
					const key = arr[i];
					selectedArr.push({ ...{ key: key }, ...this.$root.stats[key] });
				}
				return selectedArr;
			},
			set(val) {
				this.$root.coinConfig.userSettings.signArray.value.splice(
					0,
					this.$root.coinConfig.userSettings.signArray.value.length
				);
				for (let i = 0; i < val.length; i++) {
					const stat = val[i];
					this.$root.coinConfig.userSettings.signArray.value.push(stat.key);
				}
				console.log(val);
				this.$root.getStreet().sign.alternateStats();
				this.$root.saveSetting(this.$root.coinConfig.userSettings, this.$root.coinConfig.ticker + "Settings");
				return val;
			},
		},
		stats: function () {
			let arr = Object.entries(this.$root.stats);
            let newArr = [];
			for (let i = 0; i < arr.length; i++) {
				const stat = arr[i];
                if(stat[1].hidden) continue;
				const newStat = {
					...{ key: stat[0] },
					...stat[1],
				};
				newArr[i] = newStat;
			}
			return newArr;
		},
	},
};
</script>