import { enabledConfig } from "../../../config";
import { getSocket, joinStatRoom } from "../../../utils";
import Vue from "vue";

const listeners = {};

const history = Vue.observable({});

const historyLastUpdated = {};

export const removeStaleListeners = () => {
    const stale = {};
    for (const listenerKey in listeners) {
        const listener = listeners[listenerKey];
        let needed = false;
        for (let i = 0; i < instances.length; i++) {
            const instance = instances[i];
            if (instance.listener === listener || instance.historyListener === listener) needed = true;
        }
        if (!needed) stale[listenerKey] = listener;
    }
    for (const listenerKey in stale) {
        const listener = stale[listenerKey];
        listener.socket.off(listener.eventName, listener.listener);
        delete listeners[listenerKey];
    }
}

//array of all stat classes
const instances = [];

export const getNeededRooms = () => {
    const needed = [];
    for (let i = 0; i < instances.length; i++) {
        const instance = instances[i];
        needed.push(instance.statKey);
    }
    return needed;
}

setInterval(() => {
    for (let i = 0; i < instances.length; i++) {
        instances[i].purgeOldHistory();
    }
}, 60000);


//hacky reactivity fix that will not be needed when on vue 3
function setHistory(ticker, key, history) {
    for (let i = 0; i < instances.length; i++) {
        const instance = instances[i];
        if (instance.ticker === ticker && instance.key === key) {
            instance.history = history;
        }
    }
}

export class Stat {
    constructor(ticker, key) {
        this.ticker = ticker;
        this.key = key;
        this.setHistoryPath();
        this.history = Vue.observable(history[ticker][key]);
        this.statKey = ticker + "-stat-" + key;
        this.historyKey = ticker + "-stat-history-" + key;
        this.currentDurInt = null;
        // this.on = statEmitter.on;
        this.connectSocket();
    }

    stop() {
        instances.splice(instances.indexOf(this), 1);
        removeStaleListeners();
    }

    purgeOldHistory() {
        for (const ticker in history) {
            for (const key in history[ticker]) {
                history[ticker][key].splice(0, history[ticker][key].length - 2000);
            }
        }
    }

    clearHistory() {
        delete historyLastUpdated[this.historyKey];
        Vue.set(history[this.ticker], this.key, []);
        setHistory(this.ticker, this.key, []);
    }

    getHistory(duration = "1h", historyInterval = "5s") {
        let force = false;
        if (!this.currentDurInt || duration + historyInterval !== this.currentDurInt) {
            this.clearHistory();
            force = true;
        }
        this.getHistoryFromSocket(duration, historyInterval, force);
        this.currentDurInt = duration + historyInterval;
        return history?.[this.ticker]?.[this.key] || false;
    }

    getHistoryFromSocket(duration = "1h", historyInterval = "5s", force = false) {
        let coinConfig = enabledConfig[this.ticker];
        let socket = getSocket(coinConfig).socket;
        let time = Math.round(Date.now() / 1000);
        //cancel if we made a request very recently
        if (
            !force && historyLastUpdated[this.historyKey] &&
            (time - historyLastUpdated[this.historyKey] < 2)
        ) {
            return;
        }
        historyLastUpdated[this.historyKey] = time;

        setTimeout(() => {
            socket.emit("fetch-stat", this.ticker, this.historyKey, {
                key: this.key,
                history: true,
                historyDuration: duration,
                historyInterval: historyInterval,
                subscribe: false,
                returnValue: false,
            });
        }, 1);
    }

    connectSocket() {
        let coinConfig = enabledConfig[this.ticker];
        let socket = getSocket(coinConfig).socket;

        joinStatRoom(coinConfig, this.key);
        if (!listeners[this.statKey]) {
            this.listener = listeners[this.statKey] = {
                socket: socket,
                eventName: "stat-updates",
                listener: (ticker, key, value) => {
                    if (key !== this.key) return;
                    let time = Math.round(Date.now() / 1000);
                    let statHistory = history[ticker][key];
                    if (
                        !statHistory.length ||
                        (statHistory[statHistory.length - 1].time !== time &&
                            statHistory[statHistory.length - 1].value !== value)
                    ) {
                        statHistory.push({ time, value });

                        //update last updated value if it was already updated in last 15 seconds, then we know we have a running chain of accurate values
                        let now = Math.round(Date.now() / 1000);
                        if (now - Number(historyLastUpdated[ticker + "-stat-history-" + key]) < 15)
                            historyLastUpdated[ticker + "-stat-history-" + key] = now;
                    }
                    if (coinConfig.stats[key]) {
                        Vue.set(coinConfig.stats[key], "value", value);
                    }
                },
            }
            socket.on(this.listener.eventName, this.listener.listener);
        }
        else {
            this.listener = listeners[this.statKey];
        }

        if (!listeners[this.historyKey]) {
            this.historyListener = listeners[this.historyKey] = {
                socket: socket,
                eventName: "fetch-stat",
                listener: (identifier, error, response) => {
                    if (error) console.log(error);
                    if (identifier !== this.historyKey) return;
                    if (!response.history) return;

                    let oldHistory = history[this.ticker][this.key];
                    let newHistory = oldHistory.concat(response.history);

                    //remove duplicates by timestamp
                    let foundTimestamps = {};
                    for (let i = newHistory.length - 1; i >= 0; i--) {
                        let entry = newHistory[i];
                        if (foundTimestamps[entry.time]) {
                            newHistory.splice(i, 1);
                            continue;
                        }
                        foundTimestamps[entry.time] = true;
                    }
                    newHistory.sort((a, b) => a.time - b.time);

                    Vue.set(history[this.ticker], this.key, newHistory);
                    setHistory(this.ticker, this.key, newHistory);
                },
            };
            socket.on(this.historyListener.eventName, this.historyListener.listener);
        } else {
            this.historyListener = listeners[this.historyKey];
        }
    }

    updatedRecently(seconds = 5) {
        if (!this.history.length) return false;
        const lastValue = this.history[this.history.length - 1];
        const lastTime = lastValue.time;
        if ((Date.now() / 1000) - lastTime > seconds) return false;
        return true;
    }

    setHistoryPath() {
        if (!history[this.ticker]) Vue.set(history, this.ticker, Vue.observable({}));
        if (!history[this.ticker][this.key]) Vue.set(history[this.ticker], this.key, Vue.observable([]));
    }
}

export const newStat = (ticker, key) => {
    const stat = new Stat(ticker, key);
    instances.push(stat);
    return stat;
}