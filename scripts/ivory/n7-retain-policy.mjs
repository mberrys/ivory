// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// @ts-check
/**
 * Retention policy for the N7 evidence record.
 *
 * The merged N7 line carries two retention toolings: the spike tooling (`scripts/n7/verify.mjs`, which
 * retains a reviewed live-provider run and writes the `bounded-experiment-pass` decision the N-gate
 * manifest's `closedWhen` expects) and the canonical retention (`scripts/ivory/n7-retain.mjs`, which
 * re-runs the deterministic suite and can only observe that a provider is *configured*, never that one
 * ran). Without a shared policy a deterministic re-run silently replaced the retained live-provider
 * evidence with `not-run` and rewrote the decision, which opened the N7 gate that the retained evidence
 * supports. These two pure rules keep a re-run from discarding retained evidence or changing the
 * vocabulary the gate reads.
 */

/** Decisions the N7 record may carry, matching `configs/ivory-n-gates.json#gates[N7].closedWhen`. */
export const N7_DECISIONS = ['bounded-experiment-pass', 'deterministic-pass-live-provider-open', 'failed-or-incomplete'];

/**
 * A reviewed live-provider run is retained evidence: a later deterministic re-run may not overwrite it,
 * because that run did not re-observe the provider. The retained block is carried forward verbatim apart
 * from two provenance fields that record why it is unchanged.
 */
export function retainedLiveProvider(previous, options = {}) {
    const prior = previous?.liveProvider;
    if (prior?.status === 'run') {
        return {
            ...prior,
            carriedForwardFrom: previous?.observedAt,
            carryForwardReason:
                'A reviewed live-provider run is already retained; this deterministic re-run did not re-observe it.',
        };
    }
    if (options.liveConfigured === true) {
        return {
            status: 'not-run-in-retain',
            reason: 'Live qualification is opt-in via N7_ENDPOINT / N7_MODEL / N7_API_KEY and a reviewed digest prompt.',
        };
    }
    return {
        status: 'not-run',
        reason: 'Live qualification is opt-in and requires researcher review of exact transmission and proposal digests.',
    };
}

/**
 * `bounded-experiment-pass` is the only decision the N7 gate closes on, and it requires both a passing
 * deterministic suite and a retained live-provider observation. A passing suite with no live evidence is
 * explicitly not the bounded pass.
 */
export function retainedDecision({ testsPassed, liveRetained }) {
    if (testsPassed !== true) return 'failed-or-incomplete';
    return liveRetained === true ? 'bounded-experiment-pass' : 'deterministic-pass-live-provider-open';
}
