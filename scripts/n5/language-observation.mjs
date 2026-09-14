// @ts-check
'use strict';

// N5 language-surface observation — protocol item 5, in the built workbench.
// Drives the real UI (palette, editor, terminals) against a shell started with
// examples/ivory-n5-browser as its workspace root. The xterm terminal uses the
// canvas renderer, so terminal DISPLAY text has no DOM: executions are observed
// through a widget-region screenshot plus the command's own output file opened
// in the editor. Records what actually works and what does not under
// artifacts/n5/language/; nothing here decides the gate.

import { createRequire } from 'node:module';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workspace = path.join(root, 'examples', 'ivory-n5-browser');
const artifacts = path.join(root, 'artifacts', 'n5');
const languageDir = path.join(artifacts, 'language');
mkdirSync(languageDir, { recursive: true });
const shellUrl = (process.env.IVORY_N5_SHELL_URL ?? 'http://127.0.0.1:3107').replace(/\/$/, '');
const scratchQmd = path.join(workspace, 'n5-scratch-diagnostic.qmd');
const createdInWorkspace = [];

const { chromium } = createRequire(path.join(workspace, 'package.json'))('playwright');
const surfaces = {};
const consoleLog = [];

function writeJson(relative, value) {
    writeFileSync(path.join(languageDir, relative), JSON.stringify(value, undefined, 2) + '\n');
}

async function record(name, task) {
    console.log(`-- ${name}`);
    try {
        const outcome = await task();
        surfaces[name] = outcome;
        writeJson(`${name}.json`, outcome);
        console.log(`   ${outcome.outcome}: ${outcome.summary ?? outcome.reason ?? ''}`);
    } catch (error) {
        surfaces[name] = { outcome: 'not-observed', reason: String(error) };
        writeJson(`${name}.json`, surfaces[name]);
        console.log(`   not-observed: ${String(error)}`);
    }
}

async function openPalette(page) {
    for (let attempt = 0; attempt < 6; attempt += 1) {
        await page.keyboard.press('Control+Shift+P');
        try {
            await page.waitForSelector('.quick-input-widget input', { state: 'visible', timeout: 2500 });
            return;
        } catch {
            await page.waitForTimeout(400);
        }
    }
    throw new Error('command palette did not open');
}

async function paletteCommand(page, query, rowPattern) {
    await openPalette(page);
    await page.keyboard.type(query, { delay: 25 });
    const row = page.locator('.quick-input-widget .monaco-list-row').filter({ hasText: rowPattern }).first();
    await row.waitFor({ state: 'visible', timeout: 8000 });
    await row.click();
    await page.waitForTimeout(400);
}

async function openFile(page, fileName) {
    await paletteCommand(page, 'File: Open File', /Open File/);
    await page.waitForSelector('.quick-input-widget input', { state: 'visible', timeout: 8000 });
    const input = page.locator('.quick-input-widget input').first();
    await input.click();
    await input.fill(fileName);
    const row = page.locator('.quick-input-widget .monaco-list-row').filter({ hasText: fileName }).first();
    await row.waitFor({ state: 'visible', timeout: 10000 });
    await row.click();
    // Editor contents paint only after the editor attaches; wait for the render.
    await page.waitForFunction(() => document.querySelectorAll('.view-line').length > 0, undefined, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);
}

async function editorLines(page) {
    return page.evaluate(() =>
        Array.from(document.querySelectorAll('.view-line')).map(line => (line.textContent ?? '').replace(/\u00a0/g, ' ')),
    );
}

async function editorTabs(page) {
    return page.evaluate(() => Array.from(document.querySelectorAll('.theia-tabBar-tabLabel, .p-TabBar-tabLabel')).map(tab => tab.textContent ?? ''));
}

async function highlighting(page) {
    return page.evaluate(() => {
        const editor = document.querySelector('.monaco-editor.focused') ?? document.querySelector('.monaco-editor');
        const root = editor ?? document;
        const tokens = Array.from(root.querySelectorAll('.view-line span[class*="mtk"]')).filter(span => (span.textContent ?? '').length > 0);
        const seen = new Set();
        const samples = [];
        for (const token of tokens) {
            const cls = token.className;
            if (seen.has(cls)) {
                continue;
            }
            seen.add(cls);
            samples.push({
                text: (token.textContent ?? '').slice(0, 24),
                cls,
                inlineColor: token.style.color,
                computedColor: window.getComputedStyle(token).color,
            });
            if (samples.length >= 10) {
                break;
            }
        }
        return { tokenCount: tokens.length, distinctStyles: samples };
    });
}

async function cursorPosition(page) {
    return page.evaluate(() => {
        const bar = document.querySelector('#theia-statusBar') ?? document.querySelector('.theia-statusBar') ?? document.body;
        const match = (bar.textContent ?? '').match(/Ln (\d+), Col (\d+)/);
        return match ? { line: Number(match[1]), column: Number(match[2]) } : null;
    });
}

async function tokenSpan(page, text, occurrence, waitMs = 12000) {
    const spans = page.locator('.view-line span').filter({ hasText: new RegExp(`^${text}$`) });
    const deadline = Date.now() + waitMs;
    let count = 0;
    for (;;) {
        count = await spans.count();
        if (count > occurrence || Date.now() > deadline) {
            break;
        }
        await page.waitForTimeout(400);
    }
    return { count, locator: spans.nth(occurrence) };
}

async function hoverOverSpan(page, locator, timeoutMs = 15000) {
    const box = await locator.boundingBox();
    if (box === null) {
        return null;
    }
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        const text = await page.evaluate(() => {
            const hover = document.querySelector('.monaco-hover');
            return hover !== null && hover.offsetHeight > 0 ? (hover.textContent ?? '') : null;
        });
        if (text !== null && text.trim().length > 0) {
            return text;
        }
        if (Date.now() > deadline) {
            return null;
        }
        await page.waitForTimeout(400);
    }
}

async function dismissHover(page) {
    await page.mouse.move(5, 5);
    await page.waitForTimeout(500);
}

async function waitForDiagnostics(page, timeoutMs = 30000) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        const marks = await page.evaluate(() =>
            Array.from(document.querySelectorAll('.squiggly-error, .squiggly-warning, .squiggly-info')).map(mark => ({
                cls: mark.className,
                line: mark.closest('.view-line')?.textContent?.slice(0, 100) ?? null,
            })),
        );
        if (marks.length > 0) {
            return marks;
        }
        if (Date.now() > deadline) {
            return [];
        }
        await page.waitForTimeout(750);
    }
}

async function ensureTerminal(page) {
    if ((await page.locator('.xterm').count()) === 0) {
        await paletteCommand(page, 'Terminal: Create New Terminal', /Create New Terminal/);
        await page.waitForSelector('.xterm-screen', { state: 'visible', timeout: 30000 });
        await page.waitForTimeout(4000);
    }
}

async function runInTerminal(page, command, waitMs = 8000) {
    await ensureTerminal(page);
    await page.locator('.xterm-screen').first().click();
    await page.waitForTimeout(500);
    await page.keyboard.type(command, { delay: 12 });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(waitMs);
}

async function terminalScreenshot(page, name) {
    const file = path.join(languageDir, name);
    await page.locator('.xterm').first().screenshot({ path: file });
    return path.relative(root, file).split(path.sep).join('/');
}

async function completionProbe(page, targetLineText) {
    const before = await editorLines(page);
    const target = page.locator('.view-line').filter({ hasText: targetLineText }).first();
    await target.click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('squ', { delay: 60 });
    await page.keyboard.press('Control+Space');
    const items = await collectSuggestions(page, 15000);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Control+Z');
    await page.waitForTimeout(400);
    await page.keyboard.press('Control+Z');
    await page.waitForTimeout(400);
    const after = await editorLines(page);
    return { items, bufferRestored: JSON.stringify(after) === JSON.stringify(before) };
}

async function collectSuggestions(page, timeoutMs) {
    let items = [];
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        items = await page.evaluate(() =>
            Array.from(document.querySelectorAll('.suggest-widget .monaco-list-row, .suggest-widget .monaco-icon-label')).map(row => (row.textContent ?? '').slice(0, 80)),
        );
        if (items.length > 0) {
            break;
        }
        await page.waitForTimeout(500);
    }
    return items;
}

async function definitionProbe(page, tokenText, occurrence, expectedLine) {
    let last = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
        const span = await tokenSpan(page, tokenText, occurrence);
        if (span.count <= occurrence) {
            return { outcome: 'not-observed', reason: `${tokenText} token not found (${span.count} occurrences)` };
        }
        await span.locator.click();
        await page.waitForTimeout(700);
        const before = await cursorPosition(page);
        await page.keyboard.press('F12');
        await page.waitForTimeout(3000);
        const after = await cursorPosition(page);
        last = { attempts: attempt + 1, before, after };
        if (after !== null && after.line === expectedLine) {
            return { outcome: 'works', summary: 'definition navigation reaches line 2', ...last };
        }
        await page.waitForTimeout(800);
    }
    return { outcome: 'not-working', summary: `cursor did not reach line ${expectedLine} (landed at ${JSON.stringify(last?.after ?? null)})`, ...last };
}

// Completion probes type into the editor, and the workbench autosaves dirty
// buffers; typing is therefore exercised on scratch copies so the committed
// fixtures are never written to. The copies are removed after the observation.
function scratchCopy(sourceName) {
    const target = path.join(workspace, `n5-probe-${path.basename(sourceName)}`);
    copyFileSync(path.join(workspace, 'fixtures', sourceName), target);
    createdInWorkspace.push(target);
    return path.basename(target);
}

async function closeTab(page, fileName) {
    const tab = page.locator('.lm-TabBar-tab', { has: page.locator('.lm-TabBar-tabLabel', { hasText: fileName }) }).first();
    if ((await tab.count()) === 0) {
        return;
    }
    await tab.hover();
    const close = tab.locator('.lm-TabBar-tabCloseIcon').first();
    if ((await close.count()) > 0) {
        await close.click();
        await page.waitForTimeout(800);
        const dontSave = page.getByRole('button', { name: /Don't Save|Do not save/i }).first();
        if ((await dontSave.count()) > 0) {
            await dontSave.click();
            await page.waitForTimeout(500);
        }
    }
}

async function executionProbe(page, { command, captureName, expect }) {
    await runInTerminal(page, command, 6000);
    const screenshot = await terminalScreenshot(page, `${captureName}.png`);
    const captureFile = `${captureName}.txt`;
    createdInWorkspace.push(path.join(workspace, captureFile));
    await runInTerminal(page, `${command} > ${captureFile}`, 8000);
    await openFile(page, captureFile);
    const lines = (await editorLines(page)).map(line => line.replace(/\u00a0/g, ' '));
    const text = lines.join('\n');
    await dismissHover(page);
    const works = expect.test(text);
    return {
        outcome: works ? 'works' : 'not-working',
        summary: works ? `command output observed (${JSON.stringify(text.trim())})` : `command output missing or unexpected (${JSON.stringify(text.trim())})`,
        commands: { display: command, capture: `${command} > ${captureFile}` },
        terminalScreenshot: screenshot,
        captureFile: `examples/ivory-n5-browser/${captureFile}`,
        editorLines: lines,
        note: 'the workbench terminal renders through xterm canvas (no DOM text); the display is retained as a screenshot and the command output as a file opened in the editor',
    };
}

async function main() {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage();
    page.on('console', message => {
        const entry = { type: message.type(), text: message.text() };
        if (/plugin|extension|languageserver|language server|Quarto|basedpyright|reditorsupport|Activating/i.test(entry.text)) {
            consoleLog.push(entry);
        }
    });
    await page.goto(shellUrl, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'N5 research client', exact: true }).waitFor({ timeout: 180000 });
    await page.bringToFront();
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    console.log('workbench loaded');

    await record('terminal.cwd', async () => {
        await ensureTerminal(page);
        const screenshot = await terminalScreenshot(page, 'terminal-initial.png');
        return { outcome: 'observed', summary: 'workbench terminal created', screenshot };
    });

    // Python surfaces.
    await record('python.highlighting', async () => {
        await openFile(page, 'research.py');
        const tabs = await editorTabs(page);
        const lines = await editorLines(page);
        const highlight = await highlighting(page);
        const works = lines.some(line => line.includes('def square')) && highlight.tokenCount > 5;
        return { outcome: works ? 'works' : 'not-working', summary: works ? `syntax highlighting (${highlight.tokenCount} tokens)` : 'editor or token colouring missing', tabs, lines, highlight };
    });

    await record('python.completion', async () => {
        const scratch = scratchCopy('research.py');
        await openFile(page, scratch);
        const probe = await completionProbe(page, 'print(square');
        await closeTab(page, scratch);
        const works = probe.items.some(item => item.includes('square'));
        return {
            outcome: works ? 'works' : 'not-working',
            summary: works ? 'completion offers square' : `completion did not offer square (${probe.items.length} items)`,
            scratchFile: `examples/ivory-n5-browser/${scratch}`,
            suggestionItems: probe.items.slice(0, 20),
            bufferRestored: probe.bufferRestored,
        };
    });

    await record('python.hover', async () => {
        await openFile(page, 'research.py');
        const span = await tokenSpan(page, 'square', 1);
        if (span.count < 2) {
            return { outcome: 'not-observed', reason: `square token not found (${span.count} occurrences)` };
        }
        const hover = await hoverOverSpan(page, span.locator);
        await dismissHover(page);
        const works = hover !== null && hover.includes('float');
        return { outcome: works ? 'works' : 'not-working', summary: works ? 'hover shows the signature' : 'hover produced no signature', hover: hover?.slice(0, 300) ?? null };
    });

    await record('python.definition', async () => {
        await openFile(page, 'research.py');
        return definitionProbe(page, 'square', 1, 2);
    });

    await record('python.diagnostics', async () => {
        await openFile(page, 'python-diagnostic.py');
        const marks = await waitForDiagnostics(page);
        const works = marks.length > 0;
        let message = null;
        if (works) {
            const span = await tokenSpan(page, 'count', 0);
            if (span.count > 0) {
                message = await hoverOverSpan(page, span.locator, 8000);
                await dismissHover(page);
            }
        }
        return { outcome: works ? 'works' : 'not-working', summary: works ? `basedpyright diagnostic present (${marks.length})` : 'no diagnostic appears', marks: marks.slice(0, 5), message: message?.slice(0, 300) ?? null };
    });

    await record('python.execution', () =>
        executionProbe(page, { command: 'python fixtures/research.py', captureName: 'n5-execution-python', expect: /9\.0/ }),
    );

    // R surfaces.
    await record('r.highlighting', async () => {
        await openFile(page, 'research.R');
        const tabs = await editorTabs(page);
        const lines = await editorLines(page);
        const highlight = await highlighting(page);
        const works = lines.some(line => line.includes('square <-')) && highlight.tokenCount > 3;
        return { outcome: works ? 'works' : 'not-working', summary: works ? `syntax highlighting (${highlight.tokenCount} tokens)` : 'editor or token colouring missing', tabs, lines, highlight };
    });

    await record('r.definition', async () => {
        await openFile(page, 'research.R');
        return definitionProbe(page, 'square', 1, 2);
    });

    await record('r.completion', async () => {
        const scratch = scratchCopy('research.R');
        await openFile(page, scratch);
        const probe = await completionProbe(page, 'print(square');
        await closeTab(page, scratch);
        const works = probe.items.some(item => item.includes('square'));
        return {
            outcome: works ? 'works' : 'not-working',
            summary: works ? 'completion offers square' : `completion did not offer square (${probe.items.length} items)`,
            scratchFile: `examples/ivory-n5-browser/${scratch}`,
            suggestionItems: probe.items.slice(0, 20),
            bufferRestored: probe.bufferRestored,
        };
    });

    await record('r.diagnostics', async () => {
        await openFile(page, 'r-diagnostic.R');
        const marks = await waitForDiagnostics(page);
        const works = marks.length > 0;
        return { outcome: works ? 'works' : 'not-working', summary: works ? `parser diagnostic present (${marks.length})` : 'no diagnostic appears', marks: marks.slice(0, 5) };
    });

    await record('r.execution', () =>
        executionProbe(page, { command: 'Rscript fixtures/research.R', captureName: 'n5-execution-r', expect: /\[1\]\s*9/ }),
    );

    // Quarto surfaces.
    await record('quarto.highlighting', async () => {
        await openFile(page, 'research.qmd');
        const tabs = await editorTabs(page);
        const lines = await editorLines(page);
        const highlight = await highlighting(page);
        const works = lines.some(line => line.includes('Reproducible result')) && highlight.tokenCount > 5;
        return { outcome: works ? 'works' : 'not-working', summary: works ? `syntax display (${highlight.tokenCount} tokens)` : 'editor or token colouring missing', tabs, lines, highlight };
    });

    await record('quarto.completion', async () => {
        const scratch = scratchCopy('research.qmd');
        try {
            await openFile(page, scratch);
            const before = await editorLines(page);
            // Variant 1: frontmatter key completion.
            const frontmatter = page.locator('.view-line').filter({ hasText: 'format: html' }).first();
            await frontmatter.click();
            await page.keyboard.press('End');
            await page.keyboard.press('Enter');
            await page.keyboard.type('form', { delay: 60 });
            await page.keyboard.press('Control+Space');
            const yamlItems = await collectSuggestions(page, 12000);
            await page.keyboard.press('Escape');
            await page.keyboard.press('Control+Z');
            await page.waitForTimeout(400);
            await page.keyboard.press('Control+Z');
            await page.waitForTimeout(400);
            // Variant 2: R chunk completion.
            const chunk = page.locator('.view-line').filter({ hasText: 'square(3)' }).first();
            await chunk.click();
            await page.keyboard.press('End');
            await page.keyboard.press('Enter');
            await page.keyboard.type('squ', { delay: 60 });
            await page.keyboard.press('Control+Space');
            const chunkItems = await collectSuggestions(page, 15000);
            await page.keyboard.press('Escape');
            await page.keyboard.press('Control+Z');
            await page.waitForTimeout(400);
            await page.keyboard.press('Control+Z');
            await page.waitForTimeout(400);
            const after = await editorLines(page);
            const pluginErrors = consoleLog.filter(entry => /reading 'line'|TypeError|completion/i.test(entry.text)).slice(-5);
            const works = yamlItems.length > 0 || chunkItems.length > 0;
            return {
                outcome: works ? 'works' : 'not-working',
                summary: works
                    ? `completion offered items (frontmatter ${yamlItems.length}, chunk ${chunkItems.length})`
                    : 'no completion items appeared in either variant; the extension registers a completion provider (out/main.js) but its hosted provider raised an error on request',
                scratchFile: `examples/ivory-n5-browser/${scratch}`,
                variants: { frontmatterKey: yamlItems.slice(0, 10), rChunk: chunkItems.slice(0, 10) },
                pluginErrors,
                bufferRestored: JSON.stringify(after) === JSON.stringify(before),
            };
        } finally {
            await closeTab(page, scratch);
        }
    });

    await record('quarto.diagnostics', async () => {
        const attempts = [];
        try {
            writeFileSync(scratchQmd, ['---', 'title: "N5 scratch diagnostic"', '---', '', '## Scratch', '', '```{r}', 'answer <- (', '```', ''].join('\n'));
            createdInWorkspace.push(scratchQmd);
            await openFile(page, 'n5-scratch-diagnostic.qmd');
            let marks = await waitForDiagnostics(page, 20000);
            attempts.push({ variant: 'incomplete R expression in chunk', marks: marks.slice(0, 5) });
            if (marks.length === 0) {
                const yamlScratch = path.join(workspace, 'n5-scratch-yaml.qmd');
                writeFileSync(yamlScratch, ['---', 'title: "unterminated', 'format: html', '---', '', '## Scratch', ''].join('\n'));
                createdInWorkspace.push(yamlScratch);
                await openFile(page, 'n5-scratch-yaml.qmd');
                marks = await waitForDiagnostics(page, 20000);
                attempts.push({ variant: 'unterminated YAML string', marks: marks.slice(0, 5) });
            }
        } finally {
            for (const scratch of [scratchQmd, path.join(workspace, 'n5-scratch-yaml.qmd')]) {
                await closeTab(page, path.basename(scratch));
            }
        }
        const works = attempts.some(attempt => attempt.marks.length > 0);
        return { outcome: works ? 'works' : 'not-working', summary: works ? 'diagnostic present' : 'no diagnostic appears for either scratch document', attempts };
    });

    await record('quarto.navigation', async () => {
        await openFile(page, 'research.qmd');
        await page.locator('.view-line').first().click();
        await page.keyboard.press('Control+Shift+O');
        await page.waitForTimeout(1500);
        const rows = await page.evaluate(() => Array.from(document.querySelectorAll('.quick-input-widget .monaco-list-row')).map(row => (row.textContent ?? '').slice(0, 80)));
        const row = page.locator('.quick-input-widget .monaco-list-row').filter({ hasText: /Reproducible/ }).first();
        if ((await row.count()) === 0) {
            await page.keyboard.press('Escape');
            return { outcome: 'not-working', summary: 'no document symbols offered', symbols: rows };
        }
        await row.click();
        await page.waitForTimeout(1500);
        const after = await cursorPosition(page);
        const works = after !== null && after.line === 7;
        return { outcome: works ? 'works' : 'not-working', summary: works ? 'symbol navigation reaches the heading line (7)' : `cursor landed at ${JSON.stringify(after)}`, symbols: rows, after };
    });

    await record('quarto.render', async () => {
        const htmlPath = path.join(workspace, 'fixtures', 'research.html');
        const beforeStat = existsSync(htmlPath) ? statSync(htmlPath).mtimeMs : null;
        let extensionOutcome = 'not attempted';
        try {
            await openFile(page, 'research.qmd');
            await paletteCommand(page, 'Quarto: Render Project', /Render Project/);
            await page.waitForTimeout(15000);
            const produced = existsSync(htmlPath) && statSync(htmlPath).mtimeMs !== beforeStat;
            extensionOutcome = produced ? 'extension render produced the document' : 'extension render produced no document within 15s';
            await terminalScreenshot(page, 'quarto-render-extension.png');
        } catch (error) {
            extensionOutcome = `extension render command failed: ${String(error)}`;
        }
        await runInTerminal(page, 'quarto render fixtures/research.qmd', 45000);
        const screenshot = await terminalScreenshot(page, 'quarto-render-terminal.png');
        const produced = existsSync(htmlPath);
        let containsHeading = false;
        let containsComputed = null;
        if (produced) {
            const html = readFileSync(htmlPath, 'utf8');
            copyFileSync(htmlPath, path.join(languageDir, 'rendered-research.html'));
            containsHeading = html.includes('Reproducible result');
            const match = html.match(/<div class="cell-output cell-output-stdout">\s*<pre><code>\[1\] 9<\/code>/);
            containsComputed = match !== null;
        }
        const works = produced && containsHeading && containsComputed;
        createdInWorkspace.push(htmlPath, path.join(workspace, 'fixtures', 'research_files'));
        return {
            outcome: works ? 'works' : 'not-working',
            summary: works ? 'rendered document contains the heading and the computed [1] 9' : 'rendered document missing or incomplete',
            extensionOutcome,
            terminalRender: 'quarto render fixtures/research.qmd (workbench terminal)',
            terminalScreenshot: screenshot,
            renderedCopy: 'artifacts/n5/language/rendered-research.html',
            containsHeading,
            containsComputed,
        };
    });

    await record('notebook', async () => {
        await openFile(page, 'conditional.ipynb');
        await page.waitForTimeout(3000);
        const notebookUi = await page.evaluate(() => ({
            notebookElements: document.querySelectorAll('.theia-notebook, .theia-notebook-main, .jp-Notebook').length,
            textEditors: document.querySelectorAll('.monaco-editor').length,
        }));
        return {
            outcome: 'not-observed',
            reason: 'no notebook/kernel extension is part of the mandatory candidate set; conditional.ipynb opens as an ordinary document',
            observed: notebookUi,
        };
    });

    const shellLog = readFileSync(path.join(artifacts, 'service', 'shell.log'), 'utf8').split(/\r?\n/);
    writeJson('activation-logs.json', {
        shellLog: {
            pluginDeploy: shellLog.filter(line => /Deploy batch|Deploy plugins|plugin/i.test(line)).slice(-20),
            languageServers: shellLog.filter(line => /languageserver|language server|basedpyright|reditorsupport|quarto/i.test(line)).slice(-20),
        },
        browserConsole: consoleLog.slice(-80),
    });

    const required = [
        'python.completion',
        'python.definition',
        'python.diagnostics',
        'python.execution',
        'r.definition',
        'r.diagnostics',
        'r.execution',
        'quarto.render',
    ];
    const reported = Object.keys(surfaces).filter(name => !required.includes(name));
    const pick = names => Object.fromEntries(names.map(name => [name, surfaces[name] ?? null]));
    const requiredFailed = required.filter(name => surfaces[name]?.outcome === 'not-working');
    const requiredMissing = required.filter(name => surfaces[name] === undefined || surfaces[name].outcome === 'not-observed');
    const status = requiredMissing.length > 0 ? 'blocked' : requiredFailed.length > 0 ? 'failed' : 'passed';
    writeJson('summary.json', {
        status,
        statusRule:
            'Exit-driving cells are the protocol observations with a concrete expected outcome: square completion and definition navigation for Python, both intentionally-invalid diagnostic fixtures, both terminal executions (9.0 / 9), and the rendered Quarto document (heading + computed 9). Cosmetic cells (highlighting, hover, R completion, Quarto completion/diagnostics/navigation, notebook) are recorded exactly as observed under reported and are never upgraded.',
        required: pick(required),
        requiredFailed,
        requiredMissing,
        reported: pick(reported),
        surfaces,
        capturedAt: new Date().toISOString(),
        shellUrl,
        workspaceRoot: 'examples/ivory-n5-browser',
    });

    // Clean up workspace files created by the observation (after artifacts are written).
    for (const created of createdInWorkspace) {
        if (existsSync(created)) {
            rmSync(created, { recursive: true, force: true });
        }
    }
    console.log(`language surfaces: ${status}`);
    await browser.close();
    if (status !== 'passed') {
        process.exitCode = 1;
    }
}

main().catch(error => {
    console.error(`language observation failed: ${error instanceof Error ? error.stack : String(error)}`);
    process.exitCode = 2;
});
