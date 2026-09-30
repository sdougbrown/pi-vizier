# @dougbots/pi-vizier

> A silver-tongued, unctuous court eunuch who appraises your coding agent's last turn.

You have a coding agent. The agent has opinions about your code. Who watches the
watcher? The Vizier does.

After each turn (or on demand), pi-vizier sends the agent's most recent response
to a second, pre-configured model that answers as the Imperial Vizier —
obsequious to you, quietly treasonous about the agent. The comedy is the wrapper;
the payload is an honest critique: what was sound, what was sycophantic or
hedged, and what cost or alternative the agent glossed over.

## Install

```sh
pi install npm:@dougbots/pi-vizier               # from npm
pi install git:github.com/sdougbrown/pi-vizier   # or straight from git
```

## Configure

Point the Vizier at any model your pi install has credentials for — a cheap,
fast local or flash-tier model is ideal, since it gets called after every turn
in auto mode:

```sh
export PI_VIZIER_MODEL=provider/modelId
```

## Usage

| Command | Effect |
|---|---|
| `/vizier` | Full appraisal of the agent's last turn, rendered in an overlay |
| `/vizier on` | Auto mode: a one-line whispered verdict after every agent turn |
| `/vizier off` | The court is dismissed |
| `/vizier model` | Pick the Vizier's model from your available models (native picker, persisted) |
| `/vizier provider/modelId` | Override the Vizier's brain for one appraisal |

The picked model persists to `~/.pi/agent/vizier.json`. Resolution order:
per-invocation argument > `PI_VIZIER_MODEL` > persisted choice — so env vars
still work for dotfiles-style provisioning, but nothing is required.

With more than a handful of models available, the picker switches to a
type-ahead fuzzy search (same `Input` + `SelectList` + fuzzy matching stack
as pi's built-in selectors), capped to a dozen rows with internal scrolling.

## Sample output

```
A most... architectural answer, your majesty. One that builds the house and
then asks you which room to sleep in.

The substance: The agent updated the prompt to mandate variety, confirmed
the file's location, and proposed a pi-package structure for the repo —
then punted two sequencing decisions back to you.

Sound: The "test live before extracting" lean is genuinely wise. A package
born from a file that's never been shaken out is a package born broken.

Hedged: "Name TBD" is a fig leaf over a decision it could have made. And
those "two sequencing questions" are the agent's way of saying I will not
commit to a plan while sounding like it is consulting your wisdom. It is
not consulting. It is shirking.

Glossed over: That symlink dependency. The agent mentions "the local copy
goes away" in passing, as though it's a small housekeeping matter. It is
the entire reason you need to sequence the extraction correctly.

I would have told you: commit to dotfiles now, shake out tomorrow, extract
when the API stops arguing. One sentence. No questions.

Your majesty's vizier bows, and does not ask you where to sleep.
```

The Vizier varies his courtly address each time — a vizier who repeats himself
is a vizier who has stopped listening.

## License

MIT
