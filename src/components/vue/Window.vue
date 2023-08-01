<template>
	<div
		@mousedown="moveToFront"
		:id="windowId"
		class="window-modal canvas-overlay"
		:style="'border-color:#' + $parent.coinConfig.color + '40'"
		:class="[
			{ 'window-hidden': !contentLoaded, shadow: windowData.hasShadow, 'window-dark': windowData.dark },
			windowData.classes,
		]"
	>
		<div v-if="background" class="modal-background"></div>
		<div class="modal-card">
			<header
				:data-move-id="windowId"
				class="modal-card-head"
				:style="'background-color:#' + $parent.coinConfig.color + '20'"
			>
				<span v-if="!windowData.static" class="fas fa-arrows-alt window-draggable"></span>
				<p class="modal-card-title">{{ $root.i18n(windowData.title) }}</p>
				<button class="delete" aria-label="close" v-on:click="close"></button>
			</header>
			<section class="modal-card-body">
				<div v-for="comp in windowData.components" :key="comp.key">
					<component
						v-if="$root.isConnected || comp.name == 'settings'"
						v-bind="comp.props"
						:is="comp.name"
					></component>
					<span v-else class="fas fa-exclamation-circle offline-icon"></span>
				</div>
			</section>
		</div>
	</div>
</template>
<script>
// @ts-nocheck
/* eslint-disable vue/no-unused-components */
import interact from "interactjs";
import Transactions from "./Transactions.vue";
import Transaction from "./Transaction.vue";
import Statistics from "./Statistics.vue";
import Blocks from "./Blocks.vue";
import Block from "./Block.vue";
import Settings from "./Settings.vue";
import EditSign from "./EditSign.vue";

import HtmlBlock from "./HtmlBlock.vue";
import LoadHtml from "./LoadHtml.vue";
import LoadWiki from "./LoadWiki.vue";
import Spacer from "./Spacer.vue";
// import Iframe from "./Iframe.vue";
import Address from "./Address.vue";
import CharacterSelect from "./CharacterSelect.vue";
import { toResRev } from "../utils/";
import { config } from "../config.js";

export default {
	components: {
		Transactions,
		Transaction,
		Statistics,
		Blocks,
		Block,
		Settings,
		EditSign,
		HtmlBlock,
		LoadHtml,
		LoadWiki,
		CharacterSelect,
		Spacer,
		Address,
	},
	props: ["windowData", "windowKey"],
	data: function () {
		return {
			background: false,
			footer: false,
			resizable: true,
			contentLoaded: false,
		};
	},
	methods: {
		close: function () {
			this.$emit("toggleWindow");
		},
		setStyles: function (styles) {
			for (let style in styles) {
				let value = styles[style];
				this.$el.style[style] = value;
			}
		},
		setPosition: function (position) {
			let height = this.$el.offsetHeight;
			let width = this.$el.offsetWidth;
			if (position == "bottom-corner") {
				this.$el.style.top = window.innerHeight - height + "px";
				if (this.$root.side == "right") {
					this.$el.style.left = window.innerWidth - width + "px";
				} else {
					this.$el.style.left = "0px";
				}
			} else if (position == "center") {
				this.$el.style.top = (window.innerHeight - config.vPadding - height) / 2 + config.vPadding + "px";
				this.$el.style.left = (window.innerWidth - width) / 2 + "px";
			} else {
				//no position set
				let ratio = window.innerHeight / window.innerWidth;
				let xDifference = 1920 / window.innerWidth;
				let yDifference = (1920 * ratio) / window.innerHeight;
				this.$el.style.left = toResRev(this.$root.game.input.mousePointer.x) / xDifference - width / 2 + "px";
				this.$el.style.top =
					toResRev(this.$root.game.input.mousePointer.y) / yDifference + config.vPadding / 2 + "px";
			}
			this.moveInFrame();
		},
		moveInFrame: function () {
			let left = this.$el.offsetLeft;
			let top = this.$el.offsetTop;

			let width = this.$el.offsetWidth;
			let height = this.$el.offsetHeight;
			if (height > window.innerHeight - config.vPadding - 20) height = window.innerHeight - config.vPadding - 20;

			if (left < 0) {
				left = 0;
			} else if (left + width > window.innerWidth) {
				left = window.innerWidth - width;
			}

			if (top < config.vPadding) {
				top = config.vPadding;
			} else if (top + height > window.innerHeight) {
				top = window.innerHeight - height;
			}

			this.$el.style.top = top + "px";
			this.$el.style.left = left + "px";
			this.$el.style.width = width + "px";
			this.$el.style.height = height + "px";
		},
		moveToFront: function () {
			if (this.$el.style.zIndex > 3) return false;
			let windowNodes = document.getElementsByClassName("window-modal");
			Array.prototype.forEach.call(windowNodes, function (node) {
				node.style.zIndex = 3;
			});
			this.$el.style.zIndex = 4;
		},
		adjustHeight: function () {
			setTimeout(() => {
				let newHeight = 80;
				for (let i = 0; i < this.$children.length; i++) {
					const child = this.$children[i];
					newHeight += child.$el.scrollHeight;
				}
				this.$el.style.height = newHeight + "px";
				this.moveInFrame();
			}, 1);
		},
	},
	computed: {
		windowId: function () {
			return this.$parent.coinConfig.ticker + "-" + this.windowKey;
		},
	},
	mounted() {
		setTimeout(() => {
			if (typeof this.windowData.styles !== "undefined") this.setStyles(this.windowData.styles);
			this.moveToFront();
			this.setPosition(typeof this.windowData.position !== "undefined" ? this.windowData.position : false);
			this.contentLoaded = true;
		}, 1);
		if (!this.windowData.static) {
			this.resizable = interact("#" + this.windowId)
				.resizable({
					edges: {
						top: true,
						left: true,
						bottom: true,
						right: true,
					},
					modifiers: [
						interact.modifiers.restrictSize({
							min: { width: 100, height: 50 },
						}),
					],
				})
				.on("resizestart", (event) => {
					event.target.style.opacity = 0.3;
				})
				.on("resizeend", (event) => {
					event.target.style.opacity = 1;
				})
				.on("resizemove", (event) => {
					let edges = event._interaction.edges;
					if (edges.left) {
						event.target.style.left = parseInt(event.target.style.left) + event.delta.x + "px";
					}
					if (edges.top) {
						event.target.style.top = parseInt(event.target.style.top) + event.delta.y + "px";
					}

					Object.assign(event.target.style, {
						width: `${event.rect.width}px`,
						height: `${event.rect.height}px`,
					});
				});

			this.draggable = interact("#" + this.windowId + " .modal-card-head").draggable({
				listeners: {
					start(event) {
						event.target.offsetParent.offsetParent.style.opacity = 0.3;
					},
					end(event) {
						event.target.offsetParent.offsetParent.style.opacity = 1;
					},
					move(event) {
						let currentTop = parseInt(event.target.offsetParent.offsetParent.style.top);
						let currentLeft = parseInt(event.target.offsetParent.offsetParent.style.left);
						let newTop = currentTop + event.delta.y;
						let newLeft = currentLeft + event.delta.x;

						if (event.delta.x > 0 && newLeft + event.rect.width >= window.innerWidth)
							newLeft =
								currentLeft + event.rect.width >= window.innerWidth
									? currentLeft
									: window.innerWidth - event.rect.width;
						if (event.delta.x < 0 && newLeft <= 0) newLeft = currentLeft <= 0 ? currentLeft : 0;
						if (
							event.delta.y > 0 &&
							newTop + event.target.offsetParent.offsetParent.clientHeight >= window.innerHeight
						)
							newTop =
								currentTop + event.target.offsetParent.offsetParent.clientHeight >= window.innerHeight
									? currentTop
									: window.innerHeight - event.target.offsetParent.offsetParent.clientHeight;
						if (event.delta.y < 0 && newTop <= config.vPadding)
							newTop = currentTop <= config.vPadding ? currentTop : config.vPadding;

						if (event.delta.y > 0 && event.page.y < config.vPadding) newTop = currentTop;
						if (event.delta.y < 0 && event.page.y > window.innerHeight) newTop = currentTop;
						if (event.delta.x < 0 && event.page.x > window.innerWidth) newLeft = currentLeft;
						if (event.delta.x > 0 && event.page.x < 0) newLeft = currentLeft;

						event.target.offsetParent.offsetParent.style.top = newTop + "px";
						event.target.offsetParent.offsetParent.style.left = newLeft + "px";
					},
				},
			});
		}
	},
	beforeDestroy() {
		if (!this.windowData.static) {
			this.resizable.unset();
			this.draggable.unset();
		}
	},
};
</script>