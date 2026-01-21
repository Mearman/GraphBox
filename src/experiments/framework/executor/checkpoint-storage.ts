/**
 * Checkpoint Storage Backends
 *
 * Pluggable storage for experiment checkpoints:
 * - FileStorage: JSON files in local filesystem (fast, no git required)
 * - GitStorage: Git notes attached to commits (version controlled, shareable)
 *
 * Usage:
 * ```typescript
 * // File-based (default)
 * const fileStorage = new FileStorage("results/execute/checkpoint.json");
 *
 * // Git-based (stores as git notes)
 * const gitStorage = new GitStorage("results-execute");
 *
 * // Auto-detect based on mode
 * const storage = createCheckpointStorage("file", "results/execute/checkpoint.json");
 * const storage = createCheckpointStorage("git", "results-execute");
 * ```
 */

import { execSync } from "node:child_process";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type { CheckpointData } from "./checkpoint-manager.js";

/**
 * Checkpoint storage mode.
 */
export type CheckpointMode = "file" | "git" | "auto";

/**
 * Abstract checkpoint storage interface.
 */
export interface CheckpointStorage {
	/**
	 * Load checkpoint data from storage.
	 * @returns Checkpoint data or null if not found
	 */
	load(): Promise<CheckpointData | null>;

	/**
	 * Save checkpoint data to storage.
	 * @param data - Checkpoint data to save
	 */
	save(data: CheckpointData): Promise<void>;

	/**
	 * Delete checkpoint from storage.
	 */
	delete(): Promise<void>;

	/**
	 * Check if checkpoint exists.
	 */
	exists(): Promise<boolean>;

	/**
	 * Get storage type identifier.
	 */
	readonly type: string;
}

/**
 * File-based checkpoint storage.
 * Stores checkpoints as JSON files in the local filesystem.
 */
export class FileStorage implements CheckpointStorage {
	readonly type = "file";
	private readonly path: string;

	constructor(path: string) {
		this.path = resolve(path);
	}

	async load(): Promise<CheckpointData | null> {
		try {
			const content = await readFile(this.path, "utf-8");
			return JSON.parse(content) as CheckpointData;
		} catch {
			return null;
		}
	}

	async save(data: CheckpointData): Promise<void> {
		try {
			await mkdir(dirname(this.path), { recursive: true });
			data.updatedAt = new Date().toISOString();
			await writeFile(this.path, JSON.stringify(data, null, 2), "utf-8");
		} catch (error) {
			console.warn(`Failed to save checkpoint to ${this.path}: ${error}`);
			throw error;
		}
	}

	async delete(): Promise<void> {
		try {
			await unlink(this.path);
		} catch {
			// Ignore if file doesn't exist
		}
	}

	async exists(): Promise<boolean> {
		try {
			const content = await readFile(this.path, "utf-8");
			const data = JSON.parse(content);
			return data !== null && typeof data === "object";
		} catch {
			return false;
		}
	}

	getPath(): string {
		return this.path;
	}
}

/**
 * Git-based checkpoint storage using git notes.
 *
 * Checkpoints are stored as git notes attached to the current HEAD.
 * This provides:
 * - Version control: Checkpoints tracked in git history
 * - Shareability: Team members can access each other's checkpoints
 * - Reproducibility: Linked to specific commits
 * - Safety: No accidental deletion through git clean
 *
 * Each checkpoint is stored as a note with a unique ref based on the namespace.
 */
export class GitStorage implements CheckpointStorage {
	readonly type = "git";
	private readonly namespace: string;
	private readonly repoRoot: string;

	constructor(namespace: string, repoRoot = process.cwd()) {
		this.namespace = namespace;
		this.repoRoot = repoRoot;
	}

	/**
	 * Get the full notes ref for this checkpoint.
	 */
	private getNotesRef(): string {
		return `refs/notes/checkpoints/${this.namespace}`;
	}

	/**
	 * Check if git is available and we're in a git repo.
	 */
	private checkGitAvailable(): boolean {
		try {
			execSync("git rev-parse --git-dir", {
				cwd: this.repoRoot,
				stdio: "pipe",
			});
			return true;
		} catch {
			return false;
		}
	}

	async load(): Promise<CheckpointData | null> {
		if (!this.checkGitAvailable()) {
			console.warn("Git not available, falling back to null checkpoint");
			return null;
		}

		try {
			// Get the note content
			const content = execSync(
				`git --work-tree="${this.repoRoot}" notes --ref=${this.getNotesRef()} show 2>/dev/null || echo ""`,
				{ encoding: "utf-8", cwd: this.repoRoot }
			);

			if (!content.trim()) {
				return null;
			}

			return JSON.parse(content) as CheckpointData;
		} catch {
			return null;
		}
	}

	async save(data: CheckpointData): Promise<void> {
		if (!this.checkGitAvailable()) {
			console.warn("Git not available, skipping checkpoint save");
			return;
		}

		try {
			data.updatedAt = new Date().toISOString();

			// Write to a temp file first
			const temporaryPath = resolve(this.repoRoot, ".git", "checkpoint-tmp.json");
			await writeFile(temporaryPath, JSON.stringify(data, null, 2), "utf-8");

			// Add the note using the temp file
			execSync(
				`git --work-tree="${this.repoRoot}" notes --ref=${this.getNotesRef()} add -F "${temporaryPath}"`,
				{ stdio: "pipe", cwd: this.repoRoot }
			);

			// Clean up temp file
			await unlink(temporaryPath).catch(() => {});
		} catch (error) {
			console.warn(`Failed to save git checkpoint: ${error}`);
			throw error;
		}
	}

	async delete(): Promise<void> {
		if (!this.checkGitAvailable()) {
			return;
		}

		try {
			execSync(
				`git --work-tree="${this.repoRoot}" notes --ref=${this.getNotesRef()} remove`,
				{ stdio: "pipe", cwd: this.repoRoot }
			);
		} catch {
			// Ignore if note doesn't exist
		}
	}

	async exists(): Promise<boolean> {
		const data = await this.load();
		return data !== null;
	}

	/**
	 * List all checkpoints for this namespace across git history.
	 * Returns a map of commit SHA to checkpoint metadata.
	 */
	async listHistory(): Promise<Array<{ commit: string; checkpoint: CheckpointData }>> {
		if (!this.checkGitAvailable()) {
			return [];
		}

		try {
			// Get all commits that have notes for this namespace
			const output = execSync(
				`git --work-tree="${this.repoRoot}" notes --ref=${this.getNotesRef()} list`,
				{ encoding: "utf-8", cwd: this.repoRoot }
			);

			const lines = output.trim().split("\n");
			const results: Array<{ commit: string; checkpoint: CheckpointData }> = [];

			for (const line of lines) {
				const [commitSha] = line.split(/\s+/);
				try {
					const content = execSync(
						`git --work-tree="${this.repoRoot}" notes --ref=${this.getNotesRef()} show ${commitSha}`,
						{ encoding: "utf-8", cwd: this.repoRoot }
					);
					const checkpoint = JSON.parse(content) as CheckpointData;
					results.push({ commit: commitSha, checkpoint });
				} catch {
					// Skip invalid entries
				}
			}

			return results;
		} catch {
			return [];
		}
	}

	/**
	 * Restore checkpoint from a specific commit.
	 * @param commitSha
	 */
	async restoreFromCommit(commitSha: string): Promise<CheckpointData | null> {
		if (!this.checkGitAvailable()) {
			return null;
		}

		try {
			const content = execSync(
				`git --work-tree="${this.repoRoot}" notes --ref=${this.getNotesRef()} show ${commitSha}`,
				{ encoding: "utf-8", cwd: this.repoRoot }
			);
			return JSON.parse(content) as CheckpointData;
		} catch {
			return null;
		}
	}
}

/**
 * Create a checkpoint storage instance based on mode.
 * @param mode - Storage mode ("file", "git", or "auto")
 * @param pathOrNamespace - File path or git namespace
 * @param repoRoot - Git repository root (for git storage)
 */
export const createCheckpointStorage = (mode: CheckpointMode, pathOrNamespace: string, repoRoot?: string): CheckpointStorage => {
	const effectiveMode = mode === "auto" ? detectPreferredMode() : mode;

	if (effectiveMode === "git") {
		return new GitStorage(pathOrNamespace, repoRoot);
	}

	return new FileStorage(pathOrNamespace);
};

/**
 * Detect preferred checkpoint mode based on environment.
 * Returns "git" if in a git repo with commits, otherwise "file".
 */
const detectPreferredMode = (): CheckpointMode => {
	try {
		// Check if we're in a git repo with commits
		execSync("git rev-parse --git-dir > /dev/null 2>&1", { stdio: "pipe" });

		// Check if there are any commits
		try {
			execSync("git rev-parse HEAD > /dev/null 2>&1", { stdio: "pipe" });
			return "git";
		} catch {
			// Git repo but no commits yet
			return "file";
		}
	} catch {
		// Not a git repo
		return "file";
	}
};

/**
 * Get default checkpoint namespace for git storage.
 * Based on results directory path.
 * @param resultsDir
 */
export const getGitNamespace = (resultsDir: string): string => resultsDir.replaceAll(/[/\\]/g, "-").replace(/^\./, "").replace(/^\/+/, "");
