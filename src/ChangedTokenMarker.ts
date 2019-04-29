/*!
 * Copyright 2016 The ANTLR Project. All rights reserved.
 * Licensed under the BSD-3-Clause license. See LICENSE file in the project root for license information.
 */

import { TextChange } from "./TextChange";
import { IncrementalCommonToken } from "./IncrementalCommonToken";
import { Interval } from "./misc";

/**
 * This class is used to mark tokens in the lexing stream that may have been changed by a given set of text changes.
 */
export class ChangedTokenMarker {
	/**
	 * Find the position of the first token directly affected by a text change.
	 *
	 * @param change Text change
	 * @param tokens Set of tokens
	 * @param low Lowest token index to consider (must be in the range 0..high)
	 * @param high Highest token index to consider (must be in the range 0..tokens.length-1)
	 */
	private static findPosition(
		change: TextChange,
		tokens: IncrementalCommonToken[],
		low: number,
		high: number,
	): number {
		// Find the leftmost affected token
		let result = -1;

		while (low <= high) {
			const mid: number = (low + high) >>> 1;
			const midToken = tokens[mid];
			if (
				midToken.stopIndex >= change.start &&
				midToken.startIndex <= change.start
			) {
				result = mid;
				high = mid - 1;
			} else if (midToken.stopIndex >= change.start) {
				high = mid - 1;
			} else {
				low = mid + 1;
			}
		}
		return result;
	}
	/**
	 * Process a set of text changes by marking the tokens it affects as changed.
	 *
	 * @param changes Set of text changes to process
	 * @param tokens Set of tokens to
	 * @param minMaxLookahead Minimum/Maximum lookahead that the stream saw.
	 */
	public static markChangedTokens(
		changes: TextChange[],
		tokens: IncrementalCommonToken[],
		minMaxLookahead: Interval,
	) {
		const maxAffectedTokens = Math.max(
			Math.abs(minMaxLookahead.a),
			minMaxLookahead.b,
		);

		changes.sort((a, b) => {
			return a.start - b.start;
		});
		let low: number = 0;
		let high: number = tokens.length - 1;
		/* For each text change, find the position in the token stream it affects, and mark the changed tokens. */
		for (let change of changes) {
			const tokenIndex = this.findPosition(change, tokens, low, high);
			// Make sure it affects a token
			if (tokenIndex === -1) {
				continue;
			}
			// Mark the tokens within the direct range of the change
			if (change.newEnd) {
				this.markTokensForwardsFrom(tokens, tokenIndex, change.newEnd);
			}
			// Mark the tokens that could have depended on the change
			this.markTokensBackwardsFrom(tokens, tokenIndex, maxAffectedTokens);
			// Delete removed tokens
			if (change.newEnd === 0) {
				this.markDeletedTokensForwardsFrom(tokens, tokenIndex, change);
			}
			// Slide the low index left, since later changes can't find a token earlier than the one we just found.
			low = tokenIndex;
			// Process the effect of the change on the offets.
		}
	}

	/**
	 * Mark a group of tokens as changed
	 *
	 * This function starts at startIndex and marks numTokenstokens as changed, working backwards.
	 *
	 * @param tokens List of tokens
	 * @param startIndex Token index to start
	 * @param numTokens number of >0 length tokens to mark
	 */
	private static markTokensBackwardsFrom(
		tokens: IncrementalCommonToken[],
		startIndex: number,
		numTokens: number,
	) {
		let remainingTokenCount = numTokens;
		let currIdx = startIndex;
		while (currIdx >= 0 && remainingTokenCount >= 0) {
			let currToken = tokens[currIdx];
			currToken.marked = true;
			// Don't decrement count for zero length tokens
			if (currToken.startIndex <= currToken.stopIndex) {
				--remainingTokenCount;
			}
			--currIdx;
		}
	}
	/**
	 * Mark deleted tokens forward from the starting point.
	 *
	 * @param tokens List of tokens
	 * @param startIndex  Token index to start
	 * @param change Text Change covering the deletion
	 */
	private static markDeletedTokensForwardsFrom(
		tokens: IncrementalCommonToken[],
		startIndex: number,
		change: TextChange,
	) {
		for (let i = startIndex; i < tokens.length; ++i) {
			let token = tokens[i];
			// If the token is contained fully within the change than it is deleted
			if (
				token.startIndex >= change.start &&
				token.stopIndex <= change.oldEnd
			) {
				token.deleted = true;
			}
			// Stop when we pass the end of the change
			if (token.startIndex > change.oldEnd) { return; }
		}
	}
	/**
	 * Mark changed tokens forward from the starting point.
	 *
	 * @param tokens List of tokens
	 * @param startIndex  Token index to start
	 * @param stopCharPos Character position to stop at
	 */
	private static markTokensForwardsFrom(
		tokens: IncrementalCommonToken[],
		startIndex: number,
		stopCharPos: number,
	) {
		for (let i = startIndex; i < tokens.length; ++i) {
			let token = tokens[i];
			if (token.startIndex > stopCharPos) {
				return;
			}
			token.marked = true;
		}
	}
}
