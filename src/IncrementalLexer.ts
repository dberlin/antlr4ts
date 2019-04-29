/*!
 * Copyright 2016 The ANTLR Project. All rights reserved.
 * Licensed under the BSD-3-Clause license. See LICENSE file in the project root for license information.
 */

// ConvertTo-TS run at 2016-10-04T11:26:51.7913318-07:00

import { Override } from "./Decorators";
import { IncrementalCommonToken } from "./IncrementalCommonToken";
import { IncrementalCommonTokenFactory } from "./IncrementalCommonTokenFactory";
import { IncrementalTokenFactory } from "./IncrementalTokenFactory";
import { Lexer } from "./Lexer";
import { LookaheadTrackingCharStream } from "./LookaheadTrackingCharStream";
import { Interval } from "./misc/Interval";
import { TextChange } from "./TextChange";
import { Token } from "./Token";
import { TokenChange, TokenChangeType } from "./TokenChange";

// A class that keeps track of offsets that need to be applied to reused tokens.
class OffsetInfo {
	public charOffset: number = 0;
	public lineOffset: number = 0;
	public charPositionInLineOffset: number = 0;
}

/** An incremental version of the lexer class
 */
export abstract class IncrementalLexer extends Lexer {
	// TODO: Mark where newlines were affected

	/* Current offsets to apply to reused tokens. */
	private offsetInfo: OffsetInfo = new OffsetInfo();
	/* Index into the changed text range list. */
	private changedRangeIndex: number = -1;
	/* List of changed text ranges. */
	private changedRanges: TextChange[] = [];

	/* Current index into the old token array, used to return old tokens when they can be reused. */
	private oldTokenIndex: number = 0;
	protected oldTokens: IncrementalCommonToken[];
	/* Set of token changes produced by this run of the lexer */
	protected _tokenChanges: TokenChange[] = [];

	/**
	 * Construct an incremental lexer with no existing token state
	 * @param input The input stream for the lexer.
	 */
	constructor(input: LookaheadTrackingCharStream);

	/**
	 *
	 * @param input The input stream for the lexer.
	 * @param oldTokens The list of tokens the lexer produced on the last run.
	 * @param changeList The set of text changes that have occurred to the stream.
	 */
	constructor(
		input: LookaheadTrackingCharStream,
		oldTokens: IncrementalCommonToken[],
		changeList: TextChange[],
	);

	constructor(
		input?: LookaheadTrackingCharStream,
		oldTokens?: IncrementalCommonToken[],
		changeList?: TextChange[],
	) {
		super(input!);
		if (!input) {
			throw new Error("We must have at least an input stream");
		}
		this.tokenFactory = IncrementalCommonTokenFactory.DEFAULT;
		if (oldTokens && changeList) {
			this.oldTokens = oldTokens;
			// Mark any EOF token at the end of the token list.
			this.markEOFIfNeeded();
			changeList.sort((a, b) => {
				return a.start - b.start;
			});
			this.changedRanges = changeList;
		}
	}
	/**
	 *  Mark EOF token as changed.
	 *
	 * The various pieces track whether they hit EOF and it is annoying to restore this state everywhere it is tracked.
	 * As such, we simply always let them hit EOF on their own again.
	 */
	private markEOFIfNeeded() {
		if (this.oldTokens.length === 0) {
			return;
		}
		if (this.oldTokens[this.oldTokens.length - 1].type === Token.EOF) {
			this.oldTokens[this.oldTokens.length - 1].marked = true;
		}
	}

	/**
	 * Advance the current change to the latest in the list where inputPosition > startIndex.
	 * Update offset info to be correct for the current place we are at.
	 *
	 */
	private advanceCurrentChange() {
		if (!this.changedRanges || this.changedRanges.length === 0) {
			return;
		}
		// Adjust the input place back into the old stream indexes
		const currentInputPlace = this.charIndex + this.offsetInfo.charOffset;
		let currentChange: TextChange | undefined;

		if (this.changedRangeIndex >= 0) {
			currentChange = this.changedRanges[this.changedRangeIndex];
		}
		if (this.changedRangeIndex + 1 >= this.changedRanges.length) {
			return;
		}
		let nextChange = this.changedRanges[this.changedRangeIndex + 1];
		// Advance changed range to latest that is covered by input pos.
		while (currentInputPlace >= nextChange.start) {
			// Move to the next change
			++this.changedRangeIndex;

			this.offsetInfo.charOffset += nextChange.getOffset();
			if (this.changedRangeIndex + 1 >= this.changedRanges.length) {
				break;
			}
			nextChange = this.changedRanges[this.changedRangeIndex + 1];
		}
		return;
	}

	/**
	 * Check if the current input position is in the range of a given token.
	 * @param token Token to check
	 * @param inputPos Input position
	 */
	private tokenInRange(token: IncrementalCommonToken, inputPos: number) {
		// Adjust the input place back into the terms of the old stream indexes.
		const adjustedInput = inputPos + this.offsetInfo.charOffset;
		return (
			adjustedInput >= token.startIndex &&
			adjustedInput <= token.stopIndex
		);
	}

	/**
	 * Check if the current input position is before the range of a given token.
	 * @param token Token to check
	 * @param inputPos Input position
	 */
	private tokenPastRange(token: IncrementalCommonToken, inputPos: number) {
		const adjustedInput = inputPos + this.offsetInfo.charOffset;
		return token.startIndex > adjustedInput;
	}

	/**
	 * Advance the current place in the old token list until it is at least at the
	 * current place in the input stream (adjusted for changed tokens).
	 *
	 * @return Return the current old token if it eixsts or undefined if we ran out.
	 */
	private advanceOldTokens() {
		if (
			this.oldTokens === undefined ||
			this.oldTokens.length === 0 ||
			this.oldTokenIndex >= this.oldTokens.length
		) {
			return undefined;
		}
		let currentOldToken: IncrementalCommonToken = this.oldTokens[
			this.oldTokenIndex
		];

		// Skip deleted tokens, and find the next token either in range or right past us.
		while (
			currentOldToken.deleted ||
			(!this.tokenInRange(currentOldToken, this.charIndex) &&
				!this.tokenPastRange(currentOldToken, this.charIndex))
		) {
			// Mark deleted tokens as removed
			if (currentOldToken.deleted) {
				this.tokenChanges.push({
					changeType: TokenChangeType.REMOVED,
					oldToken: currentOldToken,
				});
			}
			++this.oldTokenIndex;
			if (this.oldTokenIndex >= this.oldTokens.length) {
				return undefined;
			}
			currentOldToken = this.oldTokens[this.oldTokenIndex];
		}
		return currentOldToken;
	}

	private copyAndAdjustToken(token: IncrementalCommonToken) {
		let t = IncrementalCommonToken.fromToken(token);
		t.charPositionInLine += this.offsetInfo.charPositionInLineOffset;
		t.line += this.offsetInfo.lineOffset;
		t.startIndex += this.offsetInfo.charOffset;
		t.stopIndex += this.offsetInfo.charOffset;
		return t;
	}
	/**
	 * Get the old token that may or may not match up with our input index.
	 *
	 * @return The old token if one exists, or undefined.
	 */
	private getNextOldToken() {
		const currentOldToken = this.advanceOldTokens();

		return currentOldToken;
	}
	private getAdjustedStartOffset(tok: IncrementalCommonToken) {
		return tok.startIndex + this.offsetInfo.charOffset;
	}
	@Override
	public nextToken(): Token {
		this.advanceCurrentChange();
		let oldToken;
		if (this.oldTokens) {
			// This retrieves the next possible old token to reuse.
			oldToken = this.getNextOldToken();
			// If the token isn't marked, and starts where we need it to, reuse it
			if (
				oldToken &&
				!oldToken.marked &&
				this.getAdjustedStartOffset(oldToken) === this.charIndex
			) {
				let tokenStartMarker: number = this._input.mark();
				this._input.seek(oldToken.stopIndex + 1);
				this._interp.line = oldToken.line;
				this._interp.charPositionInLine = oldToken.charPositionInLine;
				this._input.release(tokenStartMarker);

				return this.offsetInfo.charOffset === 0
					? oldToken
					: this.copyAndAdjustToken(oldToken);
			}
		}
		// Before we call super, _token is the last token emitted.
		// At this point we know we can't reuse a token. We either ran out of tokens, or are in a changed range.
		let trackingInput = this._input as LookaheadTrackingCharStream;
		trackingInput.resetMinMaxLookahead();
		let t: IncrementalCommonToken = super.nextToken() as IncrementalCommonToken;

		// See how old token compares to current token
		if (oldToken) {
			oldToken.marked = false;
			let adjustedStart =
				oldToken.startIndex + this.offsetInfo.charOffset;
			let adjustedStop = oldToken.stopIndex + this.offsetInfo.charOffset;
			// See if nothing changed
			if (
				adjustedStart === t.startIndex &&
				adjustedStop === t.stopIndex &&
				oldToken.type === t.type &&
				oldToken.text === t.text
			) {
				return t;
			}
			// See if the text or type changed
			if (
				(adjustedStart === t.startIndex &&
					adjustedStop !== t.stopIndex) ||
				(adjustedStart === t.startIndex &&
					adjustedStop === t.stopIndex &&
					(oldToken.type !== t.type || oldToken.text !== t.text))
			) {
				this._tokenChanges.push({
					changeType: TokenChangeType.CHANGED,
					newToken: t,
					oldToken,
				});
			} else if (adjustedStart > this.charIndex) {
				this._tokenChanges.push({
					changeType: TokenChangeType.ADDED,
					newToken: t,
				});
			} else if (
				adjustedStart <= this.charIndex &&
				adjustedStop >= this.charIndex
			) {
				console.log("Overlap");
			}
		}
		return t;
	}
	@Override
	public emit(token?: Token): Token {
		if (!token) {
			let incrementalFactory = this._factory as IncrementalTokenFactory;
			let trackingInput = this._input as LookaheadTrackingCharStream;
			token = incrementalFactory.createWithLookahead(
				this._tokenFactorySourcePair,
				this._type,
				this._text,
				this._channel,
				this._tokenStartCharIndex,
				this.charIndex - 1,
				this._tokenStartLine,
				this._tokenStartCharPositionInLine,
				trackingInput.minMaxLookahead,
				//TODO: Look into DFA state tracking
			);
		}
		this._token = token;
		return token;
	}

	@Override
	public reset(resetInput?: boolean): void {
		throw new Error("Reset is not supported yet");
	}

	public get tokenChanges() {
		return this._tokenChanges;
	}
}
