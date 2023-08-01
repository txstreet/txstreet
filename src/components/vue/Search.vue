<template>
        <div class="search-nav navbar-item field has-addons">
            <p class="control has-icons-right" :class="[icon === 'loading' ? 'is-loading' : '']">
                <input ref="searchInput" @keydown="icon='search'" @paste="search" @keydown.enter.prevent="search" v-model="query" class="input" type="text" :placeholder="`Search ${$tc('general.tx', 1)}, ${$tc('general.address', 1)}, ${$tc('general.block', 1)}`">
                <span v-if="icon!='loading'" class="icon is-small is-right"><i class="fas" :class="'fa-' + icon"></i></span>
            </p>
        </div>
</template>

<script>
// @ts-nocheck 
export default {
    data: function (){
        return {
            query: "",
            icon: "search"
        }
    },
    methods: {
        search: function(){
            this.icon = "loading";
            setTimeout(() => {
                this.query = this.query.trim();
                const type = this.getType(this.query);
                if (type === "tx") {
                    this.searchTransaction(this.query);
                } else if (type === "address"){
                    this.searchAddress(this.query);
                } else if (type === "block") {
                    this.searchBlock(this.query);
                } else {
                    //nothing to search
                    this.icon = "exclamation-circle"
                }
            }, 1);
        },
        searchTransaction(query, icon=true){
            //search local line
            if(this.lineManager[query]){
                this.$root.txWindow(this.lineManager[query].txData);
                if(icon) this.icon = "check";
                return true;
            }

            const result = this.street.apiTransaction(query);
            return result.then(res => {
                if(res && res.tx){
                    this.$root.txWindow(res);
                    if(icon) this.icon = "check";
                    return true;
                }
                else{
                    if(icon) this.icon = "exclamation-circle"
                    return false;
                }
            });
        },
        searchAddress: function(query){
            this.$root.addressWindow(query);
            this.icon = "check";
        },
        searchBlock: function(query){
            for (let i = 0; i < this.street.blockchain.length; i++) {
                const block = this.street.blockchain[i];
                if(block.height==query){
                    this.$root.blockWindow(block.height);
                    this.icon = "check";
                    return true;
                }
            }
            for (let i = 0; i < this.street.buses.children.entries.length; i++) {
                const bus = this.street.buses.children.entries[i];
                const height = bus.getData('id');
                if(height==query){
                    this.$root.blockWindow(height);
                    this.icon = "check";
                    return true;
                }
            }

            const result = this.street.apiBlock(query);
            return result.then(res => {
                if(res){
                    //set the blockhash so api loaded block txs are confirmed
                    this.$root.blockWindow(res);
                    this.icon = "check";
                    return true;
                }
                else{
                    this.icon = "exclamation-circle"
                    return false;
                }
            });
        },
        getType: function(query){
            if(parseInt(query,10).toString()==query) return "block";
            const length = query.length;
            for (const key in this.street.stringLengths) {
                const lengths = this.street.stringLengths[key];
                if(lengths.includes(length)) return key;
            }
            return false;
        }
    },
    mounted(){
        this.street = this.$root.getStreet();
        this.lineManager = this.street.lineManager;
        this.$nextTick(() => this.$refs.searchInput.focus());
    }
}
</script>
<style lang="scss" scoped>
.control.has-icons-right .input, .control.has-icons-right .select select{
    padding-right: 0;
}
</style>