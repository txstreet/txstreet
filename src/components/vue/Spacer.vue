<template>
    <div class="vue-spacer" :style="'height:' + size"></div>
</template>

<script>
// @ts-nocheck
export default {
	props: {
		size: {
			default: "1rem",
		},
	},
};
</script>
<style lang="scss" scoped>
.vue-spacer {
	width:100%;
    height: 1rem;
}
</style>