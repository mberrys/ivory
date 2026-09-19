// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

/**
 * The N5 fixture runtime stamps every research response (reset, project open,
 * citation resolution, RunSpec resolution, edit) with its clock. The four-client
 * equivalence observation requires the clients to read byte-identical resolutions
 * from one equivalent state, so the fixture clock can be pinned to a single
 * reading via `IVORY_N5_FIXTURE_CLOCK` (ISO-8601). Unset — the default — keeps
 * the real clock. This is a fixture capability for reproducible qualification of
 * the fixture runtime, not a production behavior: no execution, admission or
 * durability timestamp reads this clock.
 */
export function fixtureClockOption(value: string | undefined): { clock?: () => Date } {
    if (value === undefined || value.length === 0) {
        return {};
    }
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(value) || Number.isNaN(new Date(value).getTime())) {
        throw new Error(`IVORY_N5_FIXTURE_CLOCK must be an ISO-8601 UTC timestamp; received ${JSON.stringify(value)}.`);
    }
    const reading = new Date(value);
    return { clock: () => new Date(reading) };
}
