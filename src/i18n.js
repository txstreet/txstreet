import Vue from "vue";
import VueI18n from "vue-i18n";
import supportedLocales from "./locales";
export { supportedLocales };
import { formatDistanceStrict } from 'date-fns'

Vue.use(VueI18n);

function loadLocaleMessages() {
	const messages = {};
	for (const key in supportedLocales) {
		messages[key] = supportedLocales[key].messages;
	}
	return messages;
}

export function getBrowserLocale(options = {}) {
	const defaultOptions = { countryCodeOnly: false };
	const opt = { ...defaultOptions, ...options };
	const navigatorLocale = navigator.languages !== undefined ? navigator.languages[0] : navigator.language;
	if (!navigatorLocale) {
		return undefined;
	}
	const trimmedLocale = opt.countryCodeOnly ? navigatorLocale.trim().split(/-|_/)[0] : navigatorLocale.trim();
	return trimmedLocale;
}

export function getStartingLocale() {
	const browserLocale = getBrowserLocale({ countryCodeOnly: true });
	if (Object.keys(supportedLocales).includes(browserLocale)) {
		return browserLocale;
	} else {
		return process.env.VUE_APP_I18N_LOCALE || "en";
	}
}

const instance = new VueI18n({
	locale: getStartingLocale(),
	fallbackLocale: process.env.VUE_APP_I18N_FALLBACK_LOCALE || "en",
	messages: loadLocaleMessages(),
});

export function fds(date1, date2, options) {
    return formatDistanceStrict(date1, date2, {
        ...options,
        ...{
            locale: supportedLocales[instance.locale].fns
        }
    });
}

export default instance;
