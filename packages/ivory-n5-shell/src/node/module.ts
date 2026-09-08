// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
import { ContainerModule } from '@theia/core/shared/inversify';
import { BackendApplicationContribution } from '@theia/core/lib/node/backend-application';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { PluginScanner } from '@theia/plugin-ext';
import { CandidateScanner } from './scanner';

// Same-origin, streaming transport proxy only. No service lifecycle or persistence.
export default new ContainerModule((bind, _unbind, _isBound, rebind) => {
    rebind(PluginScanner).to(CandidateScanner).inSingletonScope();
    bind<BackendApplicationContribution>(BackendApplicationContribution).toConstantValue({
        configure: app => {
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
            app.use('/n5/service', (req, res) => {
                const url = new URL(req.url, base);
                const allowed =
                    (req.method === 'GET' && /^\/(health\/ready|v1\/executions\/[^/]+(?:\/events)?)$/.test(url.pathname)) ||
                    (req.method === 'POST' &&
                        /^\/(v1\/executions|v1\/projects\/open|v1\/citations\/resolve|v1\/runspecs\/resolve|v1\/projects\/edits|v1\/fixtures\/reset)$/.test(url.pathname));
                if (!allowed || url.origin !== base.origin) {
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
                const upstream = (base.protocol === 'https:' ? httpsRequest : httpRequest)(
                    url,
                    { method: req.method, headers },
                    response => {
                        res.status(response.statusCode ?? 502);
                        for (const name of ['content-type', 'cache-control']) {
                            const value = response.headers[name];
                            if (value) {
                                res.setHeader(name, value);
                            }
                        }
                        response.on('error', () => res.destroy());
                        response.pipe(res);
                    },
                );
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
            });
        },
    });
});
