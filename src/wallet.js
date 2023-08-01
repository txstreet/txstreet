import Web3 from "web3";
import Web3Modal from "web3modal";
import WalletConnectProvider from "@walletconnect/web3-provider";
import Authereum from "authereum";
import Vue from "vue";
import eventHub from "./components/vue/eventHub";

const state = Vue.observable({
    connected: false,
    address: null,
    chainId: 1,
    networkId: null,
});
export default state;

export let web3;
export let provider;

const providerOptions = {
    walletconnect: {
        package: WalletConnectProvider, // required
        options: {
            infuraId: process.env.VUE_APP_INFURA // required
        }
    },
    authereum: {
        package: Authereum
    },
};
export const web3Modal = new Web3Modal({
    network: "mainnet", // optional
    cacheProvider: true, // optional
    providerOptions, // required
});

export const init = async () => {
    if(state.connected && state.address) return;
    provider = await web3Modal.connect();
    await web3Modal.toggleModal();
    web3 = new Web3(provider);
    const accounts = await web3.eth.getAccounts();
    const address = accounts[0];
    const networkId = await web3.eth.net.getId();
    state.connected = true;
    state.address = address;
    state.networkId = networkId;

    eventHub.$emit("ETH-follow", accounts[0]);
    await subscribeProvider(provider);
}

export const disconnect = async () => {
    await web3Modal.clearCachedProvider();
    state.connected = false;
    state.address = null;
}

const subscribeProvider = async (provider) => {
    if (!provider.on) {
        return;
    }
    provider.on("accountsChanged", async (accounts) => {
        state.address = accounts[0];
        eventHub.$emit("ETH-follow", accounts[0]);
    });
    provider.on("chainChanged", async (chainId) => {
        const networkId = await web3.eth.net.getId();
        state.networkId = networkId;
        state.chainId = chainId;
    });
    provider.on("networkChanged", async (networkId) => {
        const chainId = await web3.eth.chainId();
        state.chainId = chainId;
        state.networkId = networkId;
    });
};