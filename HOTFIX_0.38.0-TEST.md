# PROSPECT 0.38.0 real-time pass test hotfix

## Cause

The physical-pass regression test moved all defenders away from the play. Under that valid game state, the receiver can catch the pass and run into the end zone. The test incorrectly allowed only `completion` and `incomplete`, so a legitimate `touchdown` failed CI.

## Fix

The test now verifies its actual invariant:

- no interception event;
- no turnover;
- the pass ends as a completion, incompletion, or touchdown.

The football engine itself is unchanged.
