# Retrospective Salience-Guided Expansion (RSGE)

## Overview

Retrospective Salience-Guided Expansion is a self-correcting two-phase graph expansion algorithm that adaptively shifts from degree-based prioritisation to salience-aware exploration once paths are discovered.

## Key Innovation

Unlike static prioritisation strategies (degree-only or salience-only), RSGE dynamically adapts its expansion strategy based on the quality of discovered paths. If early paths are low-salience, the algorithm automatically diversifies exploration to find higher-quality paths.

## Algorithm Phases

### Phase 1: Degree-Prioritised Exploration (No Paths Yet)

**Priority Function**: `π(v) = deg(v)` [ascending]

- Pure degree prioritisation, identical to DegreePrioritisedExpansion
- Defers high-degree nodes until paths are discovered
- Ensures hub avoidance from the start

### Phase 2: Salience-Aware Exploration (After First Path)

**Priority Function**: `π(v) = deg(v) × (1 - estimated_MI(v))` [ascending]

- Reduces priority (increases expansion importance) for nodes likely to be on high-MI paths
- Nodes with `estimated_MI` near 1.0 get lowest priority values (expanded first)
- Nodes with `estimated_MI` near 0.0 get priority near `deg(v)` (expanded later)

## MI Estimation Strategy

Uses **Jaccard similarity** between node neighbours and discovered path nodes:

```
Jaccard(v, P) = |neighbors(v) ∩ nodes(P)| / |neighbors(v) ∪ nodes(P)|
estimated_MI(v) = max over all discovered paths of Jaccard(v, P)
```

Higher Jaccard similarity indicates the node likely appears in similar high-quality paths.

## Self-Correcting Mechanism

- **Low-salience early paths**: Algorithm diversifies by exploring nodes with low Jaccard similarity
- **High-salience early paths**: Algorithm continues exploring similar nodes to find more high-quality paths

## Expected Behavior

- Higher salience coverage than pure degree prioritisation
- More efficient than salience-prioritised expansion (no pre-computation required)
- Adaptive exploration balances hub avoidance with path quality

## Complexity

- **Time**: O(E log V + P × D)
  - E = edges explored
  - V = vertices
  - P = number of paths discovered
  - D = average node degree
- **Space**: O(V + E + P × K)
  - K = average path length

## Usage

```typescript
import { RetrospectiveSalienceExpansion } from "graphbox";

const expansion = new RetrospectiveSalienceExpansion(expander, ["seedA", "seedB"]);
const result = await expansion.run();

console.log(`Found ${result.paths.length} paths`);
console.log(`Sampled ${result.sampledNodes.size} nodes`);
console.log(`Phase transition occurred: ${result.paths.length > 0}`);
```

## Return Type

Returns `DegreePrioritisedExpansionResult`:

```typescript
interface DegreePrioritisedExpansionResult {
  /** Discovered paths (only populated when N ≥ 2 seeds) */
  paths: Array<{ fromSeed: number; toSeed: number; nodes: string[] }>;

  /** Union of all nodes visited by all frontiers */
  sampledNodes: Set<string>;

  /** Set of edges visited during expansion */
  sampledEdges: Set<string>;

  /** Per-frontier visited sets (for diagnostics) */
  visitedPerFrontier: Array<Set<string>>;

  /** Statistics about the expansion */
  stats: ExpansionStats;
}
```

## Comparison with Other Algorithms

| Algorithm | Pre-computation | Adaptivity | Hub Avoidance | MI Awareness |
|-----------|----------------|------------|---------------|--------------|
| DegreePrioritisedExpansion | None | Static | High | None |
| SaliencePrioritisedExpansion | Path Salience | Static | Medium | High |
| **RetrospectiveSalienceExpansion** | **None** | **Dynamic** | **High→Medium** | **Rolling** |

## Use Cases

- Exploratory graph sampling where path quality is unknown
- Adaptive literature discovery starting from seed papers
- Citation network traversal with quality-guided exploration
- Any scenario where static prioritisation may miss high-quality paths

## Termination

Parameter-free termination: expansion completes when all frontiers are exhausted (no unexpanded nodes remain). No arbitrary iteration limits or node count thresholds.

## Implementation Details

- Uses priority queue for efficient lowest-priority node selection
- Caches neighbour sets for O(1) Jaccard similarity computation
- Rebuilds frontier queues during phase transition (one-time overhead)
- Tracks path signatures for O(1) deduplication
- Maintains per-frontier visited sets for diagnostics

## File Location

- Implementation: `/src/algorithms/traversal/retrospective-salience-expansion.ts`
- Tests: `/src/algorithms/traversal/retrospective-salience-expansion.unit.test.ts`
- Export: `/src/algorithms/traversal/index.ts`
