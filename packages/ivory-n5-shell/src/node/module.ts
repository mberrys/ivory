// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
import { ContainerModule, inject, injectable } from '@theia/core/shared/inversify';
import { BackendApplicationContribution, EarlyExpressMiddleware } from '@theia/core/lib/node/backend-application';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { PluginScanner } from '@theia/plugin-ext';
import { CandidateScanner } from './scanner';

// Same-origin, streaming transport proxy only. No service lifecycle or persistence.
//
// It registers as EARLY express middleware on purpose. The `@theia/filesystem`
// download endpoint registers a global `bodyParser.json()` during its own
// `configure()`, and any proxy registered through a later `configure()` receives
// an already-consumed request stream. Observed live against the canonical service
// on 2026-09-13: every widget POST arrived upstream as `content-length: 0` and the
// service answered `invalid_json`. Early middleware is applied before every
// contribution's `configure()`, so the request body is still intact here and the
// streaming, preserve-the-response contract holds.

const PREFIX = '/n5/service';

export function createServiceProxy(): EarlyExpressMiddleware['handlers'][number] {
    const base = new URL(process.env.IVORY_N5_SERVICE_URL ?? 'http://127.0.0.1:4100');
    if (
        !['http:', 'https:'].includes(base.protocol) ||
        base.username ||
        base.password ||
        base.pathname !== '/' ||
        base.search ||
        base.hash
    ) {
        throw new Error('IVORY_N5_SERVICE_URL must be an HTTP(S) origin without credentials');
    }
    return (req, res, next) => {
        const url = req.url ?? '/';
        const pathname = url.split('?')[0];
        if (pathname !== PREFIX && !pathname.startsWith(`${PREFIX}/`)) {
            next();
            return;
        }
        const search = url.includes('?') ? url.slice(url.indexOf('?')) : '';
        const target = new URL((pathname.slice(PREFIX.length) || '/') + search, base);
        const allowed =
            (req.method === 'GET' && /^\/(health\/ready|v1\/executions\/[^/]+(?:\/events)?)$/.test(target.pathname)) ||
            (req.method === 'POST' &&
                /^\/(v1\/executions|v1\/projects\/open|v1\/citations\/resolve|v1\/runspecs\/resolve|v1\/projects\/edits|v1\/fixtures\/reset)$/.test(
                    target.pathname,
                ));
        if (!allowed || target.origin !== base.origin) {
            res.sendStatus(404);
            return;
        }
        const headers: Record<string, string> = {};
        for (const name of ['accept', 'content-type', 'idempotency-key', 'last-event-id']) {
            const value = req.headers[name];
            if (typeof value === 'string') {
                headers[name] = value;
            }
        }
        const upstream = (base.protocol === 'https:' ? httpsRequest : httpRequest)(target, { method: req.method, headers }, response => {
            res.status(response.statusCode ?? 502);
            for (const name of ['content-type', 'cache-control']) {
                const value = response.headers[name];
                if (value) {
                    res.setHeader(name, value);
                }
            }
            response.on('error', () => res.destroy());
            response.pipe(res);
        });
        upstream.on('error', () => {
            if (!res.headersSent) {
                res.status(502).json({ error: { code: 'service_unavailable' } });
            } else {
                res.destroy();
            }
        });
        res.on('close', () => upstream.destroy());
        req.on('aborted', () => upstream.destroy());
        req.pipe(upstream);
    };
}

@injectable()
export class N5ServiceProxyContribution implements BackendApplicationContribution {
    @inject(EarlyExpressMiddleware) protected readonly earlyMiddleware: EarlyExpressMiddleware;

    initialize(): void {
        this.earlyMiddleware.handlers.push(createServiceProxy());
    }
}

export default new ContainerModule((bind, _unbind, _isBound, rebind) => {
    rebind(PluginScanner).to(CandidateScanner).inSingletonScope();
    bind(N5ServiceProxyContribution).toSelf().inSingletonScope();
    bind(BackendApplicationContribution).toService(N5ServiceProxyContribution);
});
