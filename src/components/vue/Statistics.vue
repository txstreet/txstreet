<template>
	<div>
		<table class="table is-striped is-narrow is-fullwidth">
			<tbody>
				<template v-for="(stat, key) in stats">
					<tr :key="key" v-if="!stat.hidden">
						<td class="guide-link" v-if="stat.wiki" @click="$root.wikiWindow(stat.title, stat.wiki)">
							{{ $root.i18n(stat.title) }}
						</td>
						<td v-else>{{ $root.i18n(stat.title) }}</td>
						<td>
							{{ calcValue(stat) }}
						</td>
					</tr>
				</template>
			</tbody>
		</table>
	</div>
</template>

<script>
import { calcStatValue } from "../utils/";
// @ts-nocheck
export default {
	computed: {
		stats: function () {
			return this.$root.stats;
		},
	},
	methods: {
		calcValue: function (stat) {
			return calcStatValue(stat);
		},
	},
};
</script>