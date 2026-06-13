import { CensorType, Profanity, type ProfanityOptions } from "@2toad/profanity";
import {
	PROFANITY_LISTS,
	PROFANITY_LISTS_BY_ID,
	devWordsArray,
	reservedWordsArray,
	type ProfanityListDefinition,
	type ProfanityListId
} from "@bigfootds/bigfootds-shared-data";

export { CensorType, Profanity, ProfanityOptions, profaneWords, profanity } from "@2toad/profanity";

/**
 * Language codes that `@2toad/profanity` supports without BigfootDS custom datasets.
 */
export const supportedProfanityLanguages = [
	"ar",
	"zh",
	"en",
	"fr",
	"de",
	"hi",
	"it",
	"ja",
	"ko",
	"pt",
	"ru",
	"es"
] as const;

/**
 * Union of language codes supported directly by the upstream profanity package.
 */
export type SupportedProfanityLanguage = typeof supportedProfanityLanguages[number];

/**
 * Metadata for a BigfootDS localisation target and its profanity support status.
 */
export interface TargetProfanityLanguage {
	readonly name: string;
	readonly locale: string;
	readonly profanityLanguage?: SupportedProfanityLanguage;
	readonly supportedByDefault: boolean;
}

/**
 * BigfootDS localisation targets and their current profanity-detection coverage.
 */
export const targetProfanityLanguages: readonly TargetProfanityLanguage[] = [
	{ name: "English", locale: "en", profanityLanguage: "en", supportedByDefault: true },
	{ name: "French", locale: "fr", profanityLanguage: "fr", supportedByDefault: true },
	{ name: "Italian", locale: "it", profanityLanguage: "it", supportedByDefault: true },
	{ name: "German", locale: "de", profanityLanguage: "de", supportedByDefault: true },
	{ name: "Spanish", locale: "es", profanityLanguage: "es", supportedByDefault: true },
	{ name: "Portuguese", locale: "pt", profanityLanguage: "pt", supportedByDefault: true },
	{ name: "Portuguese Brazilian", locale: "pt-BR", profanityLanguage: "pt", supportedByDefault: true },
	{ name: "Dutch", locale: "nl", supportedByDefault: false },
	{ name: "Turkish", locale: "tr", supportedByDefault: false },
	{ name: "Japanese", locale: "ja", profanityLanguage: "ja", supportedByDefault: true },
	{ name: "Korean", locale: "ko", profanityLanguage: "ko", supportedByDefault: true },
	{ name: "Mandarin Chinese", locale: "zh", profanityLanguage: "zh", supportedByDefault: true },
	{ name: "Russian", locale: "ru", profanityLanguage: "ru", supportedByDefault: true },
	{ name: "Ukrainian", locale: "uk", supportedByDefault: false },
	{ name: "Malay", locale: "ms", supportedByDefault: false },
	{ name: "Indonesian", locale: "id", supportedByDefault: false },
	{ name: "Vietnamese", locale: "vi", supportedByDefault: false },
	{ name: "Tagalog", locale: "tl", supportedByDefault: false },
	{ name: "Hindi", locale: "hi", profanityLanguage: "hi", supportedByDefault: true },
	{ name: "Urdu", locale: "ur", supportedByDefault: false },
	{ name: "Bengali", locale: "bn", supportedByDefault: false },
	{ name: "Marathi", locale: "mr", supportedByDefault: false },
	{ name: "Telugu", locale: "te", supportedByDefault: false },
	{ name: "Tamil", locale: "ta", supportedByDefault: false },
	{ name: "Arabic", locale: "ar", profanityLanguage: "ar", supportedByDefault: true }
];

/**
 * Default profanity language set used when callers do not provide a language option.
 */
export const defaultProfanityLanguages: readonly SupportedProfanityLanguage[] = ["en"];

/**
 * Shared language options accepted by profanity handlers.
 */
export interface ProfanityLanguageOptions {
	readonly languages?: readonly SupportedProfanityLanguage[];
}

/**
 * Options for censoring chat text.
 */
export interface ChatCensorOptions extends ProfanityLanguageOptions {
	readonly censorType?: CensorType;
}

/**
 * Options for checking player-facing names.
 */
export interface PlayerNameCheckOptions extends ProfanityLanguageOptions {
	readonly includeReservedWords?: boolean;
	readonly includeDevWords?: boolean;
}

/**
 * Detailed outcome from checking a player/user-controlled name.
 */
export interface PlayerNameCheckResult {
	readonly isAllowed: boolean;
	readonly hasProfanity: boolean;
	readonly hasReservedWord: boolean;
	readonly hasDevWord: boolean;
	readonly matches: {
		readonly reservedWords: readonly string[];
		readonly devWords: readonly string[];
	};
}

/**
 * Unicode normalisation forms supported by JavaScript.
 */
export type ModerationUnicodeNormalForm = "NFC" | "NFD" | "NFKC" | "NFKD";

/**
 * Text normalisation options for moderation and restricted-word checks.
 */
export interface NormalizeModerationTextOptions {
	readonly unicodeForm?: ModerationUnicodeNormalForm;
	readonly trim?: boolean;
	readonly collapseWhitespace?: boolean;
	readonly lowerCase?: boolean;
	readonly locale?: string | readonly string[];
}

/**
 * Matching mode for static profanity/restricted-word list checks.
 */
export type ProfanityMatchMode = "substring" | "whole_word";

/**
 * Options for static profanity/restricted-word list matching.
 */
export interface FindProfanityListMatchesOptions {
	readonly listIds?: readonly ProfanityListId[];
	readonly lists?: readonly ProfanityListDefinition[];
	readonly mode?: ProfanityMatchMode;
	readonly normalization?: NormalizeModerationTextOptions;
}

/**
 * Static profanity/restricted-word match.
 */
export interface ProfanityListMatch {
	readonly listId: ProfanityListId;
	readonly listDisplayName: string;
	readonly word: string;
	readonly normalizedWord: string;
	readonly index: number;
	readonly mode: ProfanityMatchMode;
}

/**
 * Result from checking a value against static BigfootDS profanity/restricted-word lists.
 */
export interface ProfanityListCheckResult {
	readonly isAllowed: boolean;
	readonly matches: readonly ProfanityListMatch[];
}

const chatProfanity = new Profanity({
	languages: [...defaultProfanityLanguages],
	wholeWord: true,
	unicodeWordBoundaries: true
});

const playerNameProfanity = new Profanity({
	languages: [...defaultProfanityLanguages],
	wholeWord: false,
	unicodeWordBoundaries: true
});

/**
 * Checks whether a string is a language code supported directly by `@2toad/profanity`.
 */
export function isSupportedProfanityLanguage(language: string): language is SupportedProfanityLanguage {
	return supportedProfanityLanguages.includes(language as SupportedProfanityLanguage);
}

/**
 * Resolves an application locale to an upstream profanity language when one is available.
 */
export function getSupportedProfanityLanguageForLocale(
	locale: string
): SupportedProfanityLanguage | undefined {
	const normalizedLocale = locale.trim().toLowerCase();
	const exactMatch = targetProfanityLanguages.find(
		(language) => language.locale.toLowerCase() === normalizedLocale
	);

	if (exactMatch) {
		return exactMatch.profanityLanguage;
	}

	const baseLocale = normalizedLocale.split("-")[0];

	if (isSupportedProfanityLanguage(baseLocale)) {
		return baseLocale;
	}

	return undefined;
}

/**
 * Normalises text for moderation-sensitive comparisons.
 */
export function normalizeModerationText(
	value: string,
	options: NormalizeModerationTextOptions = {}
): string {
	const {
		unicodeForm = "NFKC",
		trim = true,
		collapseWhitespace = true,
		lowerCase = true,
		locale
	} = options;

	let normalized = value.normalize(unicodeForm);

	if (trim) {
		normalized = normalized.trim();
	}

	if (collapseWhitespace) {
		normalized = normalized.replace(/\s+/g, " ");
	}

	if (lowerCase) {
		normalized = normalized.toLocaleLowerCase(locale);
	}

	return normalized;
}

/**
 * Normalises a value before comparing it with BigfootDS reserved or developer word lists.
 */
export function normalizeRestrictedWord(value: string): string {
	return value.normalize("NFKC").trim().toLowerCase();
}

/**
 * Finds BigfootDS restricted words contained within a candidate value.
 */
export function findRestrictedWords(value: string, words: readonly string[]): string[] {
	const normalizedValue = normalizeRestrictedWord(value);

	if (!normalizedValue) {
		return [];
	}

	return words.filter((word) => {
		const normalizedWord = normalizeRestrictedWord(word);
		return normalizedWord.length > 0 && normalizedValue.includes(normalizedWord);
	});
}

/**
 * Finds static profanity/restricted-word list matches in a candidate value.
 */
export function findProfanityListMatches(
	value: string,
	options: FindProfanityListMatchesOptions = {}
): readonly ProfanityListMatch[] {
	const normalizedValue = normalizeModerationText(value, options.normalization);

	if (normalizedValue === "") {
		return [];
	}

	const lists = resolveProfanityLists(options);
	const matches: ProfanityListMatch[] = [];

	for (const list of lists) {
		const mode = options.mode ?? resolveDefaultMatchMode(list);

		for (const word of list.words) {
			const normalizedWord = normalizeModerationText(word, options.normalization);

			if (normalizedWord === "") {
				continue;
			}

			const index = mode === "whole_word"
				? findWholeWordIndex(normalizedValue, normalizedWord)
				: normalizedValue.indexOf(normalizedWord);

			if (index >= 0) {
				matches.push({
					listId: list.id,
					listDisplayName: list.displayName,
					word,
					normalizedWord,
					index,
					mode
				});
			}
		}
	}

	return matches;
}

/**
 * Checks whether a value has any static profanity/restricted-word list matches.
 */
export function hasProfanityListMatch(
	value: string,
	options: FindProfanityListMatchesOptions = {}
): boolean {
	return findProfanityListMatches(value, options).length > 0;
}

/**
 * Returns a pass/fail result plus static list matches.
 */
export function checkProfanityList(
	value: string,
	options: FindProfanityListMatchesOptions = {}
): ProfanityListCheckResult {
	const matches = findProfanityListMatches(value, options);

	return {
		isAllowed: matches.length === 0,
		matches
	};
}

/**
 * Profanity-only handler for chat and other free-text surfaces.
 */
export const chatProfanityHandler = {
	exists(text: string, options: ProfanityLanguageOptions = {}): boolean {
		return chatProfanity.exists(text, resolveLanguages(options.languages));
	},

	censor(text: string, options: ChatCensorOptions = {}): string {
		return chatProfanity.censor(
			text,
			options.censorType ?? CensorType.Word,
			resolveLanguages(options.languages)
		);
	}
};

/**
 * Handler for player/user-controlled names.
 */
export const playerNameProfanityHandler = {
	check(value: string, options: PlayerNameCheckOptions = {}): PlayerNameCheckResult {
		const hasProfanity = playerNameProfanity.exists(value, resolveLanguages(options.languages));
		const reservedWords = options.includeReservedWords === false
			? []
			: findRestrictedWords(value, reservedWordsArray);
		const devWords = options.includeDevWords === false
			? []
			: findRestrictedWords(value, devWordsArray);

		return {
			isAllowed: !hasProfanity && reservedWords.length === 0 && devWords.length === 0,
			hasProfanity,
			hasReservedWord: reservedWords.length > 0,
			hasDevWord: devWords.length > 0,
			matches: {
				reservedWords,
				devWords
			}
		};
	},

	isAllowed(value: string, options: PlayerNameCheckOptions = {}): boolean {
		return playerNameProfanityHandler.check(value, options).isAllowed;
	}
};

/**
 * Grouped handlers for consumers that prefer context-based property access.
 */
export const ProfanityHandlers = {
	chat: chatProfanityHandler,
	playerName: playerNameProfanityHandler
};

function resolveLanguages(languages?: readonly SupportedProfanityLanguage[]): string[] | undefined {
	return languages ? [...languages] : undefined;
}

function resolveProfanityLists(
	options: FindProfanityListMatchesOptions
): readonly ProfanityListDefinition[] {
	if (options.lists !== undefined) {
		return options.lists;
	}

	if (options.listIds !== undefined) {
		return options.listIds.map((listId) => PROFANITY_LISTS_BY_ID[listId]);
	}

	return PROFANITY_LISTS;
}

function resolveDefaultMatchMode(list: ProfanityListDefinition): ProfanityMatchMode {
	return list.matchingDefault === "substring_for_names" ? "substring" : "substring";
}

function findWholeWordIndex(value: string, word: string): number {
	const pattern = new RegExp(`(^|[^\\p{L}\\p{N}_])(${escapeRegExp(word)})(?=$|[^\\p{L}\\p{N}_])`, "u");
	const match = pattern.exec(value);

	if (match === null) {
		return -1;
	}

	return match.index + (match[1]?.length ?? 0);
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
