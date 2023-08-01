<template>
	<div>
		<div class="has-text-right block">
			<connect />
		</div>
		<p class="block">
			Connect your wallet and choose an NFT that will be displayed for all of your transactions. This will also be visible to anyone else watching TxStreet.
		</p>
		<div class="section has-text-centered" v-if="state.address">
			<div v-if="!loaded">
				<span class="loader is-loading" style="width: 50px; height: 50px; margin: 10px auto"></span>
			</div>
			<div v-else>
				<div v-if="inventory.length">
					<div class="block char-button-container">
						<div
							@click="newSelected = nft.key"
							class="char-button button"
							:class="{ 'is-primary': selected === nft.key, 'is-success': newSelected === nft.key }"
							v-for="nft in inventory"
							:key="nft.key"
						>
							<img :class="{'pixel-art': charConfig[nft.collectionSlug] && charConfig[nft.collectionSlug].pixelArt}" :src="nft.imageUrl" />
						</div>
					</div>
					<div class="block has-text-centered">
						<button :disabled="!newSelected || newSelected === selected" @click="setCharacter" class="button is-success is-large">Set Character</button>
					</div>
				</div>
				<div class="section" v-else>No compatible NFTs found.</div>
			</div>
		</div>
	</div>
</template>

<script>
// @ts-nocheck
import { web3, init, default as state } from "../../wallet";
import Connect from "./Connect.vue";
import { config, charConfig, zoomerNames } from "../config.js";
export default {
	components: { Connect },
	data: function () {
		return {
			inventory: [],
			selected: "",
			newSelected: null,
			loaded: false,
		};
	},
	methods: {
		async getInventory() {
			if (!state.address) return;
			let url = process.env.VUE_APP_REST_API + "/api/v2/nft/inventory/" + state.address;
			let result = await fetch(url);
			let parsed = await result.json();

			if (!parsed.nfts) return;
			for (let i = 0; i < parsed.nfts.length; i++) {
				const nft = parsed.nfts[i];
				nft.key = nft.collectionSlug + "-" + nft.tokenId;
				if (nft.localChar) {
					nft.imageUrl =
						"/static/img/singles/" + (zoomerNames.includes(nft.localChar) ? "zoomers" : "characters") + "/" + nft.localChar + "-0.png?v=" + process.env.VUE_APP_VERSION;
				} else {
					nft.imageUrl = process.env.VUE_APP_STORAGE_URL + nft.collectionSlug + "/" + nft.tokenId + ".png";
				}
			}
			this.inventory = parsed.nfts;
			this.loaded = true;
			return parsed;
		},
		async getCharacter() {
			if (!state.address) return;
			let url = process.env.VUE_APP_REST_API + "/api/v2/nft/getCharacter/" + state.address;
			let result = await fetch(url);
			let parsed = await result.json();
			if (!parsed.result) return;
			this.selected = parsed.result;
			return parsed;
		},
		async setCharacter() {
			if (!this.newSelected) return;
			const message = "Set character to " + this.newSelected;
			let signature = await web3.eth.personal.sign(message, state.address, "");
			let body = JSON.stringify({
				address: state.address,
				message: message,
				signature: signature,
			});
			let promise = await fetch(process.env.VUE_APP_REST_API + "/api/v2/nft/setCharacter", {
				method: "POST",
				headers: {
					Accept: "application/json",
					"Content-Type": "application/json",
				},
				body,
			});
			let json = await promise.json();
			if (json.result) {
				this.selected = this.newSelected;
				this.newSelected = null;
			}
		},
		async initSelect() {
			await init();
			this.getInventory();
			this.getCharacter();
		},
	},
	computed: {
		state() {
			return state;
		},
		config() {
			return config;
		},
		charConfig() {
			console.log(charConfig);
			return charConfig;
		}
	},
	watch: {
		"state.address"() {
			this.loaded = false;
			this.getInventory();
			this.getCharacter();
		},
	},
	mounted() {
		this.initSelect();
	},
};
</script>
<style lang="scss" scoped>
.char-button-container {
	text-align: center;
	.char-button {
		height: 100px;
		width: auto;
		display: inline-block;
		margin: 2px;
		img {
			height: 100%;
			width: auto;
		}
	}
}
</style>