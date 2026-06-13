const assert = require("node:assert/strict");
const { describe, test } = require("node:test");
const {
	PROFANITY_LIST_IDS
} = require("@bigfootds/bigfootds-shared-data");
const {
	ProfanityHandlers,
	chatProfanityHandler,
	checkProfanityList,
	findProfanityListMatches,
	findRestrictedWords,
	getSupportedProfanityLanguageForLocale,
	hasProfanityListMatch,
	normalizeModerationText,
	normalizeRestrictedWord,
	playerNameProfanityHandler
} = require("@bigfootds/bigfootds-service-utils");

describe("profanity and restricted-word helpers", () => {
	test("normalises moderation text consistently", () => {
		assert.equal(normalizeModerationText("  BigfootDS\tADMIN  "), "bigfootds admin");
		assert.equal(normalizeModerationText("ＢＩＧＦＯＯＴＤＳ"), "bigfootds");
		assert.equal(
			normalizeModerationText("  Keep Case  ", { lowerCase: false }),
			"Keep Case"
		);
	});

	test("normalises and finds restricted words using the migrated manager API", () => {
		assert.equal(normalizeRestrictedWord("  BigfootDS  "), "bigfootds");
		assert.deepEqual(findRestrictedWords("BigfootDS_Admin", ["bigfootds", "admin"]), [
			"bigfootds",
			"admin"
		]);
	});

	test("finds static BigfootDS profanity/restricted-word list matches", () => {
		const matches = findProfanityListMatches("BigfootDS_Admin");

		assert.deepEqual(
			matches.map((match) => [match.listId, match.word]),
			[
				["dev_words", "bigfootds"],
				["dev_words", "bigfoot"],
				["reserved_words", "admin"]
			]
		);
		assert.equal(matches[0].mode, "substring");
	});

	test("can restrict matching to selected list IDs", () => {
		const matches = findProfanityListMatches("BigfootDS_Admin", {
			listIds: [PROFANITY_LIST_IDS.RESERVED_WORDS]
		});

		assert.deepEqual(
			matches.map((match) => match.listId),
			["reserved_words"]
		);
	});

	test("supports whole-word matching when substring matching is too broad", () => {
		assert.equal(
			hasProfanityListMatch("administratorial", {
				listIds: [PROFANITY_LIST_IDS.RESERVED_WORDS],
				mode: "whole_word"
			}),
			false
		);
		assert.equal(
			hasProfanityListMatch("hello admin", {
				listIds: [PROFANITY_LIST_IDS.RESERVED_WORDS],
				mode: "whole_word"
			}),
			true
		);
	});

	test("returns a pass/fail result with matches", () => {
		assert.deepEqual(checkProfanityList("friendly user"), {
			isAllowed: true,
			matches: []
		});
		assert.equal(checkProfanityList("official_support").isAllowed, false);
	});

	test("chat handler detects profanity without treating developer words as profanity", () => {
		assert.equal(chatProfanityHandler.exists("I like big butts and I cannot lie"), true);
		assert.equal(chatProfanityHandler.exists("bigfootds staff update"), false);
		assert.equal(ProfanityHandlers.chat.exists("bigfootds staff update"), false);
	});

	test("player name handler blocks profanity, reserved words, and developer words", () => {
		const profanityResult = playerNameProfanityHandler.check("bigbutts");
		const reservedResult = playerNameProfanityHandler.check("admin");
		const devResult = ProfanityHandlers.playerName.check("BigfootDS");

		assert.equal(profanityResult.hasProfanity, true);
		assert.equal(profanityResult.isAllowed, false);
		assert.equal(reservedResult.hasReservedWord, true);
		assert.equal(reservedResult.isAllowed, false);
		assert.equal(devResult.hasDevWord, true);
		assert.equal(devResult.isAllowed, false);
	});

	test("target locales can resolve to supported profanity languages", () => {
		assert.equal(getSupportedProfanityLanguageForLocale("pt-BR"), "pt");
		assert.equal(getSupportedProfanityLanguageForLocale("nl"), undefined);
	});
});
