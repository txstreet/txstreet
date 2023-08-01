<template>
	<div class="tx-window">
		<a class="person-image-container" target="_blank" :href="openSeaUrl" v-if="personImageUrl || isRollup">
			<img class="person-image" :class="{ 'pixel-art': pixelArt }" :src="spriteUrl" />
		</a>
		<span v-else-if="txData.bh || confirmed" class="person-image-container">
			<span class="person-image tag is-success fas fa-check is-large" />
		</span>
		<span v-else-if="txData.deleted && !txData.bh" class="person-image-container">
			<span
				class="person-image tag is-danger fas fa-exclamation-circle is-large"
			/>
		</span>
		<span v-else class="person-image-container">
		<div class="loader is-loading person-image"></div>
		</span>
		<div class="tags tx-display">
			<a v-if="txData.h" class="tag is-info" @click="$root.toggleWindow(txData.h)">
				<img
					:src="config.baseUrl + 'static/img/singles/house_logos/' + txData.h + '.png?v=' + $root.appVersion"
				/>
				{{ houseTitle }}
			</a>
			<span v-if="txData.e && txData.e.op_return" class="tag is-info">OP_RETURN</span>
			<span v-if="txData.e && txData.e.sw" class="tag is-info">Segwit</span>
			<span v-if="txData.e && (txData.e.mweb ||txData.e.mwebpegin ||txData.e.mwebpegout || txData.e.mwebhogex)" class="tag is-info">MWEB</span>

			<div v-if="!confirmed && !txData.deleted && !txData.bh" class="tx-options">
				<div class="field has-addons" v-if="!txData.bh">
					<p class="control tooltip is-tooltip-bottom" :data-tooltip="copyText">
						<button
							@click="copyLink"
							class="button"
							:class="{ 'is-link': copyText !== 'Copy follow link' }"
						>
							<span class="fas fa-link"></span>
						</button>
					</p>
					<p class="control">
						<button class="button" :class="txFollower ? 'is-danger' : ''" @click="followTx">
							{{ txFollower ? $t("general.unfollow") : $t("general.follow") }}
						</button>
					</p>
					<p v-if="txFollower" class="control">
						<button class="button" :class="txFocused ? 'is-danger is-light' : ''" @click="focusTx">
							<span class="fa-dot-circle" :class="txFocused ? 'fas' : 'far'"></span>
						</button>
					</p>
				</div>
			</div>
		</div>
		<table class="table is-striped is-narrow is-fullwidth">
			<tbody>
				<tr>
					<td>
						<strong>{{ $t("general.status") }}</strong>
					</td>
					<td class="break">
						<span v-html="status"></span>
						<span v-if="lineStatus"> ({{ lineStatus }})</span>
					</td>
				</tr>
				<tr>
					<td>
						<strong>{{ $t("general.hash") }}</strong>
					</td>
					<td class="break">
						<a :href="$root.coinConfig.explorerTxUrl + txData.tx" target="_blank">{{
							shortHash(txData.tx, 10, true)
						}}</a>
					</td>
				</tr>
				<tr v-if="txData.e && txData.e.houseContent && txData.e.houseContent !== txData.tx">
					<td>
						<strong>{{ $t("general.tracked-data") }}</strong>
					</td>
					<td class="break">
						<span v-html="txData.e.houseContent"></span>
						<span class="tx-display tags">
							<a
								v-for="(link, i) in txData.e && txData.e.l ? txData.e.l : []"
								:key="i"
								class="tag is-link"
								:href="link.l"
								target="_blank"
							>
								<img
									:src="
										link.i
											? config.baseUrl +
											'static/img/singles/tween_icons/' +
											link.i +
											'.png?v=' +
											$root.appVersion
											: config.baseUrl +
											'static/img/singles/house_logos/' +
											txData.h +
											'.png?v=' +
											$root.appVersion
									"
								/>
								{{ $t("general.link") + " " + (i + 1) }}
							</a>
						</span>
					</td>
				</tr>
				<template v-for="formatEntry in format">
					<tr v-if="typeof txData[formatEntry.key] !== 'undefined'" :key="formatEntry.key">
						<td>
							<strong>{{ $root.i18n(formatEntry.title) }}</strong>
						</td>
						<td class="break">
							{{
								typeof formatEntry.format === "function"
									? formatEntry.format(txData[formatEntry.key], txData)
									: txData[formatEntry.key]
							}}
							<span v-if="formatEntry.after">{{ formatEntry.after }}</span>
						</td>
					</tr>
				</template>
				<tr v-if="txData.fr && typeof txData.fr === 'string'">
					<td>
						<strong>{{ $t("general.from") }}</strong>
					</td>
					<td class="break">
						<a @click="$root.addressWindow(txData.fr)">{{ shortHash(txData.fr, 10, true) }}</a>
					</td>
				</tr>
				<tr v-if="txData.to && typeof txData.to === 'string'">
					<td>
						<strong>{{ $t("general.to") }}</strong>
					</td>
					<td class="break">
						<a @click="$root.addressWindow(txData.to)">{{ shortHash(txData.to, 10, true) }}</a>
					</td>
				</tr>
			</tbody>
		</table>
		<button v-if="Boolean(config.dev)" @click="replayTx()">Replay</button>
	</div>
</template>

<script>
// @ts-nocheck
import { config, charConfig } from "../config.js";
import { setClipboard, shortHash } from "../utils";

export default {
	props: ["loadedTxData", "windowKey"],
	data: function () {
		return {
			personImageUrl: false,
			status: this.$t("general.pending"),
			lineStatus: false,
			houseTitle: false,
			confirmed: false,
			txData: false,
			txFollower: false,
			txFocused: false,
			copyText: "Copy follow link",
			isRollup: false,
		};
	},
	methods: {
		shortHash(hash, chars = 3, dots = false) {
			return shortHash(hash, chars, dots);
		},
		copyLink() {
			setClipboard(this.copyLinkValue);
			this.copyText = "Copied link";
		},
		followTx() {
			if (this.txFollower) {
				this.txFollower = this.$root.$refs.following.unfollowTx(this.txData.tx);
				return false;
			}
			this.txFollower = this.$root.$refs.following.followTx(this.txData.tx);
			return true;
		},
		focusTx() {
			if (this.txFocused) {
				this.txFocused = this.$root.$refs.following.unfocusTx(this.txData.tx);
				return false;
			}
			this.txFocused = this.$root.$refs.following.switchToFocus(this.txData.tx);
			this.$root.$refs.following.checkTxWindows();
			return true;
		},
		setConfirmed(hash) {
			if (!hash) return false;
			clearInterval(this.statusInterval);
			this.statusInterval = null;
			let blockText = "..." + hash.substring(hash.length - 5);
			this.status = this.$t("general.confirmed") + " (" + this.$tc("general.block", 1) + " " + blockText + ")";
			this.lineStatus = false;
			this.personImageUrl = false;
			this.confirmed = true;
		},
		setDeleted(bool) {
			if (!bool) return false;
			clearInterval(this.statusInterval);
			this.statusInterval = null;
			this.status = this.$t("general.not-found");
			this.lineStatus = false;
			this.personImageUrl = false;
		},
		checkBlocks(street) {
			let block = street.txInBlock(this.txData.tx);
			if (block) {
				this.setConfirmed(block.hash);
			} else {
				this.status = this.$t("general.pending-unknown");
			}
		},
		checkStatus() {
			if (this.confirmed) return false;
			let street = this.$root.getStreet();
			if (!street) return false;
			let lineData = street.lineManager[this.txData.tx];
			if (typeof lineData === "undefined") {
				//not in line data, maybe confirmed
				if (typeof this.txData.bh !== "undefined" && this.txData.bh) {
					this.setConfirmed(this.txData.bh);
				} else {
					this.checkBlocks(street);
				}
				this.lineStatus = false;
				this.personImageUrl = false;
				return false;
			}
			this.status = this.txData.dependingOn
				? "<span class='tag is-warning far fa-hand-paper'></span> " + this.$t("messages.waiting-nonce")
				: this.$t("general.pending");
			this.switchStatus(lineData.status);

			this.personImageUrl = this.spriteUrl;
		},
		switchStatus(status) {
			if (!status) {
				this.lineStatus = false;
				return;
			}
			this.lineStatus = this.$t("status." + status);
		},
		getHouseTitle() {
			if (typeof this.txData.h === "undefined") return false;
			let street = this.$root.getStreet();
			let plans = street.housePlans;
			this.houseTitle = plans[this.txData.h].title;
			return this.houseTitle;
		},
		checkLineManager() {
			let street = this.$root.getStreet();
			if (!street) return false;
			if (typeof street.lineManager[this.txData.tx] === "undefined") return false;
			this.txData = street.lineManager[this.txData.tx].txData;
			return true;
		},
		checkTxFollower() {
			let street = this.$root.getStreet();
			if (!street) return false;
			for (const hash in street.txFollowers) {
				if (hash === this.txData.tx) {
					this.txFollower = true;
					if (this.$root.$refs.following.focusedTx === hash) {
						// if(street.txFollowers[hash].focused){
						this.txFocused = true;
					} else {
						this.txFocused = false;
					}
					return true;
				}
			}
			this.txFocused = false;
			this.txFollower = false;
			return false;
		},
		replayTx() {
			let street = this.$root.getStreet();
			street.replayTx(this.txData);
		},
	},
	computed: {
		pixelArt() {
			let spriteNo = this.txData.spriteNo;
			if (typeof spriteNo !== "object") return false;
			return charConfig[spriteNo.sheet]?.pixelArt || false;
		},
		spriteUrl() {
			let spriteNo = this.txData.spriteNo;
			if (this.txData.char) spriteNo = this.txData.char;

			if (typeof spriteNo === "object") {
				return process.env.VUE_APP_STORAGE_URL + spriteNo.sheet + "/" + spriteNo.texture;
			} else {
				let sprite =
					typeof spriteNo === "string" ? "characters/" + spriteNo + "-0" : "ppl/person-" + spriteNo * 9;
				return (
					config.baseUrl +
					"static/img/singles" +
					(config.theme.key !== "default" && typeof spriteNo === "number" ? "_" + config.theme.key : "") +
					"/" +
					sprite +
					".png?v=" +
					process.env.VUE_APP_VERSION
				);
			}
		},
		openSeaUrl() {
			if (!this.txData?.nftChar?.collectionSlug || !this.txData?.nftChar?.tokenId) return;
			return (
				"https://opensea.io/assets/" +
				charConfig[this.txData.nftChar.collectionSlug].contract +
				"/" +
				this.txData.nftChar.tokenId
			);
		},
		copyLinkValue() {
			return (
				window.location.origin +
				"/v/" +
				this.$root.coinConfig.ticker +
				"?" +
				this.$root.coinConfig.ticker +
				"follow=" +
				this.txData.tx
			);
		},
		config() {
			return config;
		},
		format() {
			let street = this.$root.getStreet();
			if (!street) return false;
			return street.vueTxFormat;
		},
		followerHashes() {
			return this.$root.txFollowersHashes;
		},
	},
	watch: {
		followerHashes: function () {
			this.checkTxFollower();
		},
		"txData.bh": function (val) {
			this.setConfirmed(val);
		},
		"txData.deleted": function (val) {
			if (!this.txData.bh) this.setDeleted(val);
		},
	},
	mounted: function () {
		let street = this.$root.getStreet();
		this.isRollup = street.config.isRollup;
		this.txData = this.loadedTxData;
		let loadedInLine = this.checkLineManager();
		this.getHouseTitle();
		this.checkStatus();
		this.statusInterval = setInterval(() => {
			this.checkStatus();
		}, 3000);
		if (!loadedInLine && !this.txData.bh && !this.confirmed && !this.txData.deleted) {
			//load into memory
			let street = this.$root.getStreet();
			street.newTx(this.txData, "waiting", true, false);
		}
		this.checkTxFollower();
	},
	beforeDestroy: function () {
		clearInterval(this.statusInterval);
		this.statusInterval = null;
		this.$root.removeWindowData(this.windowKey);
	},
};
</script>