<template>
	<article v-if="html" class="message is-info" style="margin-bottom: 15px">
		<div v-if="title" @click="visible = !visible" class="message-header" style="cursor: pointer">
			<p>
				{{ title }}
				<a v-if="source" @click="visible = !visible" :href="source" target="_blank" style="font-weight: normal"
					>Source</a
				>
			</p>
			<span class="fas" :class="visible ? 'fa-chevron-down' : 'fa-chevron-up'"></span>
		</div>
		<div :class="{ collapsed: !visible }" class="message-body content" v-html="html"></div>
		<button v-if="!visible" @click="visible = !visible" class="button show-button is-info">Show Text</button>
	</article>
	<div v-else class="loader is-loading" style="width: 50px; height: 50px; margin: 10px auto"></div>
</template>

<script>
// @ts-nocheck
export default {
	props: {
		path: {},
		initVisible: {
			default: true,
		},
	},
	data: function () {
		return {
			html: false,
			title: false,
			obj: false,
			visible: false,
			source: false,
		};
	},
	mounted() {
		this.visible = Boolean(this.initVisible);
		//TODO check if already loaded
		this.loadUrl();
	},
	methods: {
		loadUrl() {
			fetch(this.url, {
				headers: {
					"Content-Type": "application/json",
				},
			})
				.then((response) => response.text())
				.then((html) => {
					this.obj = JSON.parse(html);
					this.html = this.obj.html || "";
					this.title = this.obj.title || "";
					this.source = this.obj.source || "";
					if (this.$parent && this.$parent.windowData) {
						this.$parent.adjustHeight();
					}
				})
				.catch((error) => {
					console.warn(error);
				});
		},
	},
	computed: {
		url: function () {
			return `${process.env.VUE_APP_STORAGE_URL}info/wiki/${this.path}.json`;
		},
	},
	watch: {
		url: function () {
			this.loadUrl();
		},
	},
};
</script>
<style lang="scss" scoped>
.message {
	position: relative;
}
.collapsed {
	max-height: 85px;
	overflow: hidden;
	mask: linear-gradient(#fff, transparent);
}
.show-button {
	position: absolute;
	bottom: -10px;
	left: 50%;
	transform: translateX(-50%);
}
</style>