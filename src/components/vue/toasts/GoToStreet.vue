<template>
	<div class="container">
		<h2>New Street!</h2>
		<span
			><button @click="switchStreet" class="button is-normal">
				<span class="coin-logo" style="background-color: #f16822">
					<img :src="`${config.baseUrl}static/img/singles/coin_logos/xmr.png?v=` + $root.appVersion" width="28" height="28" />
				</span>
				Monero
			</button></span
		>
	</div>
</template>
<script>
import { config } from "../../config";
export default {
	props: ["slug"],
	methods: {
		switchStreet() {
			window.txStreetPhaser.streetController.switchStreet(
				"full",
				window.txStreetPhaser.streetController.enabledStreets[this.slug]
			);
			this.$emit("close-toast");
		},
	},
    beforeDestroy() {
        localStorage.setItem(this.slug + "Popup", true);
    },
	computed: {
		config() {
			return config;
		},
	},
};
</script>