/*!
 * Copyright 2016 The ANTLR Project. All rights reserved.
 * Licensed under the BSD-3-Clause license. See LICENSE file in the project root for license information.
 */

import { CharStream } from "./CharStream";
import { Interval } from "./misc/Interval";

/**
 * A source of characters for an ANTLR lexer that tracks
 *  how much lookahead is being used.
 */
export interface LookaheadTrackingCharStream extends CharStream {
	minMaxLookahead: Interval;
	/** This method returns the minimum/maximum amount of lookahead used
	 * since the last reset.
	 * @returns Amount of lookahead
	 */

	/**
	 * This method resets the minimum/maximum lookahead tracking.
	 */
	resetMinMaxLookahead(): void;
}
