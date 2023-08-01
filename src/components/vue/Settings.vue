<template>
	<div>
		<div class="block">
			<multiselect
				selectLabel="Select"
				deselectLabel="Remove"
				:options="tabNames"
				label="title"
				track-by="key"
				@select="changeTab"
				:multiple="false"
				:placeholder="'Select a coin for settings'"
			>
				<template slot="placeholder"
					><span class="option__desc"
						><span class="option__title">{{ $root.i18n(tabs[$root.settingsTab].title) }}</span></span
					></template
				>
				<template slot="option" slot-scope="props">
					<div class="option__desc">
						<span class="option__title">{{ $root.i18n(props.option.title) }}</span>
					</div>
				</template>
			</multiselect>
		</div>
		<div v-if="$root.settingsTab === 'globalSettings'" class="field">
			<label>Language</label>
			<div class="control">
				<div class="select">
					<select v-model="$i18n.locale">
						<option v-for="(lang, code) in langs" :key="code" :value="code">
							{{ code.toUpperCase() + " (" + lang.title + ")" }}
						</option>
					</select>
				</div>
			</div>
		</div>
		<div v-for="(tab, tabKey) in tabs" :class="tabKey" :key="tabKey">
			<template v-if="$root.settingsTab == tabKey">
				<div v-for="(setting, settingKey) in tab.settings" class="field" :key="settingKey">
					<template v-if="setting.writable && !setting.invisible">
						<label>{{ $root.i18n(setting.title) }}</label>
						<div v-if="setting.type == 'checkbox'" class="control">
							<input
								@change="saveSetting(tabKey)"
								v-model="setting.newValue"
								:id="settingToId(tabKey, settingKey)"
								:name="settingToId(tabKey, settingKey)"
								class="switch"
								type="checkbox"
								checked
							/>
							<label :for="settingToId(tabKey, settingKey)"></label>
						</div>
						<div v-if="setting.type == 'dropdown'" class="control">
							<div class="select">
								<select v-model="setting.newValue" @change="saveSetting(tabKey)">
									<option v-for="option in setting.options" :key="option.key" :value="option.key">
										{{ $root.i18n(option.title) }}
									</option>
								</select>
							</div>
						</div>
						<div v-if="setting.type == 'range'" class="control">
							<input
								@change="saveSetting(tabKey)"
								v-model="setting.newValue"
								:id="settingToId(tabKey, settingKey)"
								:name="settingToId(tabKey, settingKey)"
								class="slider"
								step="1"
								:min="setting.min"
								:max="setting.max"
								type="range"
							/>
							{{ setting.newValue }}
						</div>
						<p v-if="setting.restart && setting.value != setting.newValue" class="help is-info">
							{{ $t("messages.refresh-apply") }}
						</p>
					</template>
				</div>
			</template>
		</div>
	</div>
</template>

<script>
import Multiselect from "vue-multiselect";
// @ts-nocheck
import Vue from "vue";
import { supportedLocales } from "../../i18n";

import { userSettings } from "../config.js";
export default {
	data: function () {
		return {
			langs: supportedLocales,
			tabs: {
				globalSettings: {
					title: () => {
						return this.$t("general.global");
					},
					settings: {},
				},
			},
			dashSettings: ["darkMode", "autoLoad"],
		};
	},
	components: {
		Multiselect,
	},
	computed: {
		tabNames() {
			let arr = [];
			for (const tabKey in this.tabs) {
				const tab = this.tabs[tabKey];
				arr.push({ key: tabKey, title: tab.title });
			}
			return arr;
		},
	},
	methods: {
		changeTab(tab) {
			this.$root.settingsTab = tab.key;
		},
		saveSetting: function (settingsKey) {
			let settings = this.tabs[settingsKey].settings;
			this.$root.saveSetting(settings, settingsKey);
			if (settingsKey === "globalSettings") {
				for (let i = 0; i < this.dashSettings.length; i++) {
					const key = this.dashSettings[i];
					window.mainVue[key] = userSettings.globalSettings[key].newValue;
				}
			}
		},
		settingToId: function (tab, setting) {
			return this.$root.coinConfig.ticker + "-" + tab + "-" + setting;
		},
	},
	mounted() {
		for (let i = 0; i < this.dashSettings.length; i++) {
			const key = this.dashSettings[i];
			userSettings.globalSettings[key].value = window.mainVue[key];
			userSettings.globalSettings[key].newValue = window.mainVue[key];
		}

		for (const street in this.$root.game.streetController.enabledConfig) {
			let streetConfig = this.$root.game.streetController.enabledConfig[street];
			let coinName = streetConfig.coinName;
			let ticker = streetConfig.ticker;
			Vue.set(this.tabs, ticker + "Settings", {
				title: coinName,
				settings: {},
			});
		}
		for (const settingsKey in userSettings) {
			if (typeof this.tabs[settingsKey] !== "undefined") {
				//there is a tab for this group of settings
				this.tabs[settingsKey].settings = userSettings[settingsKey];
			}
		}
	},
	beforeDestroy() {
		let coinSettingKey = this.$root.coinConfig.ticker + "Settings";
		this.$root.settingsTab = coinSettingKey;
	},
};
</script>
<style lang="scss" scoped>
.multiselect {
	width: 100%;
}
</style>