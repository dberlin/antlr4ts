import { CommonToken } from "./CommonToken";
/**
 *  Definition of a token change:
 *  ADDED = A new token that did not exist before
 *  CHANGED = A token that was in the stream before but changed in some way.
 *  REMOVED = A token that no longer exists in the stream.
 *
 * Token changes may *not* overlap in position.
 * You also need to account for hidden tokens (but not *skipped* ones).
 */
export enum TokenChangeType {
	ADDED,
	CHANGED,
	REMOVED,
}
export interface TokenChange {
	changeType: TokenChangeType;
	newToken?: CommonToken;
	oldToken?: CommonToken;
}
