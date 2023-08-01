import { enabledConfig } from "../../../config";
import { joinRoom, ethNewTxSetDepending } from "../../../utils/";
import eventHub from "../../eventHub";

const listeners = {};

const instances = [];

export const removeStaleListeners = () => {
    const stale = {};
    for (const listenerKey in listeners) {
        const listener = listeners[listenerKey];
        let needed = false;
        for (let i = 0; i < instances.length; i++) {
            const instance = instances[i];
            if (instance.listener === listener) needed = true;
        }
        if (!needed) stale[listenerKey] = listener;
    }
    for (const listenerKey in stale) {
        const listener = stale[listenerKey];
        listener.socket.off(listener.eventName, listener.listener);
        delete listeners[listenerKey];
    }
}

export const getNeededRooms = () => {
    const needed = [];
    for (let i = 0; i < instances.length; i++) {
        const instance = instances[i];
        needed.push(instance.ticker + "-transactions");
    }
    return needed;
}

class Transactions {
    constructor(ticker) {
        this.ticker = ticker;
        this.connectSocket();
    }

    connectSocket() {
        let coinConfig = enabledConfig[this.ticker];
        let socket = joinRoom(coinConfig, "transactions");
        let listenerKey = "transactions-" + coinConfig.ticker;

        if (!listeners[listenerKey]) {
            this.listener = (listeners[listenerKey] = {
                socket: socket,
                eventName: "tx",
                listener: data => {
                    if (data.chain === "ETH") ethNewTxSetDepending(data, coinConfig);
                    coinConfig.liveTxs.push(data);
                    eventHub.$emit("addTx-" + coinConfig.ticker, data);
                    if (coinConfig.liveTxs.length > 10000) {
                        coinConfig.liveTxs.splice(0, 1000);
                    }
                },
            });
            socket.on(this.listener.eventName, this.listener.listener);
        }
        else {
            this.listener = listeners[listenerKey];
        }
    }

    stop() {
        instances.splice(instances.indexOf(this), 1);
        removeStaleListeners();
    }
}

export const newTransactions = (ticker) => {
    const transactions = new Transactions(ticker);
    instances.push(transactions);
    return transactions;
}