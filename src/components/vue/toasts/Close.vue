<template>
    <button @click="close()" aria-label="close" class="Vue-Toastification__close-button"></button>
</template>
<script>
export default {
    methods: {
        close(){
            this.$parent.$parent.closeToast();
        }
    }
}
</script>