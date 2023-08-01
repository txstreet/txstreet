<template>
  <div class="container">
        <GasPrices style="height:615px;"  />
        <div class="is-centered section buttons">
            <a href="https://chrome.google.com/webstore/detail/txstreet-eth-gas-prices/ibmcbgbkeofegdhoeijhfhofjkmdoima/" target="_blank" class="button is-link is-large"><i class="fab fa-chrome"></i>&nbsp;Download Chrome Extension</a>
        </div>
        <div class="vue-grid-item base-fee-chart">
            <StatChart  v-bind="{ statConfig: [{ticker: 'ETH', key: 'baseFee', duration: '2d', interval: '5m' }], options: {title: 'Base Fee'} }"/>
        </div>
        <div style="font-size:1rem;" class="notification is-info">TxStreet simulates the next 3 blocks in real time, using pending transactions. These simulations allow for the most accurate gas price predictions. Depending on the fluctuating base fee, the second and third block may have higher fees than the first. It's recommended to use the large green values, however if there is a gas war and you need an instant confirmation, you might consider overpaying.</div>
  </div>
</template>


<script>
import GasPrices from  "../templates/GasPrices.vue"
import StatChart from  "../templates/StatChart.vue"

export default {
    components: {
        GasPrices,
        StatChart,
    }
}
</script>

<style lang="scss" scoped>
    .base-fee-chart{
        height: 300px;
    }
</style>