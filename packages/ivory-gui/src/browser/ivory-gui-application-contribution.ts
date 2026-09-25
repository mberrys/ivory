// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { injectable } from '@theia/core/shared/inversify';

@injectable()
export class IvoryGuiApplicationContribution implements FrontendApplicationContribution {
    initialize(): void {
        document.documentElement.dataset.ivoryGui = 'prototype';
    }

    onStop(): void {
        delete document.documentElement.dataset.ivoryGui;
    }
}
