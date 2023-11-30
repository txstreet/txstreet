import { config, moonheadNames, additionalSheets, enabledConfig } from "../config.js";
import { fds, default as i18n } from "../../i18n";
import { add } from "date-fns";
import io from "socket.io-client";

export const getSheetKey = frame => {
	const theme = config.theme;
	if(theme.frames.includes(frame)) return theme.key;
	if(frame.includes("person-")) return "characters";
	for (let i = 0; i < moonheadNames.length; i++) {
		const name = moonheadNames[i];
		if(frame.includes(name)) return "characters";
	}
	for (const key in additionalSheets) {
		const sheetConfig = additionalSheets[key];
		if(sheetConfig.frames.includes(frame)) return sheetConfig.key;
	}
	return "sheet";
}

export const setClipboard = value => {
	var tempInput = document.createElement("input");
	tempInput.style = "position: absolute; left: -1000px; top: -1000px";
	tempInput.value = value;
	document.body.appendChild(tempInput);
	tempInput.select();
	document.execCommand("copy");
	document.body.removeChild(tempInput);
};

async function loadBlockCloudFlare(ticker, hash) {
	if (ticker !== "ETH") return false;
	const url = "https://cloudflare-eth.com/"
	const response = await fetch(url, {
		method: "POST",
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ id: 1, jsonrpc: "2.0", method: "eth_getBlockByHash", params: [hash, true] })
	});
	const text = await response.text();
	try {
		const json = JSON.parse(text);
		if (!json.result || !json.result.difficulty) return false;
		const block = formatCloudFlareBlock(json.result);
		return block;
	} catch (err) {
		console.log(err);
		return false;
	}
}

function formatCloudFlareBlock(data) {
	const block = {
		coin: "ETH",
		tx: [],
		txFull: {},
		txs: data?.transactions?.length || 0,
		hash: data.hash,
		parentHash: data.parentHash,
		size: parseInt(data.size),
		gu: parseInt(data.gasUsed),
		height: parseInt(data.number),
		time: parseInt(data.timestamp),
		baseFee: parseInt(data.baseFeePerGas),
		gl: parseInt(data.gasLimit)
	};
	for (let i = 0; i < data.transactions.length; i++) {
		const tx = data.transactions[i];
		block.tx.push(tx.hash);
		block.txFull[tx.hash] = {
			tx: tx.hash,
			to: tx.to,
			fr: tx.from,
			g: parseInt(tx.gas),
			gp: parseInt(tx.gasPrice),
			n: parseInt(tx.nonce),
			an: parseInt(tx.nonce),
			t: parseInt(tx.value),
			bh: tx.blockHash,
			ty: parseInt(tx.type),
		}
		if (tx.maxFeePerGas) {
			block.txFull[tx.hash].mfpg = parseInt(tx.maxFeePerGas);
		}
		if (tx.maxPriorityFeePerGas) {
			block.txFull[tx.hash].mpfpg = parseInt(tx.maxPriorityFeePerGas);
		}
	}
	return block;
}

export const loadBlock = async (ticker, hash, retries = 0) => {
	if(enabledConfig[ticker].socketBlocks){
		let socket = getSocket(ticker);
		const promise = new Promise((resolve) => {
			socket.socket.once("fetch-block", async (hash, error, block) => {
				console.log(hash, error, block);
				if(error) resolve(false);
				resolve(block);
			});
			setTimeout(() => {
				resolve(false);
			}, 5000)
		});
		socket.socket.emit("fetch-block", ticker, hash);
		return promise;
	}

	if (retries > 1) return false;
	if (retries) return loadBlockCloudFlare(ticker, hash);

	let fileUrl = `${(process.env?.["VUE_APP_REST_API_" + ticker] || process.env.VUE_APP_REST_API)}/static/blocks/${ticker}/${hash}`;

	try {
		const response = await fetch(fileUrl);
		if (!response.ok) throw "bad block response: " + response;
		const text = await response.text();
		const json = JSON.parse(text);
		return json;
	} catch (err) {
		console.log(err);
		retries++;
		return loadBlock(ticker, hash, retries);
	}
};

export const ethNewTxSetDepending = (tx, config) => {
	//set the address nonce
	const addressNonces = config.addressNonces;
	if (!addressNonces) return;
	let currentAn = addressNonces[tx.fr];
	if (!currentAn || tx.an >= currentAn) addressNonces[tx.fr] = tx.an;
	if (addressNonces[tx.fr] !== tx.n) tx.dependingOn = true;
};

export const getHouseArray = async config => {
	if (config.houseArray.length) return config.houseArray;
	try {
		const result = await fetch(`${(process.env?.["VUE_APP_REST_API_" + config.ticker] || process.env.VUE_APP_REST_API)}/static/live/houses-${config.ticker}`);
		let houses = await result.json();
		if (houses) {
			houses = houses.filter(function (obj) {
				return obj.name !== 'donation';
			});
			houses = houses.sort((a, b) => b.priority - a.priority);

			config.houseArray = houses;
			return houses;
		}
	} catch (e) {
		console.error(e);
	}
};

export const calcStatValue = (stat, customValue = false) => {
	if (!stat) return customValue;
	let value = customValue || stat.value || stat.default;
	if (typeof stat.format === "function") return stat.format(value);
	let after = stat.after;
	if (!value && value !== 0) return "Loading...";
	if (!isNaN(value) && Boolean(stat.limit) && value > stat.limit) {
		value = stat.limit;
		after = "+";
	}
	if (typeof stat.divide !== "undefined") value /= stat.divide;
	if (typeof stat.decimals !== "undefined")
		value = value.toLocaleString(i18n.locale, {
			maximumFractionDigits: stat.decimals,
			minimumFractionDigits: stat.decimals,
		});
	if (typeof stat.timeAgo !== "undefined")
		value = fds(new Date(), add(new Date(), { seconds: value }), {
			roundingMethod: "floor",
		});
	value =
		(typeof stat.before !== "undefined" ? stat.before : "") + value + (typeof after !== "undefined" ? after : "");
	return value;
};

export const toRes = value => {
	return value * config.resolution;
};

export const toResRev = (value = 1) => {
	return value / config.resolution;
};

export const mirrorX = (value, side) => {
	if (side === "right") return toRes(960 - value);
	return toRes(value);
};

export function applySocketsNeededRooms() {
	//calculates an array of needed rooms for each socket based on neededRoomsDiv, neededRoomsDiv can contain
	//needed rooms seperated by app type (dashboard, visualizer etc)
	if (!window.txStreetSockets) return;
	for (const ticker in window.txStreetSockets) {
		const socket = window.txStreetSockets[ticker];
		const neededRooms = [];
		for (const type in socket.neededRoomsDiv) {
			const neededDivArr = socket.neededRoomsDiv[type];
			for (let i = 0; i < neededDivArr.length; i++) {
				const needed = neededDivArr[i];
				if (neededRooms.indexOf(needed) === -1) neededRooms.push(needed);
			}
		}
		socket.neededRooms = neededRooms;
	}
}

export function leaveStaleRooms() {
	if (!window.txStreetSockets) return;
	for (const ticker in window.txStreetSockets) {
		const socket = window.txStreetSockets[ticker];
		const neededRooms = socket.neededRooms;
		const activeRooms = socket.rooms;
		for (let i = 0; i < activeRooms.length; i++) {
			const activeRoom = activeRooms[i];
			if (neededRooms.includes(activeRoom)) continue;
			//active room not found in needed rooms, can leave room
			leaveRoom(ticker, activeRoom);
		}
	}
}

export function resetNeededRooms(type, arr) {
	for (const ticker in window.txStreetSockets) {
		const socket = window.txStreetSockets[ticker];
		socket.neededRoomsDiv[type] = [];
	}
	for (let i = 0; i < arr.length; i++) {
		const needed = arr[i];
		const split = needed.split("-");
		const rTicker = split[0];
		const room = split.slice(1).join("-");
		const socket = getSocket(rTicker);
		socket.neededRoomsDiv[type] = socket.neededRoomsDiv[type] || [];
		socket.neededRoomsDiv[type].push(room);
	}
	applySocketsNeededRooms();
}

export function getSocket(coinConfigOrTicker = false) {
	const socketTicker = typeof coinConfigOrTicker === "string" ? coinConfigOrTicker : coinConfigOrTicker.ticker;
	if (!window.txStreetSockets) window.txStreetSockets = {};
	if (!window.txStreetSockets[socketTicker])
		window.txStreetSockets[socketTicker] = { rooms: [], neededRooms: [], neededRoomsDiv: {}, socket: null };
	if (window.txStreetSockets[socketTicker].socket !== null) {
		return window.txStreetSockets[socketTicker];
	}
	window.txStreetSockets[socketTicker].socket = io(process.env?.["VUE_APP_WS_SERVER_" + socketTicker] || process.env.VUE_APP_WS_SERVER, {
		upgrade: true,
		transports: ["websocket"],
		//transports: ["websocket", "polling"],
		reconnectionDelay: 5000,
		reconnectionDelayMax: 10000,
		reconnectionAttempts: 1000,
	});
	window.txStreetSockets[socketTicker].socket.on("disconnect", () => {
		window.txStreetSockets[socketTicker].socket.wasConnected = true;
	});
	window.txStreetSockets[socketTicker].socket.on("connect", () => {
		if (window.txStreetSockets[socketTicker].socket.wasConnected) {
			joinNeededRooms(socketTicker);
		}
	});
	return window.txStreetSockets[socketTicker];
}

export function leaveRoom(coinConfigOrTicker, room, force = false) {
	const socketTicker = typeof coinConfigOrTicker === "string" ? coinConfigOrTicker : coinConfigOrTicker.ticker;
	let socket = getSocket(socketTicker);
	if (socket.neededRooms.includes(room) && !force) return socket.socket;
	if (room !== "blocks") {
		//TEMP DONT ALLOW LEAVING BLOCKS
		socket.socket.emit("leave-room", socketTicker + "-" + room);
		socket.rooms = socket.rooms.filter(e => e !== room);
	}
	return socket.socket;
}

export function joinNeededRooms(coinConfigOrTicker) {
	const socketTicker = typeof coinConfigOrTicker === "string" ? coinConfigOrTicker : coinConfigOrTicker.ticker;
	let socket = getSocket(socketTicker);
	for (let i = 0; i < socket.neededRooms.length; i++) {
		const room = socket.neededRooms[i];
		joinRoom(socketTicker, room, true);
	}
}

export function joinRoom(coinConfigOrTicker, room, force = false) {
	const socketTicker = typeof coinConfigOrTicker === "string" ? coinConfigOrTicker : coinConfigOrTicker.ticker;
	let socket = getSocket(socketTicker);
	if (socket.rooms.includes(room) && !force) return socket.socket;
	socket.socket.emit("join-room", socketTicker + "-" + room);
	if (!socket.rooms.includes(room)) socket.rooms.push(room);
	return socket.socket;
}

export function joinStatRoom(coinConfigOrTicker, key, force = false) {
	const socketTicker = typeof coinConfigOrTicker === "string" ? coinConfigOrTicker : coinConfigOrTicker.ticker;
	let socket = getSocket(socketTicker);
	const room = "stat-" + key;
	if (socket.rooms.includes(room) && !force) return socket.socket;
	socket.socket.emit("fetch-stat", socketTicker, null, {
		key: key,
		history: false,
		subscribe: true,
		returnValue: true,
	});
	if (!socket.rooms.includes(room)) socket.rooms.push(room);
	return socket.socket;
}

export function shortHash(hash, chars = 3, dots = false) {
	if (!hash) return "";
	return hash.substr(0, chars) + (dots ? "..." : "") + hash.substr(hash.length - chars);
}