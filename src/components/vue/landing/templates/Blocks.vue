<template>
	<Blocks v-bind="{ticker}" />
</template>
<script>
import blockFactories from "../../../blocks";
import Blocks from "../../Blocks.vue"

export default {
	props: ["ticker"],
	data() {
		return {
			blockFactory: null,
		};
	},
	beforeMount() {
        this.blockFactory = blockFactories[this.ticker];
		this.blockFactory.connect();
	},
	// beforeDestroy() {
	// 	this.transactions.stop();
	// },
	components: {
		Blocks,
	},
};
</script>
