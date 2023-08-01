<!-- use this component for third party houses that are untrusted -->
<template>
	<div>
		<div v-if="!loaded" class="loaded-html">
			<div class="loader is-loading" style="width:50px;height:50px;margin:10px auto;"></div>
		</div>
		<iframe v-show="loaded"></iframe>
	</div>
</template>
<script>
// @ts-nocheck 
export default {
	props: ["url", "params"],
	data: function () {
		return {
			loaded: false,
			html: false,
		};
	},
	mounted() {
		fetch(this.url)
			.then((response) => response.text())
			.then((html) => {
				this.loaded = true;
				this.html = html;
			})
			.then(() => {
                let ifr = this.$el.querySelector("iframe");
                let addedHtml = `<div id="params" data-params="${this.params}"></div>`;
                let finalHtml = addedHtml + this.html;

                ifr.srcdoc = finalHtml;
			})
			.catch((error) => {
				console.warn(error);
			});
	},
};
</script>