// @ts-nocheck
import Vue from "vue";
import i18n from "./i18n";
import "./assets/scss/main.scss";
import Main from "./components/vue/Main.vue";
import Toast, { TYPE } from "vue-toastification";
import Close from "./components/vue/toasts/Close";

String.prototype.hashCode = function () {
	var hash = 0,
		i,
		chr;
	if (this.length === 0) return hash;
	for (i = 0; i < this.length; i++) {
		chr = this.charCodeAt(i);
		hash = (hash << 5) - hash + chr;
		hash |= 0; // Convert to 32bit integer
	}
	return hash;
};

Vue.use(Toast, {
	filterBeforeCreate: (toast, toasts) => {
		if (toast.id && toasts.filter(t => t.id === toast.id).length !== 0) {
			// Returning false discards the toast
			return false;
		}
		// You can modify the toast if you want
		return toast;
	},
	icon: false,
	closeButton: Close,
	toastDefaults: {
		[TYPE.WARNING]: {
			icon: {
				iconClass: "fas fa-exclamation-triangle", // Optional
				// iconChildren: "warning", // Optional
				iconTag: "span", // Optional
			},
		},
		[TYPE.ERROR]: {
			icon: {
				iconClass: "fas fa-exclamation-circle", // Optional
				// iconChildren: "error", // Optional
				iconTag: "span", // Optional
			},
		},
		[TYPE.SUCCESS]: {
			icon: {
				iconClass: "fas fa-check", // Optional
				// iconChildren: "check_circle", // Optional
				iconTag: "span", // Optional
			},
		},
	},
});
window.mainVue = new Vue({
	i18n,
	el: "#vue-main",
	...Main,
});

