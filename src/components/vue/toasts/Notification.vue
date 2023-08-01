<template>
	<div class="container">
    <h2>{{title}}</h2>
	<span v-if="html" v-html="html"></span>
	</div>
</template>
<script>
export default {
    props: ["html", "title"],
};
</script>