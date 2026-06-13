const assert = require("node:assert/strict");
const { describe, test } = require("node:test");
const {
	REQUEST_ID_HEADER_NAME,
	createActiveRequestMetadata,
	getHeaderValue,
	isValidRequestId,
	resolveRequestIdFromHeaders,
	writeRequestIdHeader
} = require("@bigfootds/bigfootds-service-utils");

describe("request ID helpers", () => {
	test("accept safe inbound request IDs", () => {
		const result = resolveRequestIdFromHeaders({
			"X-Request-ID": "req_123456"
		});

		assert.deepEqual(result, {
			requestId: "req_123456",
			generated: false,
			inboundRequestId: "req_123456"
		});
	});

	test("replace missing or unsafe inbound request IDs", () => {
		const missing = resolveRequestIdFromHeaders(undefined, {
			generateRequestId: () => "generated-1"
		});
		const unsafe = resolveRequestIdFromHeaders(
			{ "x-request-id": "bad value with spaces" },
			{ generateRequestId: () => "generated-2" }
		);

		assert.equal(missing.requestId, "generated-1");
		assert.equal(missing.generated, true);
		assert.equal(unsafe.requestId, "generated-2");
		assert.equal(unsafe.generated, true);
		assert.equal(unsafe.inboundRequestId, "bad value with spaces");
	});

	test("validates the documented request ID character and length rules", () => {
		assert.equal(isValidRequestId("abc12345"), true);
		assert.equal(isValidRequestId("abc.123:_-"), true);
		assert.equal(isValidRequestId("short"), false);
		assert.equal(isValidRequestId("has spaces"), false);
		assert.equal(isValidRequestId("a".repeat(65)), false);
	});

	test("reads and writes headers across common response shapes", () => {
		const nodeResponseHeaders = {};
		const expressResponseHeaders = {};

		writeRequestIdHeader({
			setHeader(name, value) {
				nodeResponseHeaders[name] = value;
			}
		}, "req_node");
		writeRequestIdHeader({
			set(name, value) {
				expressResponseHeaders[name] = value;
			}
		}, "req_express");

		assert.equal(nodeResponseHeaders[REQUEST_ID_HEADER_NAME], "req_node");
		assert.equal(expressResponseHeaders[REQUEST_ID_HEADER_NAME], "req_express");
		assert.equal(getHeaderValue({ ProductName: "ms-auth" }, "productName"), "ms-auth");
	});

	test("creates active request metadata with a request start timestamp", () => {
		assert.deepEqual(
			createActiveRequestMetadata(
				{ "x-request-id": "req_123456" },
				{ nowMs: 123, generateRequestId: () => "unused" }
			),
			{
				requestId: "req_123456",
				generated: false,
				inboundRequestId: "req_123456",
				startedAtMs: 123
			}
		);
	});
});
