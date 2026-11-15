# pstack model configuration. One line per role. Delete a line to fall back to the skill default.
# `inherit-parent` or `auto` as a value: the role runs on the parent chat model (omit Task `model`). Alias entries in a panel list still count toward its fan-out.
# Tuned for a Claude Pro plan: no Fable (not guaranteed on the plan), two-model panels to save usage.
# Panels are all Claude, so arena cross-judging (needs another vendor) is skipped.
# defaults: 2
# budget: medium (high)
feature, refactoring: opus high
bug-fix: opus high
perf-issue: opus high
hillclimb: opus high
judgment and prose: opus high
hardest tasks: opus xhigh
reflect tooling: sonnet medium
reflect judgment, divergent, synthesizer: opus high
arena runners: opus medium, sonnet medium
arena cross-judge pool: opus medium, sonnet medium
swarm workers: sonnet medium
architect runners: opus medium, sonnet medium
interrogate reviewers: opus medium, sonnet medium
