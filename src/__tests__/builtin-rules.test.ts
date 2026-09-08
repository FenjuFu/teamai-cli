import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// ─── Test helpers ──────────────────────────────────────────

function makeTmpDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'teamai-builtin-rules-'));
}

describe('builtin-rules', () => {
    let tmpDir: string;
    let originalHome: string;

    beforeEach(() => {
        tmpDir = makeTmpDir();
        originalHome = process.env.HOME ?? '';
        process.env.HOME = tmpDir;
    });

    afterEach(() => {
        process.env.HOME = originalHome;
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    describe('deployBuiltinRules', () => {
        it('should deploy teamai-recall.md rule to tool rules directory', async () => {
            const claudeRulesDir = path.join(tmpDir, '.claude', 'rules');
            fs.mkdirSync(claudeRulesDir, { recursive: true });

            const teamConfig = {
                toolPaths: {
                    claude: {
                        skills: '.claude/skills',
                        rules: '.claude/rules',
                        settings: '.claude/settings.json',
                        claudemd: '.claude/CLAUDE.md',
                    },
                },
            } as any;

            const { deployBuiltinRules } = await import('../builtin-rules.js');
            await deployBuiltinRules(teamConfig);

            const deployed = path.join(claudeRulesDir, 'teamai-recall.md');
            expect(fs.existsSync(deployed)).toBe(true);
            const content = fs.readFileSync(deployed, 'utf-8');
            expect(content).toContain('Team Knowledge Recall');
            expect(content).toContain('teamai recall');
        });

        it('should deploy the recall rule to cursor as .mdc, not an ignored .md', async () => {
            const cursorRulesDir = path.join(tmpDir, '.cursor', 'rules');
            fs.mkdirSync(cursorRulesDir, { recursive: true });
            // A copy left by the layout that predates `.mdc`.
            fs.writeFileSync(path.join(cursorRulesDir, 'teamai-recall.md'), 'stale');

            const teamConfig = {
                toolPaths: {
                    cursor: {
                        skills: '.cursor/skills',
                        rules: '.cursor/rules',
                        settings: '.cursor/hooks.json',
                    },
                },
            } as any;

            const { deployBuiltinRules } = await import('../builtin-rules.js');
            await deployBuiltinRules(teamConfig);

            const mdc = path.join(cursorRulesDir, 'teamai-recall.mdc');
            expect(fs.existsSync(mdc)).toBe(true);
            // Cursor silently ignores a plain `.md` here, so it must not linger.
            expect(fs.existsSync(path.join(cursorRulesDir, 'teamai-recall.md'))).toBe(false);
            const content = fs.readFileSync(mdc, 'utf-8');
            expect(content.startsWith('---\n')).toBe(true);
            expect(content).toContain('alwaysApply: true');
            expect(content).toContain('Team Knowledge Recall');
        });

        it('should skip tool directories that do not exist (tool not installed)', async () => {
            // Arrange: only create one tool directory
            const claudeRulesDir = path.join(tmpDir, '.claude', 'rules');
            fs.mkdirSync(claudeRulesDir, { recursive: true });
            // Do NOT create .cursor/rules/

            const teamConfig = {
                toolPaths: {
                    claude: {
                        skills: '.claude/skills',
                        rules: '.claude/rules',
                        settings: '.claude/settings.json',
                        claudemd: '.claude/CLAUDE.md',
                    },
                    cursor: {
                        skills: '.cursor/skills',
                        rules: '.cursor/rules',
                        settings: '.cursor/settings.json',
                        claudemd: '.cursor/CLAUDE.md',
                    },
                },
            } as any;

            // Act
            const { deployBuiltinRules } = await import('../builtin-rules.js');
            const deployed = await deployBuiltinRules(teamConfig);

            // Assert: only claude dir processed
            expect(deployed).toBe(1);
        });

        it('should not fail when legacy file does not exist', async () => {
            // Arrange: create tool dir without legacy file
            const claudeRulesDir = path.join(tmpDir, '.claude', 'rules');
            fs.mkdirSync(claudeRulesDir, { recursive: true });

            const teamConfig = {
                toolPaths: {
                    claude: {
                        rules: '.claude/rules',
                        claudemd: '.claude/CLAUDE.md',
                    },
                },
            } as any;

            // Act & Assert: should not throw
            const { deployBuiltinRules } = await import('../builtin-rules.js');
            const deployed = await deployBuiltinRules(teamConfig);
            expect(deployed).toBe(1);
        });

        it('does not overwrite a personal teamai-recall in an auto-discovered tool dir', async () => {
            // cursor auto-discovered (not in toolPaths); a personal teamai-recall.mdc pre-exists.
            const cursorRulesDir = path.join(tmpDir, '.cursor', 'rules');
            fs.mkdirSync(cursorRulesDir, { recursive: true });
            fs.writeFileSync(path.join(cursorRulesDir, 'teamai-recall.mdc'), 'PERSONAL RECALL CONTENT');
            fs.mkdirSync(path.join(tmpDir, '.claude', 'rules'), { recursive: true });

            const teamConfig = {
                team: 'test', description: '', repo: 'https://git.woa.com/test/repo.git',
                provider: 'tgit', reviewers: [],
                sharing: { skills: {}, rules: { enforced: [] }, docs: { localDir: '' }, env: { injectShellProfile: true } },
                toolPaths: { claude: { rules: '.claude/rules' } },
            } as any;
            const localConfig = {
                repo: { localPath: path.join(tmpDir, 'repo'), remote: 'r' },
                username: 'u', additionalRoles: [], scope: 'user',
            } as any;

            const { deployBuiltinRules } = await import('../builtin-rules.js');
            await deployBuiltinRules(teamConfig, localConfig);

            // Personal cursor rule preserved; claude (team-managed) still got the built-in.
            expect(fs.readFileSync(path.join(cursorRulesDir, 'teamai-recall.mdc'), 'utf-8'))
                .toBe('PERSONAL RECALL CONTENT');
            expect(fs.existsSync(path.join(tmpDir, '.claude', 'rules', 'teamai-recall.md'))).toBe(true);
        });
    });

    describe('BUILTIN_RULE_NAMES', () => {
        it('should contain teamai-recall', async () => {
            const { BUILTIN_RULE_NAMES } = await import('../builtin-rules.js');
            expect(BUILTIN_RULE_NAMES.has('teamai-recall')).toBe(true);
        });
    });
});
