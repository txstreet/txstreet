<template>
	<div class="field has-addons">
		<div class="control">
			<button
				@click="
					unfocusTx(getFocused());
					checkTxWindows();
				"
				v-if="focusedTx"
				class="button is-danger tooltip"
				data-tooltip="Stop Tracking"
			>
				<span class='fas fa-dot-circle'></span>
			</button>
			<button
				@click="
					focusTx(street.txFollowersHashes[0]);
					checkTxWindows();
				"
				v-else-if="followersHashes.length"
				class="button tooltip"
				data-tooltip="Start Tracking"
			>
				<span class='far fa-dot-circle'></span>
			</button>
		</div>
		<div v-if="followersHashes.length" class="control">
			<div class="dropdown is-up is-hoverable">
				<div class="dropdown-trigger">
					<button class="button is-primary">
						<span>{{ followersHashes.length }} {{ $tc("general.tx", followersHashes.length) }}</span>
						<span class="icon is-normal">
							<span class="fas fa-chevron-up"></span>
						</span>
					</button>
				</div>
				<div class="dropdown-menu">
					<div class="dropdown-content" style="width: 375px">
						<div v-for="hash in followersHashes" :key="hash" class="dropdown-item">
							<div style="display: block" class="buttons has-text-centered has-addons">
								<button class="button is-normal" @click="$root.txWindow({ tx: hash }, true)">
									{{ shortHash(hash, 5, true) }}
								</button>
								<button @click="unfollowTx(hash)" class="button is-danger is-normal">
									{{ $t("general.unfollow") }}
								</button>
								<button
									@click="
										hash === focusedTx ? unfocusTx(hash) : switchToFocus(hash);
										checkTxWindows();
									"
									:class="hash === focusedTx ? 'is-danger is-light' : ''"
									class="button is-normal"
								>
									<span class="fa-dot-circle" :class="hash === focusedTx ? 'fas' : 'far'"></span>
								</button>
							</div>
							<!-- <hr v-if="index !== followersHashes.length - 1" class="dropdown-divider"> -->
						</div>
					</div>
				</div>
			</div>
		</div>
		<div v-if="Object.keys(followedAddresses).length" class="control">
			<div class="dropdown is-up is-hoverable">
				<div class="dropdown-trigger">
					<button class="button is-primary">
						<span
							>{{ Object.keys(followedAddresses).length }}
							{{ $tc("general.address", Object.keys(followedAddresses).length) }}</span
						>
						<span class="icon is-normal">
							<i class="fas fa-chevron-up"></i>
						</span>
					</button>
				</div>
				<div class="dropdown-menu">
					<div class="dropdown-content" style="width: 375px">
						<div v-for="(val, hash) in followedAddresses" :key="hash" class="dropdown-item">
							<div style="display: block" class="buttons has-text-centered has-addons">
								<button class="button is-normal" @click="$root.addressWindow(hash, true)">
									{{ shortHash(hash, 5, true) }}
								</button>
								<button @click="unFollowAddress(hash)" class="button is-danger is-normal">
									{{ $t("general.unfollow") }}
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script>
// @ts-nocheck
import txFollower from "../tx-follower.js";
import { userSettings, config } from "../config.js";
import { shortHash } from "../utils";
import Notification from "./toasts/Notification.vue";
import eventHub from "./eventHub";

export default {
	props: ["followersHashes"],
	data: function () {
		return {
			followedAddresses: {},
			focusedTx: false,
		};
	},
	methods: {
		shortHash: shortHash,
		followTx(hash, forceFocus = false) {
			if (this.street.txFollowersHashes.includes(hash)) return false;
			let follower = new txFollower(hash, this.street);
			if (!this.street.isFollowerFocused() || forceFocus) {
				follower.focused = true;
				this.focusedTx = hash;
			}
			this.street.addFollower(hash, follower);
			follower.start();
			return true;
		},
		unfollowTx(hash) {
			if (this.street.txFollowers[hash]) {
				this.street.txFollowers[hash].stop();
				this.street.removeFollower(hash);
			}
			if (hash === this.focusedTx) this.focusedTx = false;
			return false;
		},
		switchToFocus(hash) {
			if (this.street.txFollowers[hash] && !this.street.txFollowers[hash].focused) {
				for (let i = 0; i < this.followersHashes.length; i++) {
					const fhash = this.followersHashes[i];
					if (hash === fhash) continue;
					this.unfocusTx(fhash);
				}
				this.focusTx(hash);
				this.focusedTx = hash;
			}
			return true;
		},
		focusTx(hash) {
			if (this.street.txFollowers[hash]) {
				this.street.txFollowers[hash].focus();
				this.focusedTx = hash;
				return true;
			}
			return false;
		},
		unfocusTx(hash) {
			if (this.street.txFollowers[hash] && this.street.txFollowers[hash].focused) {
				this.street.txFollowers[hash].unfocus();
			}
			if (hash === this.focusedTx) this.focusedTx = false;

			return false;
		},
		getFocused() {
			for (let i = 0; i < this.followersHashes.length; i++) {
				const fhash = this.followersHashes[i];
				const follower = this.street.txFollowers[fhash];
				if (follower.focused) return fhash;
			}
			return false;
		},
		checkTxWindows() {
			for (let i = 0; i < this.$root.$children.length; i++) {
				const child = this.$root.$children[i];
				if (child.$children.length) {
					for (let j = 0; j < child.$children.length; j++) {
						const child2 = child.$children[j];
						if (typeof child2.checkTxFollower === "function") {
							child2.checkTxFollower();
						}
					}
				}
			}
		},
		unFollowAddress(address) {
			this.street.followAddress(address, true);
			this.$delete(this.followedAddresses, address);
		},
		saveAddresses() {
			localStorage.setItem(
				this.$root.coinConfig.ticker + "-followedAddresses",
				JSON.stringify(this.followedAddresses)
			);
		},
		loadAddresses() {
			let followedAddresses = localStorage.getItem(
				this.$root.coinConfig.ticker + "-followedAddresses",
				JSON.stringify(this.followedAddresses)
			);
			if (!followedAddresses) return false;
			this.followedAddresses = JSON.parse(followedAddresses);
		},
		followParams() {
			const params = new URLSearchParams(location.search);
			let followHashes = params.get(this.$root.coinConfig.ticker + "follow");
			if (!followHashes) return false;
			this.followWhenLoaded(followHashes);
		},
		async followWhenLoaded(hash) {
			if (!this.street.loaded) {
				setTimeout(() => {
					this.followWhenLoaded(hash);
				}, 100);
				return false;
			}
			if (!this.street.lineManager[hash]) {
				//not found loaded in pending, get from api
				let response = await this.street.apiTransaction(hash);
				if (!response || !response.tx) {
					//tx not found
					this.$toast.error(
						{
							component: Notification,
							props: {
								title: "Tx not found",
								html: this.txLink(hash),
							},
						},
						{
							position: "bottom-center",
							closeOnClick: false,
							timeout: 20000,
						}
					);
					return false;
				}
				if (response.bh) {
					//found confirmed tx
					this.$root.txWindow(response);
					this.$toast.success(
						{
							component: Notification,
							props: {
								title: "Tx confirmed",
								html: this.txLink(hash),
							},
						},
						{
							position: "bottom-center",
							closeOnClick: false,
							timeout: 20000,
						}
					);
					return;
				}
				//tx is found and unconfirmed, add to street and follow
				this.street.newTx(response, "new", true, true);
			}
			this.followTx(hash, true);
			this.$toast.info(
				{
					component: Notification,
					props: {
						title: "Tx following",
						html: this.txLink(hash),
					},
				},
				{
					position: "bottom-center",
					closeOnClick: false,
					timeout: 20000,
				}
			);
            this.$root.txWindow({tx:hash});
		},
		txLink(hash) {
			return (
				"<a href='" +
				this.street.config.explorerTxUrl +
				hash +
				"' target='_blank'>" +
				shortHash(hash, 10, true) +
				"</a>"
			);
		},
	},
	computed: {
		street: function () {
			return this.$root.getStreet();
		},
	},
	mounted() {
		eventHub.$on("addTx-" + this.$root.coinConfig.ticker, (tx) => {
			if (!this.street.lineManager[tx.tx]) return false;
			if (tx.fr) {
				let frs = tx.fr;
				if (typeof tx.fr === "string") {
					frs = [frs];
				}
				for (let i = 0; i < frs.length; i++) {
					const fr = frs[i];
					if (this.followedAddresses[fr]) {
						//found match
						this.followTx(tx.tx);
					}
				}
			}
			if (tx.to) {
				let tos = tx.to;
				if (typeof tx.to === "string") {
					tos = [tos];
				}
				for (let i = 0; i < tos.length; i++) {
					const to = tos[i];
					if (this.followedAddresses[to]) {
						//found match
						this.followTx(tx.tx);
					}
				}
			}
		});
		eventHub.$on("addBlock-" + this.$root.coinConfig.ticker, (block) => {
			const txArray = Object.keys(block.tx || {});
			if (txArray && txArray.length) {
				for (let i = 0; i < txArray.length; i++) {
					const tx = txArray[i];
					if (
						this.street.txFollowers[tx] &&
						!document.hasFocus() &&
						userSettings[this.$root.coinConfig.ticker + "Settings"].txNotifications.value
					) {
						let n = new Notification(this.$t("messages.transaction-conf"), {
							body: tx,
							icon:
								config.baseUrl +
								"static/img/singles/coin_logos/" +
								this.$root.coinConfig.ticker +
								".png?v=" + process.env.VUE_APP_VERSION,
							timestamp: Math.floor(Date.now()),
						});
						n.onclick = function () {
							window.focus();
							this.close();
						};
					}
				}
			}
		});
		this.loadAddresses();
		this.followParams();
		this.focusedTx = this.getFocused();
		setTimeout(() => {
			this.focusedTx = this.getFocused();
		}, 1000);
	},
};
</script>