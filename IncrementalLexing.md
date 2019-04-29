#### Incremental lexing

### Basics

We'll start by explaining how incremental lexing works in a slightly simplified model, then extend it to all the things ANTLR does, and explain how we store the data.

Our simplified model of a lexer that we start with is that a lexer is a thing that looks at characters, and recognizes them into tokens. It produces a single token at a time. In our simplified model, we're gonna say they have states. In each state, they may do one of the following things:

- Accumulate the current character
  or
- Accept the current set of accumulated characters into a token.
  or
- Transition to a new state using any part of the input stream as part of the decision where to transition.
  or
- Issue an error

There is no other input to the lexer or state.

If you are familiar with DFA's, our state model can be be viewed as a DFA that is allowed to use _any_ part of the input stream as part of the transition function.

An incremental lexer is one that only re-lexes tokens that could have changed given a set of edits to the input stream. Ideally, it performs the minimal set of re-lexing possible.

Let's start by talking about what can actually change our simplified lexer's mind about a token.
If you look at the above simplified lexer, it should hopefully be fairly obvious that if you change the input stream, the only things that can be affected are the accumulation of characters and the state transitioning. The accumulation of characters is easy to handle - it is directly affected by a text change and all tokens in that text change must be relexed.  
This leaves looking at the input stream as the main way the lexer may be affected that we need to handle.

To know what tokens might be affected by a change in the input stream, we therefore have to know where the lexer was looking. If we do that, we can say "pleease re-lex any token between us and where the lexer looked".

This is in fact, exactly how the incremental lexer works.

### Basic incremental lexing

The way this is implemented is to have an input stream that tracks how far lookahead went on each token. ANTLR has a standardized interface to looking ahead in input streams and creating token, and so for each token we track how far it looked ahead (or behind) and store it on each token. When an input stream changes, we re-lex tokens that looked into the changed area.

This actually covers the vast majority of what ANTLR's lexers can do. No matter whether the look ahead, behind, we will see where they looked and track it. It is technically possible to do discontiguous range lookahead tracking , but it turns out not to be worth it for any practical lexer. For real-world lexers, lookahead is normally continuous - they look at whether 'next character is "!"' and 'character after is "="' and 'character after that is "="', not just 'is the third character after us "="'. As such, we re-lex any tokens between the earliest token affected and the current one.

### Practical simplification

The optimal algorithm (given in the reference below) for computing changes takes into account per-token lookahead, and only recomputes exactly the tokens necessary.For simplicity, we do not use this data at the moment.
Instead, we track the maximum lookahead overall used by the input stream. This is then used for all tokens. For a given token that is directly changed, we mark all consecutive zero length tokens + N length 1+ tokens in each direction, where N is the max lookahead that was used in the stream. This is the maximal set of tokens that could have changed with N character lookahead.

This avoids computation and fixup of earliest changed token information. Given that the vast majority of lexer grammars are max of either 1 or 2 character lookahead, it does not seem worth complex computation of changed data to save maybe a token worth of relex per change.
Note that this is simply what is relexed. We properly hand optimal changed token information to the parser (IE relexed tokens that end up the same as the old token are not marked as changed for the parser).

### Handling modes

While the ANTLR lexer is mostly stateless, ANTLR allows lexer modes.
We handle these by storing and restoring the mode stack necessary to reprocess a given token.

### Handling actions

Incremental lexers are fundamentally incompatible with actions that are stateful.
Past that, actions are run as normal when a given token is re-lexed.

### Outstanding issues

- We could make things a lot faster/easier in the case when we know we are using an incremental lexer and incremental parser from ANTLR together, or at least an IncrementalTokenStream reading from the lexer.
  The interface to the lexer used by normal token streams is calling nextToken, which is a waste of time because the lexer can easily know the set of tokens that might have changed (and so currently wastes time returning the unchanged tokens).
  In that case, we'd modify the IncrementalParser class to either call the incremental lexer , or create an IncrementalLexingTokenStream class to only reprocess changes instead of all tokens.

- If we rely on incremental parser driving incremental lexer, incremental parser can actually say what tokens are acceptable in a given place. We can also only relex tokens that can change a given rule.

#### References

Practical algorithms for incremental software development: https://www2.eecs.berkeley.edu/Pubs/TechRpts/1997/5885.html
