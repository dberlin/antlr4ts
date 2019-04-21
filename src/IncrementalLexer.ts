/*!
 * Copyright 2016 The ANTLR Project. All rights reserved.
 * Licensed under the BSD-3-Clause license. See LICENSE file in the project root for license information.
 */

// ConvertTo-TS run at 2016-10-04T11:26:51.7913318-07:00

import { Lexer } from "./Lexer";
import { LookaheadTrackingCharStream } from "./LookaheadTrackingCharStream";
import { TextChange } from "./TextChange";
import { IncrementalCommonToken } from "./IncrementalCommonToken";
import { IncrementalCommonTokenFactory } from "./IncrementalCommonTokenFactory";
import { Override } from "./Decorators";
import { Token } from "./Token";
import { IncrementalTokenFactory } from "./IncrementalTokenFactory";
import { TokenChange, TokenChangeType } from "./TokenChange";
import { Interval } from "./misc/Interval";

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
	private offsetInfo: OffsetInfo;
	/* Index into the changed text range list. */
	private changedRangeIndex: number = 0;
	/* List of changed text ranges. */
	private changedRanges: TextChange[] = [];

	/* Current index into the old token array, used to return old tokens when they can be reused. */
	private oldTokenIndex: number = 0;
	protected oldTokens: IncrementalCommonToken[];
	/* Set of token changes produced by this run of the lexer */
	protected _tokenChanges: TokenChange[];

	constructor(input: LookaheadTrackingCharStream);
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
			// Remove any EOF token at the end of the token list.
			this.popEOFIfNeeded();
			this.changedRanges = changeList;
		}
	}

	private computeLookback(tokenList: IncrementalCommonToken[]) {
		// TODO : Lookbehind properly
	}
	/**
	 *  Remove EOF token from token list.
	 *
	 * The recognizers track whether they hit EOF and it is annoying to restore this state.
	 * As such, we simply always let them hit EOF on their own again.
	 */
	private popEOFIfNeeded() {
		if (this.oldTokens.length === 0) {
			return;
		}
		if (this.oldTokens[this.oldTokens.length - 1].type === Token.EOF) {
			this.oldTokens.pop();
		}
	}

	/**
	 * Advance the current change so it is at or after the current place in the input stream.
	 *
	 * @return Return the current change or undefined if we ran out of changed.
	 */
	private advanceCurrentChange() {
		if (!this.changedRanges || this.changedRanges.length === 0) {
			return undefined;
		}
		// Adjust the input place back into the old stream indexes
		let currentInputPlace = this.charIndex + this.offsetInfo.charOffset;
		let currentChange: TextChange = this.changedRanges[
			this.changedRangeIndex
		];
		// Advance changed range if we moved past it.
		while (!currentChange.contains(currentInputPlace)) {
			++this.changedRangeIndex;
			if (this.changedRangeIndex >= this.changedRanges.length) {
				return undefined;
			}
			currentChange = this.changedRanges[this.changedRangeIndex];
		}
		return currentChange;
	}

	/**
	 * Check if the current input position is in the range of a given token.
	 * @param token Token to check
	 * @param inputPos Input position
	 */
	private tokenInRange(token: IncrementalCommonToken, inputPos: number) {
		// Adjust the input place back into the terms of the old stream indexes.
		let adjustedInput = inputPos + this.offsetInfo.charOffset;
		return (
			inputPos >= token.startIndex + this.offsetInfo.charOffset &&
			inputPos <= token.stopIndex + this.offsetInfo.charOffset
		);
	}
	/**
	 * Advance the current place in the old token list until it is at least at the
	 * current place in the input stream (adjusted for changed tokens).
	 *
	 * @return Return the current old token if it eixsts or undefined if we ran out.
	 */
	private advanceOldTokens() {
		let currentOldToken: IncrementalCommonToken = this.oldTokens[
			this.oldTokenIndex
		];
		while (!this.tokenInRange(currentOldToken, this.charIndex)) {
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
	private reuseNextToken() {
		if (
			this.oldTokens === undefined ||
			this.oldTokens.length === 0 ||
			this.oldTokenIndex >= this.oldTokens.length
		) {
			return undefined;
		}
		let currentOldToken = this.advanceOldTokens();
		if (!currentOldToken) {
			return undefined;
		}
		return currentOldToken;
	}

	@Override
	public nextToken(): Token {
		let oldToken;
		if (this.oldTokens) {
			oldToken = this.reuseNextToken();
			// If the token isn't marked, reuse it
			if (oldToken && !oldToken.marked) {
				this._input.seek(oldToken.stopIndex);
				this._interp.line = oldToken.line;
				this._interp.charPositionInLine = oldToken.charPositionInLine;
				return this.copyAndAdjustToken(oldToken);
			}
		}
		// Before we call super, _token is the last token emitted.
		// At this point we know we can't reuse a token. We either ran out of tokens, or are in a changed range.
		let trackingInput = this._input as LookaheadTrackingCharStream;
		trackingInput.resetMinMaxLookahead();
		let t: IncrementalCommonToken = super.nextToken() as IncrementalCommonToken;

		// See how old token compares to current token
		if (oldToken) {
			if (oldToken.startIndex === t.startIndex) {
				this._tokenChanges.push({
					changeType: TokenChangeType.CHANGED,
					newToken: t,
					oldToken,
				});
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
