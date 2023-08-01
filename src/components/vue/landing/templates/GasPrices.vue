<template>
	<div class="stat-item">
		<div class="stat-item-inner">
			<div id="gas_values" class="stat-item">
				<div class="gas-estimate-container-flex">
					<div class="top-area">
						<div class="toggle field unselectable has-text-centered">
							<div class="control">
								<input v-model="eip1559" name="eip1559" id="eip1559" class="switch" type="checkbox" />
								<label for="eip1559">EIP-1559</label>
							</div>
							<div class="control">
								<input
									v-model="advanced"
									name="advanced"
									id="advanced"
									class="switch"
									type="checkbox"
								/>
								<label for="advanced">Advanced</label>
							</div>
						</div>
					</div>
					<div class="gas-estimate-container">
						<div class="gas-estimate">
							<div v-if="values[0]" class="is-centered next-block block">
								<div class="title is-5 has-text-centered">Now (Next Block)</div>
								<p v-if="advanced" class="subtitle is-6 has-text-centered">
									Block #{{ values[0].height }}
								</p>
								<div
									v-if="eip1559"
									:class="{ 'columns is-mobile': !advanced }"
									class="content has-text-centered"
								>
									<div :class="{ column: !advanced }" :style="advanced ? 'margin-bottom:1.5rem' : ''">
										<div class="value-title">
											<strong>Priority Fee</strong>
										</div>
										<div :class="{ 'with-line': advanced }" class="title is-2 values priority-fee">
											<div v-if="advanced" class="minimum">
												{{ formatNo(values[0].minMpfpg) }}
											</div>
											<div class="recommended">
												{{ formatNo(values[0].recMpfpg) }}
											</div>
											<div v-if="advanced" class="high">
												{{ formatNo(values[0].highMpfpg) }}
											</div>
										</div>
									</div>
									<div :class="{ column: !advanced }">
										<div class="value-title">
											<strong>Max Fee</strong>
										</div>
										<div class="title is-2 values max-fee">
											<span class="recommended">{{ formatNo(values[0].recMfpg) }}</span>
										</div>
									</div>
								</div>
								<div v-else class="content has-text-centered">
									<div :class="{ 'with-line': advanced }" class="title is-2 values priority-fee">
										<div v-if="advanced" class="minimum">
											{{ formatNo(Number(values[0].baseFee) + Number(values[0].minMpfpg)) }}
										</div>
										<div class="recommended">
											{{ formatNo(Number(values[0].baseFee) + Number(values[0].minMpfpg)) }}
										</div>
										<div v-if="advanced" class="high">
											{{ formatNo(Number(values[0].baseFee) + Number(values[0].highMpfpg)) }}
										</div>
									</div>
								</div>
								<div class="content has-text-centered">
									<div class="values details">
										<span v-if="advanced"
											>Base Fee:
											<span class="tag is-info is-large base-fee">{{
												formatNo(values[0].baseFee, true)
											}}</span></span
										>
										<span v-if="advanced"
											>Tx Count: <span class="tag">{{ values[0].txCount }}</span></span
										>
										<span v-if="advanced"
											>Gas Used:
											<span class="tag">{{
												values[0].gasUsed.toLocaleString("en-US", {
													maximumFractionDigits: 0,
												})
											}}</span></span
										>
									</div>
								</div>
							</div>
							<div
								v-else
								class="loader is-loading"
								style="width: 50px; height: 50px; margin: 10px auto"
							></div>
							<div class="later-blocks" v-if="values[1] && values[2]">
								<div v-for="i in 2" :key="i" class="later-block block">
									<div class="title is-6 has-text-centered">
										{{ i === 1 ? "In 30 Seconds" : "Later" }}
									</div>
									<p v-if="advanced" class="subtitle is-6 has-text-centered">
										Block #{{ values[i].height }}
									</p>
									<div v-if="eip1559" class="content has-text-centered">
										<div class="columns is-mobile">
											<div class="column">
												<div class="value-title">Priority Fee</div>
												<div class="title is-4 values priority-fee">
													{{ formatNo(values[i].recMpfpg) }}
												</div>
											</div>
											<div class="column">
												<div class="value-title">Max Fee</div>
												<div class="title is-4 values priority-fee">
													{{ formatNo(values[i].recMfpg) }}
												</div>
											</div>
										</div>
									</div>
									<div v-else class="content has-text-centered">
										<div class="columns is-mobile">
											<div class="column">
												<!-- <div class="value-title">Gas Price</div> -->
												<div class="title is-4 values priority-fee">
													{{
														formatNo(Number(values[i].baseFee) + Number(values[i].recMpfpg))
													}}
												</div>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>
<script>
import { newStat } from "../controllers/statistic";
export default {
	data: function () {
		return {
			eip1559: false,
			advanced: false,
			feeRange: 50,
			stat: null,
		};
	},
	methods: {
		formatNo(number, forceDecimals = false) {
			if (number < 2 || forceDecimals) return parseFloat(number.toFixed(2));
			return Math.round(number);
		},
	},
	beforeMount() {
		let eip1559 = localStorage.getItem("ETHGas-eip1559");
		if (eip1559 !== "null") this.eip1559 = JSON.parse(eip1559);
		let advanced = localStorage.getItem("ETHGas-advanced");
		if (advanced !== "null") this.advanced = JSON.parse(advanced);

		this.stat = newStat("ETH", "blockGasEstimates");
	},
	beforeDestroy() {
		this.stat.stop();
	},
	computed: {
		values() {
			const string = this.stat.history[this.stat.history.length - 1]?.value || "[]";
			return JSON.parse(string);
		},
	},
	watch: {
		eip1559(val) {
			localStorage.setItem("ETHGas-eip1559", val);
		},
		advanced(val) {
			localStorage.setItem("ETHGas-advanced", val);
		},
	},
};
</script>
<style lang="scss" scoped>
$dark-1: #1f1f1f;
$light-1: #d6d6d6;
$dark-color: #696969;
$light-color: #cccccc;

.dark-mode {
	.gas-estimate {
		.block {
			.title {
				color: $light-1 !important;
			}
			color: $light-1 !important;
			background-color: $dark-1 !important;
		}
	}
}

.stat-item-inner {
	text-align: center;
}

#gas_values {
	width: 100%;
	height: 100%;
	max-width: 900px;
	position: relative;
	display: inline-block;
	.toggle {
		.control {
			display: inline-block;
			margin: 10px;
		}
	}
	.gas-estimate-container-flex {
		display: flex;
		height: 100%;
		width: 100%;
		flex-direction: column;

	}
	.gas-estimate-container {
		position: relative;
		width: 100%;
		display: flex;
		flex: 1;
		align-items: center;
		justify-content: center;
		.gas-estimate {
			width: 100%;
			padding: 5px 0px;

			.value-title {
				font-size: 1rem;
				strong {
					font-size: 1.2rem;
				}
			}
			.subtitle {
				color: $dark-color;
			}
			.columns {
				&.content {
					margin-bottom: 1.5rem !important;
				}
			}
			.block {
				border-radius: 4px;
				padding: 10px 3px;
				margin: 0 4px !important;
				background-color: white;
				.values {
					position: relative;
					> span {
						white-space: nowrap !important;
					}
					.recommended {
						color: rgb(0, 194, 0);
						font-size: 3.5rem;
					}
					.minimum {
						color: rgb(175, 194, 0);
						font-size: 1rem;
						position: absolute;
						transform: translateY(-50%);
						top: 50%;
						left: 15%;
						width: 200px;
						text-align: left;
						&::after {
							content: "Minimum";
							position: absolute;
							left: 0;
							top: 100%;
							font-size: 1rem;
							color: $light-color;
							opacity: 0.8;
						}
					}
					.high {
						color: rgb(175, 194, 0);
						font-size: 1rem;
						position: absolute;
						transform: translateY(-50%);
						top: 50%;
						right: 15%;
						width: 200px;
						text-align: right;
						&::after {
							content: "Overpay";
							position: absolute;
							right: 0;
							top: 100%;
							font-size: 1rem;
							color: $light-color;
							opacity: 0.8;
						}
					}
					&.details {
						font-size: 1rem;
					}
					.tag {
						&:not(.base-fee) {
							font-size: 1rem;
						}
						margin: 1%;
					}
				}
				.values.with-line::after {
					content: "";
					height: 1px;
					width: 70%;
					position: absolute;
					bottom: 0;
					left: 15%;
					z-index: 0;
					background: linear-gradient(to right, rgb(175, 194, 0), rgb(0, 194, 0), rgb(175, 194, 0));
				}
			}
			.next-block {
				width: calc(100% - 8px);
			}
		}
		.later-blocks {
			opacity: 0.5;
			margin-top: 8px !important;
			overflow: auto;
		}
		.later-block {
			width: calc(50% - 8px);
			float: left;
			.content .columns {
				margin-bottom: 24px !important;
			}
			.values {
				.tag {
					font-size: 0.9rem !important;
				}
			}
		}
	}
}
</style>