/**
 * Unit tests for CheckpointStorage
 *
 * Tests FileStorage, GitStorage, FileSystem, and Lock implementations.
 */

import { beforeEach,describe, expect, it } from "vitest";

import type { CheckpointData } from "../checkpoint-manager.js";
import { FileStorage, FileSystem, GitStorage, InMemoryLock, NodeFileSystem } from "../checkpoint-storage.js";

/**
 * Mock file system for testing.
 * Handles both relative and absolute paths.
 */
class MockFileSystem implements FileSystem {
	public data = new Map<string, string>();
	private throwsOnRead = new Set<string>();
	private throwsOnWrite = new Set<string>();

	// Try multiple possible path resolutions
	private resolvePath(path: string): string | undefined {
		// Direct match
		if (this.data.has(path)) {
			return path;
		}
		// Try with leading slash if not present
		if (!path.startsWith("/") && this.data.has(`/${path}`)) {
			return `/${path}`;
		}
		// Try without leading slash if present
		if (path.startsWith("/") && this.data.has(path.slice(1))) {
			return path.slice(1);
		}
		return path;
	}

	async readFile(path: string): Promise<string> {
		// Try multiple path resolutions
		const pathsToTry = [
			path,
			path.startsWith("/") ? path : `/${path}`,
			path.startsWith("/") ? path.slice(1) : path,
		];

		for (const tryPath of pathsToTry) {
			if (this.data.has(tryPath) && this.throwsOnRead.has(tryPath)) {
				throw new Error(`Mock read error: ${tryPath}`);
			}
			const content = this.data.get(tryPath);
			if (content !== undefined) {
				return content;
			}
		}

		throw new Error(`File not found: ${path}`);
	}

	async writeFile(path: string, content: string): Promise<void> {
		// Store with multiple path variants
		this.data.set(path, content);
		if (!path.startsWith("/")) {
			this.data.set(`/${path}`, content);
		}
		this.data.set(`/${path}`, content);

		const resolvedPath = this.resolvePath(path) ?? path;
		if (this.throwsOnWrite.has(resolvedPath)) {
			throw new Error(`Mock write error: ${resolvedPath}`);
		}
	}

	async mkdir(_path: string, _options: { recursive: boolean }): Promise<void> {
		// No-op for mock
	}

	async unlink(path: string): Promise<void> {
		// Delete all variants
		this.data.delete(path);
		if (!path.startsWith("/")) {
			this.data.delete(`/${path}`);
		}
		this.data.delete(`/${path}`);

		const resolvedPath = this.resolvePath(path) ?? path;
		this.data.delete(resolvedPath);
	}

	async access(_path: string): Promise<void> {
		// No-op for mock
	}

	async readdir(path: string): Promise<string[]> {
		const resolvedPath = this.resolvePath(path) ?? path;
		const prefix = resolvedPath.endsWith("/") ? resolvedPath : `${resolvedPath}/`;
		return [...this.data.keys()]
			.filter((k) => k.startsWith(prefix))
			.map((k) => k.slice(prefix.length))
			.filter((k) => !k.includes("/"));
	}

	setFile(path: string, content: string): void {
		// Store with multiple path variants for flexibility
		this.data.set(path, content);
		if (!path.startsWith("/")) {
			this.data.set(`/${path}`, content);
		}
		// Also store with cwd prefix (common during tests)
		this.data.set(`/${path}`, content);
	}

	getFile(path: string): string | undefined {
		const resolvedPath = this.resolvePath(path) ?? path;
		// Check multiple path variants
		if (this.data.has(resolvedPath)) {
			return this.data.get(resolvedPath);
		}
		// Also try with the full resolved path if provided
		const normalizedPath = path.startsWith("/") ? path : `/${path}`;
		if (this.data.has(normalizedPath)) {
			return this.data.get(normalizedPath);
		}
		// Try stripping leading slash if it exists
		const strippedPath = path.startsWith("/") ? path.slice(1) : path;
		if (this.data.has(strippedPath)) {
			return this.data.get(strippedPath);
		}
		return undefined;
	}

	clear(): void {
		this.data.clear();
		this.throwsOnRead.clear();
		this.throwsOnWrite.clear();
	}

	setThrowsOnRead(path: string): void {
		this.throwsOnRead.add(path);
		if (!path.startsWith("/")) {
			this.throwsOnRead.add(`/${path}`);
		}
	}

	setThrowsOnWrite(path: string): void {
		this.throwsOnWrite.add(path);
		if (!path.startsWith("/")) {
			this.throwsOnWrite.add(`/${path}`);
		}
	}
}

describe("FileSystem", () => {
	describe("NodeFileSystem", () => {
		it("should have all required methods", () => {
			const fs = new NodeFileSystem();
			expect(fs.readFile).toBeInstanceOf(Function);
			expect(fs.writeFile).toBeInstanceOf(Function);
			expect(fs.mkdir).toBeInstanceOf(Function);
			expect(fs.unlink).toBeInstanceOf(Function);
			expect(fs.access).toBeInstanceOf(Function);
			expect(fs.readdir).toBeInstanceOf(Function);
		});
	});

	describe("MockFileSystem", () => {
		let mockFs: MockFileSystem;

		beforeEach(() => {
			mockFs = new MockFileSystem();
		});

		it("should store and retrieve files", async () => {
			mockFs.setFile("test.json", '{"test": true}');
			const content = await mockFs.readFile("test.json");
			expect(content).toBe('{"test": true}');
		});

		it("should throw on missing file", async () => {
			await expect(mockFs.readFile("missing.json")).rejects.toThrow();
		});

		it("should write files", async () => {
			await mockFs.writeFile("new.json", '{"new": true}');
			expect(mockFs.getFile("new.json")).toBe('{"new": true}');
		});

		it("should delete files", async () => {
			mockFs.setFile("delete.json", '{"delete": true}');
			await mockFs.unlink("delete.json");
			expect(mockFs.getFile("delete.json")).toBeUndefined();
		});

		it("should list directory contents", async () => {
			mockFs.setFile("dir/file1.json", "{}");
			mockFs.setFile("dir/file2.json", "{}");
			mockFs.setFile("other/file.txt", "{}");

			const entries = await mockFs.readdir("dir");
			expect(entries).toContain("file1.json");
			expect(entries).toContain("file2.json");
			expect(entries).not.toContain("file.txt");
		});
	});
});

describe("Lock", () => {
	describe("InMemoryLock", () => {
		it("should allow concurrent acquisitions with queueing", async () => {
			const lock = new InMemoryLock();
			const results: number[] = [];

			// First acquisition
			void lock.acquire().then(async () => {
				results.push(1);
				await new Promise((resolve) => setTimeout(resolve, 10));
				lock.release();
			});

			// Second acquisition (should wait)
			void lock.acquire().then(() => {
				results.push(2);
				lock.release();
			});

			// Third acquisition (should wait)
			void lock.acquire().then(() => {
				results.push(3);
				lock.release();
			});

			await new Promise((resolve) => setTimeout(resolve, 50));
			expect(results).toEqual([1, 2, 3]);
		});

		it("should release immediately when no waiters", () => {
			const lock = new InMemoryLock();
			lock.release(); // Should not throw
			lock.release(); // Should not throw
		});
	});
});

describe("FileStorage", () => {
	let mockFs: MockFileSystem;
	let storage: FileStorage;

	beforeEach(() => {
		mockFs = new MockFileSystem();
		storage = new FileStorage("test/checkpoint.json", mockFs);
	});

	/**
	 * Helper to set file content using the storage's resolved path.
	 * @param content
	 */
	const setStorageFile = (content: string): void => {
		const resolvedPath = storage.getPath();
		mockFs.data.set(resolvedPath, content);
	};

	/**
	 * Helper to get file content using the storage's resolved path.
	 */
	const getStorageFile = (): string | undefined => {
		const resolvedPath = storage.getPath();
		return mockFs.data.get(resolvedPath);
	};

	describe("load", () => {
		it("should parse valid JSON checkpoint", async () => {
			const checkpoint: CheckpointData = {
				configHash: "abc123",
				createdAt: "2024-01-01T00:00:00.000Z",
				updatedAt: "2024-01-01T00:00:00.000Z",
				completedRunIds: ["run1", "run2"],
				results: {},
				totalPlanned: 10,
			};
			setStorageFile(JSON.stringify(checkpoint));

			const loaded = await storage.load();
			expect(loaded).toEqual(checkpoint);
		});

		it("should return null for missing file", async () => {
			const loaded = await storage.load();
			expect(loaded).toBeNull();
		});

		it("should return null for invalid JSON", async () => {
			setStorageFile("not json");
			const loaded = await storage.load();
			expect(loaded).toBeNull();
		});

		it("should return null on read error", async () => {
			const resolvedPath = storage.getPath();
			mockFs.setThrowsOnRead(resolvedPath);
			const loaded = await storage.load();
			expect(loaded).toBeNull();
		});
	});

	describe("save", () => {
		it("should write checkpoint with updated timestamp", async () => {
			const checkpoint: CheckpointData = {
				configHash: "abc123",
				createdAt: "2024-01-01T00:00:00.000Z",
				updatedAt: "2024-01-01T00:00:00.000Z",
				completedRunIds: ["run1"],
				results: {},
				totalPlanned: 10,
			};

			await storage.save(checkpoint);
			const saved = getStorageFile();
			expect(saved).toBeDefined();

			const parsed = JSON.parse(saved!) as CheckpointData;
			expect(parsed.configHash).toBe("abc123");
			expect(parsed.updatedAt).not.toBe("2024-01-01T00:00:00.000Z"); // Should be updated
		});

		it("should create parent directory via mkdir", async () => {
			const checkpoint: CheckpointData = {
				configHash: "abc123",
				createdAt: "2024-01-01T00:00:00.000Z",
				updatedAt: "2024-01-01T00:00:00.000Z",
				completedRunIds: [],
				results: {},
				totalPlanned: 0,
			};

			await storage.save(checkpoint);
			expect(getStorageFile()).toBeDefined();
		});
	});

	describe("exists", () => {
		it("should return true for valid checkpoint file", async () => {
			const checkpoint: CheckpointData = {
				configHash: "abc123",
				createdAt: "2024-01-01T00:00:00.000Z",
				updatedAt: "2024-01-01T00:00:00.000Z",
				completedRunIds: [],
				results: {},
				totalPlanned: 0,
			};
			setStorageFile(JSON.stringify(checkpoint));

			const exists = await storage.exists();
			expect(exists).toBe(true);
		});

		it("should return false for missing file", async () => {
			const exists = await storage.exists();
			expect(exists).toBe(false);
		});

		it("should return false for invalid JSON", async () => {
			setStorageFile("not json");
			const exists = await storage.exists();
			expect(exists).toBe(false);
		});
	});

	describe("delete", () => {
		it("should remove checkpoint file", async () => {
			setStorageFile('{"test": true}');
			await storage.delete();
			expect(getStorageFile()).toBeUndefined();
		});

		it("should not throw when deleting missing file", async () => {
			await expect(storage.delete()).resolves.toBeUndefined();
		});
	});

	describe("getPath", () => {
		it("should return absolute path", () => {
			const path = storage.getPath();
			expect(path).toContain("checkpoint.json");
		});
	});

	describe("findShards", () => {
		it("should find all worker checkpoint files", async () => {
			mockFs.setFile("results/execute/checkpoint-worker-00.json", "{}");
			mockFs.setFile("results/execute/checkpoint-worker-01.json", "{}");
			mockFs.setFile("results/execute/checkpoint-worker-02.json", "{}");
			mockFs.setFile("results/execute/other.json", "{}");

			const shards = await FileStorage.findShards("results/execute", mockFs);
			expect(shards).toHaveLength(3);
			expect(shards[0]).toContain("checkpoint-worker-00.json");
			expect(shards[1]).toContain("checkpoint-worker-01.json");
			expect(shards[2]).toContain("checkpoint-worker-02.json");
		});

		it("should sort shards by worker index", async () => {
			mockFs.setFile("results/execute/checkpoint-worker-02.json", "{}");
			mockFs.setFile("results/execute/checkpoint-worker-00.json", "{}");
			mockFs.setFile("results/execute/checkpoint-worker-01.json", "{}");

			const shards = await FileStorage.findShards("results/execute", mockFs);
			expect(shards[0]).toContain("checkpoint-worker-00.json");
			expect(shards[1]).toContain("checkpoint-worker-01.json");
			expect(shards[2]).toContain("checkpoint-worker-02.json");
		});

		it("should return empty array when directory has no shards", async () => {
			const shards = await FileStorage.findShards("results/execute", mockFs);
			expect(shards).toEqual([]);
		});

		it("should return empty array when directory does not exist", async () => {
			const shards = await FileStorage.findShards("nonexistent", mockFs);
			expect(shards).toEqual([]);
		});
	});

	describe("shardPath", () => {
		it("should generate zero-padded shard paths", () => {
			const path0 = FileStorage.shardPath("results/execute", 0);
			const path1 = FileStorage.shardPath("results/execute", 1);
			const path10 = FileStorage.shardPath("results/execute", 10);

			expect(path0).toContain("checkpoint-worker-00.json");
			expect(path1).toContain("checkpoint-worker-01.json");
			expect(path10).toContain("checkpoint-worker-10.json");
		});
	});
});

describe("GitStorage", () => {
	describe("load", () => {
		it("should return null when git is not available", async () => {
			const storage = new GitStorage("test-namespace", "/nonexistent");
			const loaded = await storage.load();
			expect(loaded).toBeNull();
		});
	});

	describe("type", () => {
		it("should have type 'git'", () => {
			const storage = new GitStorage("test-namespace");
			expect(storage.type).toBe("git");
		});
	});
});
