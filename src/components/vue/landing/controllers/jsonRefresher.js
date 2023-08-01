import Vue from "vue";
const intervals = {};

const values = {};

//array of all stat classes
const instances = [];


setInterval(() => {
    const needed = [];
    for (let i = 0; i < instances.length; i++) {
        needed.push(instances[i].url);
    }
    for (const url in intervals) {
        if (!needed.includes(url)) {
            clearInterval(intervals[url]);
            delete intervals[url];
        }
    }
}, 11000);

export const getNeededRooms = () => {
    return [];
}

export class JsonRefresher {
    constructor(url, interval) {
        this.url = url;
        this.interval = interval;
        this.setPaths();
        this.value = values[this.url];
        if (!intervals[this.url]) {
            this.fetchJson();
            intervals[this.url] = setInterval(async () => {
                this.fetchJson();
            }, this.interval)
        }
    }

    async fetchJson() {
        try {
            let response = await fetch(this.url);
            let json = await response.json();
            let result = json || [];
            Vue.set(values, this.url, result);
            this.value = values[this.url];
            return result;
        } catch (err) {
            console.log(err);
            return false;
        }
    }

    stop() {
        instances.splice(instances.indexOf(this), 1);
    }

    setPaths() {
        if (!values[this.url]) Vue.set(values, this.url, Vue.observable(""));
    }
}

export const newJsonRefresher = (url, interval = 5000) => {
    const jsonRefresher = new JsonRefresher(url, interval);
    instances.push(jsonRefresher);
    return jsonRefresher;
}