<template>
	<div class="moonhead-ad" :class="{'active-ad': isImage}">
		<a target="_blank" class="ad-link" :href="adLink">
			<img v-if="isImage" :src="adText" />
			<span v-else>{{ adText }}</span>
		</a>
		<div class="ad-source tag">
			<span>Your ad here with <a target="_blank" href="https://moonheads.io/ads">MoonHeads</a></span>
		</div>
	</div>
</template>
<script>
export default {
	data: function () {
		return {
			adLink: "",
			adText: "",
			isImage: false,
		};
	},
	mounted() {
		this.applyAd();
	},
	methods: {
		async applyAd() {
			for (let i = 0; i < this.$root.moonHeadAds.length; i++) {
				const ad = this.$root.moonHeadAds[i];
				if (ad.location === "txstreetHome") {
					this.adLink = ad.link;
					let isImage = await this.checkImage(ad.text);
					this.isImage = isImage;
					this.adText = ad.text;
				}
			}
		},
		async checkImage(url) {
			const res = await fetch(url);
			const buff = await res.blob();
			return buff.type.startsWith("image/");
		},
	},
	watch: {
		"$root.moonHeadAds"() {
			this.applyAd();
		},
	},
};
</script>
<style lang="scss" scoped>
.moonhead-ad {
    &.active-ad{
        .ad-source{
            border-bottom-left-radius: 0;
            border-bottom-right-radius: 0;
        }
    }

	display: flex;
	justify-content: center;
	align-items: center;
	position: relative;
    .ad-link{
        max-height: 90px;
        display: contents;
        height: auto;
        img {
		max-height: 90px;
		max-width: 728px;
		width: 100%;
	}
    }
	.ad-source {
		font-size: 0.75rem;
		position: absolute;
        bottom: 100%;
	}
}
</style>