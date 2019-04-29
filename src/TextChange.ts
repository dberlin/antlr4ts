/*!
 * Copyright 2016 The ANTLR Project. All rights reserved.
 * Licensed under the BSD-3-Clause license. See LICENSE file in the project root for license information.
 */

import { Interval } from "./misc";

/**
 * Changes are (start, oldEnd) -> (start, newEnd)
 * Adds are (start, start) -> (start, newEnd)
 * Removes are (start, oldEnd) -> (start, 0)
 */
export class TextChange {
	public start: number;
	public oldEnd: number;
	public newEnd: number;

	constructor(start: number, oldEnd: number, newEnd: number) {
		this.start = start;
		this.oldEnd = oldEnd;
		this.newEnd = newEnd;
	}
	/**
	 * Return the amount a stream is offset by this TextChange.
	 *
	 */
	public getOffset(): number {
		// If it is a change, it's offset by the amount it changes
		if (this.oldEnd !== 0 && this.newEnd !== 0) {
			return this.newEnd - this.oldEnd;
		} else if (this.newEnd !== 0) {
			// Adds are offset by the amount added
			return this.newEnd - this.start;
		} else {
			// Removes are offset by the amount subtracted
			return 0 - (this.oldEnd - this.start);
		}
	}
}
