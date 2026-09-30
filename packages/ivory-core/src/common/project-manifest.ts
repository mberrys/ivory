// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { ExactRef, IvoryContractError } from '@ivory/contracts';
import { IvoryStoreError, StoreProtocol } from './store-protocol';

export type ProjectRole = 'live' | 'backup' | 'capsule';

/** The `ivory-project.json` at the root of a project directory. */
export interface ProjectManifest {
    readonly format: 'ivory-project@1';
    readonly projectId: string;
    readonly storeInstanceId: string;
    readonly role: ProjectRole;
}

export namespace ProjectManifest {
    export const FILE_NAME = 'ivory-project.json';
    export const FORMAT = 'ivory-project@1';
    export const ROLES: readonly ProjectRole[] = ['live', 'backup', 'capsule'];
    const FIELDS = ['format', 'projectId', 'role', 'storeInstanceId'].join(',');

    /** Parses a project id with the same rules as the ids of an {@link ExactRef}. */
    export function parseProjectId(value: unknown): string {
        try {
            return ExactRef.parse({ projectId: value, objectId: 'project', revisionId: 'project' }).projectId;
        } catch (error) {
            if (error instanceof IvoryContractError) {
                throw new IvoryStoreError('invalid-argument',
                    `a project id is a non-blank string of at most ${StoreProtocol.MAX_ID_LENGTH} characters other than '${ExactRef.LATEST}'`);
            }
            throw error;
        }
    }

    /** Validates a parsed manifest. Anything but exactly the four fields is malformed. */
    export function parse(value: unknown): ProjectManifest {
        if (typeof value !== 'object' || !value || Array.isArray(value) || Object.keys(value).sort().join(',') !== FIELDS) {
            throw new IvoryStoreError('invalid-manifest', `${FILE_NAME} must have exactly the fields ${FIELDS.split(',').join(', ')}`);
        }
        const manifest = value as Record<string, unknown>;
        if (manifest.format !== FORMAT) {
            throw new IvoryStoreError('invalid-manifest', `${FILE_NAME} format must be ${FORMAT}`);
        }
        if (!ROLES.includes(manifest.role as ProjectRole)) {
            throw new IvoryStoreError('invalid-manifest', `${FILE_NAME} role must be one of ${ROLES.join(', ')}`);
        }
        if (!StoreProtocol.isIdentifier(manifest.storeInstanceId) || !StoreProtocol.isIdentifier(manifest.projectId)) {
            throw new IvoryStoreError('invalid-manifest', `${FILE_NAME} ids must be non-blank strings of at most ${StoreProtocol.MAX_ID_LENGTH} characters`);
        }
        return Object.freeze({
            format: FORMAT,
            projectId: parseManifestProjectId(manifest.projectId),
            storeInstanceId: manifest.storeInstanceId,
            role: manifest.role as ProjectRole
        });
    }

    function parseManifestProjectId(value: string): string {
        try {
            return parseProjectId(value);
        } catch (error) {
            throw new IvoryStoreError('invalid-manifest', `${FILE_NAME} has an invalid projectId`);
        }
    }
}
