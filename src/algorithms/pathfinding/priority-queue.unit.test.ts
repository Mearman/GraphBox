/**
 * Unit tests for MinHeap priority queue
 */

import { describe, expect, it } from "vitest";

import { MinHeap } from "./priority-queue";

describe("MinHeap", () => {
	describe("basic operations", () => {
		it("should create empty heap", () => {
			const heap = new MinHeap<string>();

			expect(heap.isEmpty()).toBe(true);
			expect(heap.size()).toBe(0);
		});

		it("should insert elements", () => {
			const heap = new MinHeap<string>();
			heap.insert("a", 10);

			expect(heap.isEmpty()).toBe(false);
			expect(heap.size()).toBe(1);
		});

		it("should extract minimum element", () => {
			const heap = new MinHeap<string>();
			heap.insert("a", 10);
			heap.insert("b", 5);
			heap.insert("c", 15);

			const min = heap.extractMin();

			expect(min.some).toBe(true);
			if (min.some) {
				expect(min.value).toBe("b");
			}
		});

		it("should return None when extracting from empty heap", () => {
			const heap = new MinHeap<string>();

			const min = heap.extractMin();

			expect(min.some).toBe(false);
		});
	});

	describe("heap ordering", () => {
		it("should extract elements in priority order", () => {
			const heap = new MinHeap<number>();
			heap.insert(3, 3);
			heap.insert(1, 1);
			heap.insert(4, 4);
			heap.insert(1, 1); // Duplicate priority
			heap.insert(5, 5);
			heap.insert(2, 2);

			const extracted: number[] = [];
			while (!heap.isEmpty()) {
				const result = heap.extractMin();
				if (result.some) {
					extracted.push(result.value);
				}
			}

			// Elements should be extracted in ascending priority order
			for (let index = 1; index < extracted.length; index++) {
				const previousPriority = extracted[index - 1];
				const currentPriority = extracted[index];
				expect(previousPriority).toBeLessThanOrEqual(currentPriority);
			}
		});

		it("should handle single element heap", () => {
			const heap = new MinHeap<string>();
			heap.insert("only", 1);

			const first = heap.extractMin();
			expect(first.some).toBe(true);
			if (first.some) {
				expect(first.value).toBe("only");
			}

			const second = heap.extractMin();
			expect(second.some).toBe(false);
		});

		it("should handle elements with same priority", () => {
			const heap = new MinHeap<string>();
			heap.insert("a", 1);
			heap.insert("b", 1);
			heap.insert("c", 1);

			// All three should be extractable (order among equals not guaranteed)
			const extracted: string[] = [];
			while (!heap.isEmpty()) {
				const result = heap.extractMin();
				if (result.some) {
					extracted.push(result.value);
				}
			}

			expect(extracted).toHaveLength(3);
			expect(extracted).toContain("a");
			expect(extracted).toContain("b");
			expect(extracted).toContain("c");
		});
	});

	describe("decreaseKey", () => {
		it("should decrease priority of existing element", () => {
			const heap = new MinHeap<string>();
			heap.insert("a", 10);
			heap.insert("b", 5);
			heap.insert("c", 15);

			const result = heap.decreaseKey("c", 1);

			expect(result.ok).toBe(true);

			// Now c should be extracted first (lowest priority)
			const min = heap.extractMin();
			expect(min.some).toBe(true);
			if (min.some) {
				expect(min.value).toBe("c");
			}
		});

		it("should return error for non-existing element", () => {
			const heap = new MinHeap<string>();
			heap.insert("a", 10);

			const result = heap.decreaseKey("nonexistent", 5);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("invalid-input");
				expect(result.error.message).toContain("not found");
			}
		});

		it("should return error when increasing priority", () => {
			const heap = new MinHeap<string>();
			heap.insert("a", 10);

			const result = heap.decreaseKey("a", 20);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("invalid-input");
				expect(result.error.message).toContain("greater than");
			}
		});

		it("should allow decreasing to same priority", () => {
			const heap = new MinHeap<string>();
			heap.insert("a", 10);

			const result = heap.decreaseKey("a", 10);

			expect(result.ok).toBe(true);
		});
	});

	describe("size tracking", () => {
		it("should track size correctly after inserts", () => {
			const heap = new MinHeap<number>();

			expect(heap.size()).toBe(0);
			heap.insert(1, 1);
			expect(heap.size()).toBe(1);
			heap.insert(2, 2);
			expect(heap.size()).toBe(2);
			heap.insert(3, 3);
			expect(heap.size()).toBe(3);
		});

		it("should track size correctly after extracts", () => {
			const heap = new MinHeap<number>();
			heap.insert(1, 1);
			heap.insert(2, 2);
			heap.insert(3, 3);

			expect(heap.size()).toBe(3);
			heap.extractMin();
			expect(heap.size()).toBe(2);
			heap.extractMin();
			expect(heap.size()).toBe(1);
			heap.extractMin();
			expect(heap.size()).toBe(0);
		});
	});

	describe("extractMinBatch", () => {
		it("should extract multiple elements at once", () => {
			const heap = new MinHeap<number>();
			heap.insert(5, 5);
			heap.insert(3, 3);
			heap.insert(7, 7);
			heap.insert(1, 1);
			heap.insert(4, 4);

			const batch = heap.extractMinBatch(3);

			expect(batch).toHaveLength(3);
			expect(batch[0]).toBe(1); // Minimum
			expect(batch[1]).toBe(3); // Second minimum
			expect(batch[2]).toBe(4); // Third minimum
		});

		it("should handle batch larger than heap size", () => {
			const heap = new MinHeap<number>();
			heap.insert(1, 1);
			heap.insert(2, 2);

			const batch = heap.extractMinBatch(10);

			expect(batch).toHaveLength(2);
			expect(heap.isEmpty()).toBe(true);
		});

		it("should handle empty heap", () => {
			const heap = new MinHeap<number>();

			const batch = heap.extractMinBatch(5);

			expect(batch).toHaveLength(0);
		});
	});

	describe("complex scenarios", () => {
		it("should handle interleaved inserts and extracts", () => {
			const heap = new MinHeap<number>();

			heap.insert(5, 5);
			heap.insert(3, 3);
			const firstExtract = heap.extractMin();
			expect(firstExtract.some).toBe(true);

			heap.insert(1, 1);
			heap.insert(4, 4);
			const min = heap.extractMin();
			expect(min.some).toBe(true);
			if (min.some) {
				expect(min.value).toBe(1);
			}
		});

		it("should maintain heap property after many operations", () => {
			const heap = new MinHeap<number>();
			const values = [42, 15, 88, 3, 77, 22, 99, 8, 65, 31];

			// Insert all
			for (const v of values) {
				heap.insert(v, v);
			}

			// Extract all and verify order
			let previous = -Infinity;
			while (!heap.isEmpty()) {
				const result = heap.extractMin();
				if (result.some) {
					expect(result.value).toBeGreaterThanOrEqual(previous);
					previous = result.value;
				}
			}
		});

		it("should work with object elements", () => {
			interface Task {
				id: string;
				name: string;
			}
			const heap = new MinHeap<Task>();

			heap.insert({ id: "1", name: "High priority" }, 1);
			heap.insert({ id: "2", name: "Low priority" }, 10);
			heap.insert({ id: "3", name: "Medium priority" }, 5);

			const first = heap.extractMin();
			expect(first.some).toBe(true);
			if (first.some) {
				expect(first.value.id).toBe("1");
			}
		});
	});
});
