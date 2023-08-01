import { config } from  "./config.js";

export const scrollAll = (amount, game) => {
	game.scene.scenes.forEach(function(scene) {
		if (typeof scene.scrollY === "function") {
			scene.scrollY(amount);
		}
	});
};

export const resizeAll = game => {
	let vueSideHeight = 0;
	let vueSide = document.getElementsByClassName("side");
	for (let i = 0; i < vueSide.length; i++) {
		const side = vueSide[i];
		if(side.clientHeight > vueSideHeight) vueSideHeight = side.clientHeight;
	}
	let vueHeight = vueSideHeight;

	let windows = document.getElementsByClassName("window-modal");
	Array.prototype.forEach.call(windows, node => {
		let vue = node.__vue__;
		if (typeof vue !== "undefined") {
			vue.moveInFrame();
		}
	});

	let canvas = window.txStreetPhaser.canvas;
	if (config.vPadding != vueHeight) {
		config.vPadding = vueHeight;
		canvas.style.position = "fixed";
		canvas.style.left = "0px";
		canvas.style.top = config.vPadding + "px";
	}
	canvas.style.height = window.innerHeight - config.vPadding + "px";
	canvas.style.width = window.innerWidth + "px";

	game.scene.scenes.forEach(function(scene) {
		if(!game.scene.isSleeping(scene)) scene.resize();
	});
};

export function createListeners(game) {
	window.addEventListener("resize", () => {
		resizeAll(game);
	});

	setTimeout(() => {
		resizeAll(game);
	}, 10);

	document.addEventListener(
		"wheel",
		function(e) {
			let target = e.target;
			if (target.nodeName.toLowerCase() !== "canvas") return false;
			var variation = parseInt(e.deltaY);

			scrollAll(variation, game);

			return false;
		},
		true
	);

	var keyScrollInterval = null;
	var keyScrollIntervalSpeed = 0;
	document.onkeydown = function(e) {
		switch (e.keyCode) {
			case 37: //left
				break;
			case 38: //up
			case 33: //page up
				setKeyScrollInterval("up");
				break;
			case 39: //right
				break;
			case 40: //down
			case 34: //page down
				setKeyScrollInterval("down");
				break;
		}
	};

	document.onkeyup = function(e) {
		switch (e.keyCode) {
			case 38: //up
			case 40: //down
			case 33:
			case 34:
				clearInterval(keyScrollInterval);
				keyScrollInterval = null;
				keyScrollIntervalSpeed = 0;
				break;
		}
	};

	function setKeyScrollInterval(direction) {
		if (keyScrollIntervalSpeed > 15 || keyScrollIntervalSpeed < -15) return false;
		clearInterval(keyScrollInterval);
		if (direction == "down") {
			keyScrollIntervalSpeed++;
		} else {
			keyScrollIntervalSpeed--;
		}
		keyScrollInterval = setInterval(() => {
			scrollAll(keyScrollIntervalSpeed, game);
		}, 5);
	}

	var scrollTimeouts = [];
	function scrollTimeout(i, scrollDir, difference) {
		scrollTimeouts.push(
			setTimeout(function() {
				scrollAll(i * scrollDir, game);
			}, (difference - i) * 8)
		);
	}

	var touchPosY = null;
	var touchPosYDifference = null;
	document.addEventListener("touchend", function() {
		let scrollDir = touchPosYDifference > 0 ? 1 : -1;
		let absDifference = Math.floor(Math.abs(touchPosYDifference));
		if (absDifference > 75) absDifference = 75;
		for (var i = absDifference - 1; i >= 0; i--) {
			scrollTimeout(i, scrollDir, absDifference);
		}
		touchPosY = null;
		touchPosYDifference = null;
	});

	document.addEventListener("touchstart", function(e) {
		let target = e.target;
		if (target.nodeName.toLowerCase() !== "canvas") return false;
		for (var i = 0; i < scrollTimeouts.length; i++) {
			clearTimeout(scrollTimeouts[i]);
		}
		scrollTimeouts = [];
	});

	document.addEventListener("touchmove", function(e) {
		let target = e.target;
		if (target.nodeName.toLowerCase() !== "canvas") return false;
		for (var i = 0; i < e.changedTouches.length; i++) {
			let newTouchPosY = e.changedTouches[i].pageY;
			touchPosYDifference = touchPosY - newTouchPosY;
			if (touchPosY != null) {
				scrollAll(touchPosYDifference, game);
			}
			touchPosY = newTouchPosY;
		}
	});
}
