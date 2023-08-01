<template>
	<div :id="url" class="loaded-html" v-html="html"></div>
</template>

<script>
// @ts-nocheck
export default {
	props: ["url"],
	data: function () {
		return {
			html: false,
		};
	},
	mounted() {
		this.html = '<div class="loader is-loading" style="width:50px;height:50px;margin:10px auto;"></div>';
		//TODO check if already loaded
		fetch(this.url)
			.then((response) => response.text())
			.then((html) => {
				this.html = html;
			})
			.then(() => {
				let scripts = this.$el.getElementsByTagName("script");
				Array.prototype.forEach.call(scripts, (node) => {
					let addToScript = `
					const el = document.getElementById("${this.url}");
					const vue = el.__vue__;
					`;
					eval(addToScript + node.innerHTML);
				});
				if (this.$parent && this.$parent.windowData) {
					this.$parent.adjustHeight();
				}
			})
			.catch((error) => {
				console.warn(error);
			});
	},
};
</script>