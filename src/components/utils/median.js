export default function median(values, returnFixed) {
	values.sort(function(a, b) {
		return a - b;
	});

	if (values.length === 0) return 0;

	var half = Math.floor(values.length / 2);

	var value;
	if (values.length % 2) value = values[half];
	else value = (values[half - 1] + values[half]) / 2.0;

	if (!returnFixed) return value;
	var fixed2 = value.toFixed(2);
	if (fixed2 > 0) return fixed2;
	var fixed3 = value.toFixed(3);
	if (fixed3 > 0) return fixed3;
	return value.toFixed(4);
}