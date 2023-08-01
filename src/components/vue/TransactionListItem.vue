<template>
	<div class="tx-display">
		<span class="tx-tags">
			<span v-if="source.h" :class="$root.darkMode ? 'is-black' : 'is-info'" class="tag">
				<img
					:src="config.baseUrl + 'static/img/singles/house_logos/' + source.h + '.png?v=' + $root.appVersion"
				/>
			</span>
		</span>
		<a class="tx-link" :data-tx="source.tx" v-html="txDisplay(source)"></a>
		<span class="tx-tags right">
			<span v-if="source.bh" class="tag is-success fas fa-check"></span>
			<span v-if="source.e && source.e.op_return" :class="$root.darkMode ? 'is-black' : 'is-info'" class="tag"
				>OP_R</span
			>
			<span v-if="source.e && source.e.sw" :class="$root.darkMode ? 'is-black' : 'is-info'" class="tag">
				<img class="white" :src="config.baseUrl + 'static/img/singles/segwit_outline.png'" />
			</span>
			<span
				v-if="source.e && (source.e.mweb || source.e.mwebpegin || source.e.mwebpegout || source.e.mwebhogex)"
				:class="$root.darkMode ? 'is-black' : 'is-info'"
				class="tag"
			>
				<img class="white" :src="config.baseUrl + 'static/img/singles/mweb.png'" />
			</span>
			<span
				v-if="!source.bh && source.dependingOn"
				:class="$root.darkMode ? 'is-black' : 'is-warning'"
				class="tag far fa-hand-paper"
			></span>
			<span
				v-if="source.ty && source.ty === 2"
				:class="$root.darkMode ? 'is-black' : 'is-success is-light'"
				class="tag far fa-lightbulb"
			></span>
		</span>
	</div>
</template>

<script>
// @ts-nocheck
import { config } from "../config.js";
import { shortHash } from "../utils";

export default {
	name: "transaction-list-item",
	props: {
		index: {
			// index of current item
			type: Number,
		},
		source: {
			type: Object,
			default() {
				return {};
			},
		},
	},
	computed: {
		config: function () {
			return config;
		},
		txDisplay: function () {
			return (tx) => {
				if (this.house == "all" || typeof tx.e === "undefined" || typeof tx?.e?.houseContent === "undefined")
					return "<a>" + shortHash(tx.tx, 10, true) + "</a>";
				let html = "";
				html +=
					typeof tx?.e?.houseTween !== "undefined"
						? `<span class='tween-icon'><img src='${config.baseUrl}static/img/singles/tween_icons/${tx.e.houseTween}.png?v=${this.$root.appVersion}' /></span>`
						: "";
				html += '<a class="tx-text">' + tx?.e?.houseContent + "</a>";
				return html;
			};
		},
	},
};
</script>