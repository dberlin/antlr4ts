/*!
 * Copyright 2016 The ANTLR Project. All rights reserved.
 * Licensed under the BSD-3-Clause license. See LICENSE file in the project root for license information.
 */

// ConvertTo-TS run at 2016-10-04T11:26:50.3010112-07:00

import { CharStream } from "./CharStream";
import { Override } from "./Decorators";
import { TokenFactory } from "./TokenFactory";
import { TokenSource } from "./TokenSource";
import { Interval } from "./misc/Interval";
import { CommonTokenFactory } from "./CommonTokenFactory";

import { IncrementalTokenFactory } from "./IncrementalTokenFactory";
import { IncrementalCommonToken } from "./IncrementalCommonToken";

/**
 * This default implementation of {@link TokenFactory} creates
 * {@link IncrementalCommonToken} objects.
 */
export class IncrementalCommonTokenFactory extends CommonTokenFactory implements IncrementalTokenFactory {
	/**
	 * Constructs a {@link IncrementalCommonTokenFactory} with the specified value for
	 * {@link #copyText}.
	 *
	 * When `copyText` is `false`, the {@link #DEFAULT} instance
	 * should be used instead of constructing a new instance.
	 *
	 * @param copyText The value for {@link #copyText}.
	 */
	constructor(copyText: boolean = false) {
		super(copyText);
	}

	@Override
	public createWithLookahead(
		source: { source?: TokenSource, stream?: CharStream },
		type: number,
		text: string | undefined,
		channel: number,
		start: number,
		stop: number,
		line: number,
		charPositionInLine: number,
		minMaxLookahead: Interval): IncrementalCommonToken {
		let t: IncrementalCommonToken = new IncrementalCommonToken(type, text, source, channel, start, stop,
			minMaxLookahead);
		t.line = line;
		t.charPositionInLine = charPositionInLine;
		if (text == null && this.copyText && source.stream != null) {
			t.text = source.stream.getText(Interval.of(start, stop));
		}

		return t;
	}

	@Override
	public createSimple(type: number, text: string): IncrementalCommonToken {
		return new IncrementalCommonToken(type, text);
	}
}

export namespace IncrementalCommonTokenFactory {
	/**
	 * The default {@link IncrementalCommonTokenFactory} instance.
	 *
	 * This token factory does not explicitly copy token text when constructing
	 * tokens.
	 */
	export const DEFAULT: TokenFactory = new IncrementalCommonTokenFactory();
}
