/*!
 * Copyright 2016 The ANTLR Project. All rights reserved.
 * Licensed under the BSD-3-Clause license. See LICENSE file in the project root for license information.
 */

import { CharStream } from "./CharStream";
import { CommonToken } from "./CommonToken";
import { NotNull } from "./Decorators";
import { Token } from "./Token";
import { TokenSource } from "./TokenSource";
import { Interval } from "./misc/Interval";

/**
 * This is an extension of the CommonToken class that stores data necessary
 * to do incremental lexing.
 *
 */
export class IncrementalCommonToken extends CommonToken {
	/**
	 * Amount of lookbehind/lookahead used. The min part of this range is
	 * the amount of lookbehind, the max part of this range is the amount
	 * of lookahead.
	 */
	protected readonly _minMaxLookahead?: Interval;
	/**
	 * Earliest token index that might be affected by a change to this token.
	 */
	public lookBehind: number;

	public marked: boolean = false;
	constructor(
		type: number,
		text?: string,
		@NotNull
		source: {
			source?: TokenSource;
			stream?: CharStream;
		} = CommonToken.EMPTY_SOURCE,
		channel: number = Token.DEFAULT_CHANNEL,
		start: number = 0,
		stop: number = 0,
		lookahead?: Interval,
	) {
		super(type, text, source, channel, start, stop);
		this._minMaxLookahead = lookahead;
	}

	/**
	 * Constructs a new {@link IncrementalCommonToken} as a copy of another {@link Token}.
	 *
	 * If `oldToken` is also a {@link IncrementalCommonToken} instance, the newly
	 * constructed token will share a reference to the {@link #text} field and
	 * the {@link Tuple2} stored in {@link #source}. Otherwise, {@link #text} will
	 * be assigned the result of calling {@link #getText}, and {@link #source}
	 * will be constructed from the result of {@link Token#getTokenSource} and
	 * {@link Token#getInputStream}.
	 *
	 * @param oldToken The token to copy.
	 */
	public static fromToken(@NotNull oldToken: Token): IncrementalCommonToken {
		let minMax: Interval | undefined;
		if (oldToken instanceof IncrementalCommonToken) {
			minMax = oldToken.minMaxLookahead;
		}
		let result: IncrementalCommonToken = new IncrementalCommonToken(
			oldToken.type,
			undefined,
			CommonToken.EMPTY_SOURCE,
			oldToken.channel,
			oldToken.startIndex,
			oldToken.stopIndex,
			minMax,
		);
		result.line = oldToken.line;
		result.index = oldToken.tokenIndex;
		result.charPositionInLine = oldToken.charPositionInLine;

		if (oldToken instanceof IncrementalCommonToken) {
			result._text = oldToken._text;
			result.source = oldToken.source;
		} else {
			result._text = oldToken.text;
			result.source = {
				source: oldToken.tokenSource,
				stream: oldToken.inputStream,
			};
		}

		return result;
	}
	public get minMaxLookahead(): Interval {
		if (this._minMaxLookahead === undefined) {
			return Interval.of(0, 0);
		}
		return this._minMaxLookahead;
	}
}
