# Graph Classes Coverage Analysis

**Generated:** 2025-01-18
**Comparison Source:** [ISGCI - Information System on Graph Classes and their Inclusions](https://www.graphclasses.org/)

## Executive Summary

ISGCI tracks **500+ graph classes** across the graph theory literature. GraphBox currently supports **~50 graph classes** through its 46-dimensional GraphSpec system.

**Coverage Estimate:** ~10% of known graph classes

---

## GraphBox Current Coverage (✅)

### Core Structural Classes (from `src/generation/spec/`)

| Class | Status | Module |
|-------|--------|--------|
| Complete | ✅ | `core.ts` |
| Bipartite | ✅ | `advanced.ts` (partiteness) |
| Chordal | ✅ | `products.ts` |
| Comparability | ✅ | `products.ts` |
| Permutation | ✅ | `products.ts` |
| Interval | ✅ | `products.ts` |
| Split | ✅ | `structural.ts` |
| Threshold | ✅ | `structural.ts` |
| Cograph | ✅ | `structural.ts` |
| Claw-free | ✅ | `structural.ts` |
| Line graphs | ✅ | `products.ts` (line property) |
| Perfect | ✅ | `structural.ts` |
| Planar | ✅ | `geometric.ts` |
| Tree | ✅ | Implicit (acyclic + connected) |
| Forest | ✅ | Implicit (acyclic + disconnected) |
| Eulerian | ✅ | `products.ts` |
| Hamiltonian | ✅ | `path-cycle.ts` |
| k-Colorable | ✅ | `products.ts` |
| k-Connected | ✅ | `products.ts` |
| Regular graphs | ✅ | `regularity.ts` |
| Strongly regular | ✅ | `regularity.ts` |
| Cubic | ✅ | `regularity.ts` |
| Transitive graphs | ✅ | `symmetry.ts` |
| Scale-free | ✅ | `network.ts` |
| Small-world | ✅ | `network.ts` |
| Community structure | ✅ | `network.ts` |
| Toroidal | ✅ | `products.ts` |
| Grid | ✅ | `products.ts` |
| Star | ✅ | `products.ts` |
| Wheel | ✅ | `products.ts` |
| Binary tree | ✅ | `products.ts` |
| Tournament | ✅ | `products.ts` |
| Complete bipartite | ✅ | `products.ts` |
| Flow network | ✅ | `products.ts` |
| Spanning tree | ✅ | `products.ts` |

**Total Supported: ~40 classes**

---

## Major Missing Categories (❌)

### 1. Forbidden Subgraph Classes (Priority: HIGH)

ISGCI has **200+ classes** defined by forbidden induced subgraphs. GraphBox has minimal support.

| Missing Classes | Description | Priority |
|----------------|-------------|----------|
| **P₅-free** | No induced path on 5 vertices | HIGH |
| **P₆-free** | No induced path on 6 vertices | HIGH |
| **P₇-free** | No induced path on 7 vertices | MEDIUM |
| **C₅-free** | No induced 5-cycle | HIGH |
| **C₆-free** | No induced 6-cycle | MEDIUM |
| **C₄-free** | No induced 4-cycle | MEDIUM |
| **Bull-free** | No bull graph (triangle with two horns) | HIGH |
| **Gem-free** | No gem graph (5-vertex diamond) | MEDIUM |
| **Net-free** | No net graph | MEDIUM |
| **House-free** | No house graph (square with roof) | MEDIUM |
| **Diamond-free** | No diamond (K₄ minus edge) | MEDIUM |
| **(C₄, C₅)-free** | Neither C₄ nor C₅ | MEDIUM |
| **(C₄, C₅, C₆)-free** | No cycles of length 4, 5, or 6 | MEDIUM |
| **(P₅, gem)-free** | Neither P₅ nor gem | LOW |
| **(fork, gem)-free** | Neither fork nor gem | LOW |
| **AT-free** | Asteroidal triple-free | HIGH |
| **HH-free** | House and hole free | MEDIUM |
| **HHD-free** | House, hole, domino free | MEDIUM |

**Why This Matters:**
- Forbidden subgraph classes are **fundamental** in structural graph theory
- Many have **efficient polynomial-time algorithms** for NP-hard problems
- Critical for **complexity theory** and parameterized algorithms

---

### 2. Intersection Graph Classes (Priority: HIGH)

| Missing Classes | Description | Priority |
|----------------|-------------|----------|
| **Circular arc** | Intersection graphs of arcs on a circle | HIGH |
| **Proper circular arc** | No arc properly contains another | HIGH |
| **Helly circular arc** | Circular arcs with Helly property | MEDIUM |
| **Unit circular arc** | Circular arcs of unit length | MEDIUM |
| **Circle** | Intersection graphs of circles in plane | MEDIUM |
| **Disk graphs** | Intersection graphs of disks | MEDIUM |
| **Unit disk graphs** | Intersection graphs of unit disks | MEDIUM |
| **Rectangle intersection** | Intersection graphs of rectangles | MEDIUM |
| **Boxicity k** | Intersection of k interval graphs | HIGH |
| **String graphs** | Intersection graphs of curves in plane | MEDIUM |
| **Segment graphs** | Intersection graphs of line segments | MEDIUM |
| **Contact graphs** | Graphs from touching geometric objects | LOW |

**Why This Matters:**
- Central to **computational geometry**
- Applications in **network topology**, **VLSI design**, **scheduling**
- Many have **specialized algorithms** leveraging geometric structure

---

### 3. Helly and Convexity Classes (Priority: MEDIUM)

| Missing Classes | Description | Priority |
|----------------|-------------|----------|
| **Helly** | Clique family has nonempty intersection | MEDIUM |
| **Neighbourhood-Helly** | Helly property on neighbourhoods | MEDIUM |
| **Hereditary Helly** | Helly property inherited by subgraphs | MEDIUM |
| **Clique-Helly** | All maximal cliques satisfy Helly | MEDIUM |
| **Bipartite-Helly** | Helly property for bipartite graphs | LOW |
| **Convex** | Vertices ordered with convex neighbourhoods | MEDIUM |
| **Biconvex** | Convex on both partitions | MEDIUM |
| **Weakly chordal** | No induced cycle of length ≥ 5 in G or Ḡ | HIGH |

---

### 4. Probe and Augmented Classes (Priority: MEDIUM)

| Missing Classes | Description | Priority |
|----------------|-------------|----------|
| **Probe chordal** | Can add edges to make chordal | MEDIUM |
| **Probe interval** | Can add edges to make interval | MEDIUM |
| **Probe cograph** | Can add edges to make cograph | MEDIUM |
| **Probe comparability** | Can add edges to make comparability | MEDIUM |
| **Probe bipartite** | Can partition vertices into two sets | MEDIUM |
| **Probe threshold** | Can add edges to make threshold | LOW |
| **Probe permutation** | Can add edges to make permutation | LOW |
| **Probe P₄-sparse** | Can add edges to make P₄-sparse | LOW |
| **Probe P₄-reducible** | Can add edges to make P₄-reducible | LOW |

**Why This Matters:**
- Arise in **physical mapping**, **genome assembly**
- Model graphs with **missing data** or **uncertain edges**
- Bridge between **structured** and **unstructured** graphs

---

### 5. Power and Leaf Classes (Priority: MEDIUM)

| Missing Classes | Description | Priority |
|----------------|-------------|----------|
| **Leaf power** | Graph of leaves in a tree at distance ≤ k | MEDIUM |
| **k-leaf power** | For specific k values (2, 3, 4, 5) | MEDIUM |
| **Power-chordal** | Power of a chordal graph | LOW |
| **Rooted leaf power** | Leaf power with designated root | LOW |

**Why This Matters:**
- Applications in **phylogenetics** and **evolutionary biology**
- **RNA secondary structure** prediction
- **Hierarchical clustering** validation

---

### 6. Visibility and Geometric Classes (Priority: MEDIUM)

| Missing Classes | Description | Priority |
|----------------|-------------|----------|
| **Bar visibility** | Visibility graphs of vertical bars | MEDIUM |
| **Rectangle visibility** | Visibility graphs of rectangles | MEDIUM |
| **Unit disk graphs** | Already in GraphBox (unitDisk) | ✅ |
| **Tolerance graphs** | Generalized interval graphs | MEDIUM |
| **Bounded tolerance** | Tolerance with bounded ratio | LOW |
| **Bitolerance** | Two-sided tolerance | LOW |
| **Max-tolerance** | Maximum tolerance representation | LOW |
| **Threshold tolerance** | Special tolerance graphs | LOW |

---

### 7. Decomposition and Width Classes (Priority: HIGH)

| Missing Classes | Description | Priority |
|----------------|-------------|----------|
| **Treewidth k** | Already in GraphBox (treewidth) | ✅ |
| **Pathwidth k** | Treewidth restricted to path decomposition | HIGH |
| **Cliquewidth k** | Already mentioned (not implemented) | HIGH |
| **Linear cliquewidth k** | Cliquewidth with linear rank functions | HIGH |
| **NLC-width k** | Node label controlled width | MEDIUM |
| **Rankwidth k** | Decomposition by rank functions | MEDIUM |
| **Cutwidth k** | Linear ordering with minimum cuts | MEDIUM |
| **Bandwidth k** | Banded adjacency matrix | MEDIUM |
| **Branchwidth** | Already in GraphBox | ✅ |

**Why This Matters:**
- **Width parameters** are central to **parameterized complexity**
- **Fixed-parameter tractable** algorithms
- **Graph minor theory** and structural decomposition

---

### 8. Special Bipartite Classes (Priority: MEDIUM)

| Missing Classes | Description | Priority |
|----------------|-------------|----------|
| **Bipartite chain** | Bipartite + chain decomposition | MEDIUM |
| **Bipartite permutation** | Bipartite + permutation | MEDIUM |
| **Convex bipartite** | One partition has convex ordering | MEDIUM |
| **Biconvex** | Both partitions convex | MEDIUM |
| **Chordal bipartite** | Bipartite with no induced 6-cycle | MEDIUM |
| **Interval bigraph** | Bipartite analog of interval | MEDIUM |
| **Proper interval bigraph** | Proper interval analog | MEDIUM |
| **Bipartite distance-hereditary** | Distance-hereditary + bipartite | LOW |

---

### 9. Perfect Graph Variants (Priority: MEDIUM)

| Missing Classes | Description | Priority |
|----------------|-------------|----------|
| **Weakly chordal** | No long holes in G or complement | HIGH |
| **Strongly chordal** | Already in GraphBox | ✅ |
| **Triangulated** | Same as chordal | ✅ |
| **Strictly chordal** | Stronger chordal condition | MEDIUM |
| **Modular** | All maximal cliques have a module | MEDIUM |
| **Ptolemaic** | Distance-hereditary + chordal | MEDIUM |
| **Quasi-line** | Every induced subgraph has dominating vertex | MEDIUM |
| **Locally chordal** | Neighbourhood of every vertex is chordal | LOW |

---

### 10. Forbidden Minor Classes (Priority: MEDIUM)

| Missing Classes | Description | Priority |
|----------------|-------------|----------|
| **Outerplanar** | Planar with no K₄ or K_{2,3} minor | HIGH |
| **Series-parallel** | K₄-minor-free | HIGH |
| **Apex** | Can remove one vertex to make planar | MEDIUM |
| **Partial k-tree** | Treewidth ≤ k | Already covered | ✅ |
| **k-terminal SP** | Series-parallel with k terminals | LOW |
| **Halin** | Planar + tree + cycle | MEDIUM |

---

### 11. Coloring and Orderability Classes (Priority: MEDIUM)

| Missing Classes | Description | Priority |
|----------------|-------------|----------|
| **Perfectly orderable** | Has a perfect order | MEDIUM |
| **Strongly orderable** | Has a strong order | MEDIUM |
| **Welsh-Powell opposition** | Coloring-related property | LOW |
| **β-perfect** | Bounded coloring number | LOW |
| **τₖ-perfect** | Related to clique cover | LOW |

---

### 12. Other Structural Classes (Priority: LOW-MEDIUM)

| Missing Classes | Description | Priority |
|----------------|-------------|----------|
| **Cactus** | Edge-disjoint cycles | LOW |
| **Block graph** | All blocks are cliques | LOW |
| **Caterpillar** | Tree where removing leaves gives path | LOW |
| **Lobster** | Caterpillar where removing leaves gives caterpillar | LOW |
| **Spider graph** | Tree with specific radius/center properties | LOW |
| **Split-neighbourhood** | Special split variant | LOW |
| **Pseudo-split** | Generalization of split | LOW |
| **Quasi-threshold** | Threshold-like property | LOW |
| **Dually chordal** | Complement is chordal | MEDIUM |
| **Hereditary dominating pair** | Has a dominating pair inherited by subgraphs | LOW |
| **Dismantlable** | Can iteratively remove dominated vertices | LOW |
| **Cop-win** | Cop can always win in Cops and Robbers | LOW |

---

## Implementation Priorities

### Phase 1: High-Priority Forbidden Subgraph Classes (Top 20)

1. **P₅-free** graphs
2. **P₆-free** graphs
3. **C₅-free** graphs
4. **C₆-free** graphs
5. **C₄-free** graphs
6. **Bull-free** graphs
7. **Gem-free** graphs
8. **AT-free** graphs
9. **(C₄, C₅)-free** graphs
10. **Claw-free** ✅ (already done)
11. **(P₅, house)-free** graphs
12. **Diamond-free** graphs
13. **Net-free** graphs
14. **House-free** graphs
15. **(C₄, C₆, C₈)-free** graphs
16. **Weakly chordal** graphs
17. **HH-free** graphs
18. **HHD-free** graphs
19. **(fork, house)-free** graphs
20. **(P₅, P₆, C₅)-free** graphs

### Phase 2: Intersection Graph Classes (Top 15)

1. **Circular arc** graphs
2. **Proper circular arc** graphs
3. **Unit circular arc** graphs
4. **Helly circular arc** graphs
5. **Boxicity 2** graphs
6. **Circle** graphs
7. **Disk** graphs
8. **Unit disk** graphs ✅ (already done)
9. **Rectangle intersection** graphs
10. **Segment** graphs
11. **String** graphs
12. **Tolerance** graphs
13. **Bounded tolerance** graphs
14. **Interval bigraph** graphs
15. **Proper interval bigraph** graphs

### Phase 3: Decomposition and Width (Top 10)

1. **Pathwidth k** graphs
2. **Cliquewidth k** graphs
3. **Linear cliquewidth k** graphs
4. **Cutwidth k** graphs
5. **Bandwidth k** graphs
6. **Branchwidth** ✅ (already done)
7. **NLC-width k** graphs
8. **Rankwidth k** graphs
9. **Treewidth k** ✅ (already done)
10. **Module-composed** graphs

### Phase 4: Probe and Augmented Classes (Top 10)

1. **Probe chordal** graphs
2. **Probe interval** graphs
3. **Probe cograph** graphs
4. **Probe comparability** graphs
5. **Probe bipartite** graphs
6. **Probe permutation** graphs
7. **Probe threshold** graphs
8. **Probe P₄-sparse** graphs
9. **Probe P₄-reducible** graphs
10. **Probe P₄-extendible** graphs

### Phase 5: Perfect Graph Variants (Top 10)

1. **Weakly chordal** graphs
2. **Strictly chordal** graphs
3. **Modular** graphs
4. **Ptolemaic** graphs
5. **Quasi-line** graphs
6. **Locally chordal** graphs
7. **Hereditary clique-Helly** graphs
8. **Dually chordal** graphs
9. **Triangulated** graphs ✅ (same as chordal)
10. **Strongly chordal** graphs ✅ (already done)

---

## Architectural Recommendations

### 1. Extend GraphSpec with Forbidden Subgraph Module

```typescript
// src/generation/spec/forbidden-subgraphs.ts

export type ForbiddenSubgraph =
  | { kind: "P5-free" }
  | { kind: "P6-free" }
  | { kind: "C5-free" }
  | { kind: "C6-free" }
  | { kind: "C4-free" }
  | { kind: "bull-free" }
  | { kind: "gem-free" }
  | { kind: "net-free" }
  | { kind: "house-free" }
  | { kind: "diamond-free" }
  | { kind: "AT-free" }
  | { kind: "HH-free" }
  | { kind: "HHD-free" }
  | { kind: "weakly_chordal" }  // No induced hole of length ≥ 5 in G or complement
  | { kind: "multiple_forbidden", forbidden: ForbiddenSubgraph[] };
```

### 2. Create Intersection Graph Module

```typescript
// src/generation/spec/intersection-graphs.ts

export type IntersectionGraphClass =
  | { kind: "circular_arc" }
  | { kind: "proper_circular_arc" }
  | { kind: "unit_circular_arc" }
  | { kind: "helly_circular_arc" }
  | { kind: "circle" }
  | { kind: "disk" }
  | { kind: "rectangle_intersection" }
  | { kind: "segment" }
  | { kind: "string" }
  | { kind: "tolerance" }
  | { kind: "bounded_tolerance", maxRatio: number };
```

### 3. Create Probe Graph Module

```typescript
// src/generation/spec/probe-graphs.ts

export type ProbeGraphClass =
  | { kind: "probe_chordal" }
  | { kind: "probe_interval" }
  | { kind: "probe_cograph" }
  | { kind: "probe_comparability" }
  | { kind: "probe_bipartite" }
  | { kind: "probe_threshold" }
  | { kind: "probe_permutation" }
  | { kind: "probe_P4_sparse" }
  | { kind: "probe_P4_reducible" };
```

### 4. Extend Width Parameters Module

```typescript
// src/generation/spec/width-parameters.ts

export type WidthParameter =
  | { kind: "pathwidth", k: number }
  | { kind: "cliquewidth", k: number }
  | { kind: "linear_cliquewidth", k: number }
  | { kind: "cutwidth", k: number }
  | { kind: "bandwidth", k: number }
  | { kind: "NLC_width", k: number }
  | { kind: "rankwidth", k: number };
```

### 5. Create Generator Functions

For each new class, implement:

1. **Validation function** - Check if graph satisfies class properties
2. **Generation function** - Generate graphs in the class
3. **Property computation** - Compute class-specific invariants

---

## Validation Strategy

### Forbidden Subgraph Detection

Implement efficient **induced subgraph detection** using:

- **Canonical labeling** (nauty/Traces) for graph isomorphism
- **Induced subgraph enumeration** for small patterns (P₅, C₅, bull, gem, etc.)
- **Complement checking** for weakly chordal graphs

### Intersection Graph Recognition

Use **geometric algorithms**:

- **Circular arc recognition** - Booth and Lueker algorithm
- **Interval bigraph recognition** - Linear-time algorithms
- **Unit disk recognition** - NP-hard in general, but approximation exists

### Width Parameter Computation

Implement **exact algorithms** for small graphs:

- **Treewidth** - Using Bodlaender's algorithm
- **Pathwidth** - Dynamic programming
- **Cliquewidth** - NP-hard to compute, use heuristics

---

## Bibliography and References

### Primary Sources

1. **ISGCI - Information System on Graph Classes and their Inclusions**
   - https://www.graphclasses.org/
   - https://www.graphclasses.org/classes.cgi

2. **Brandstadt, Le, Spinrad - "Graph Classes: A Survey" (1999)**
   - Definitive reference on graph classes
   - 500+ pages covering all major classes

3. **Golumbic - "Algorithmic Graph Theory and Perfect Graphs" (2004)**
   - Perfect graph theorem
   - Chordal, comparability, interval graphs

4. **McKee, McMorris - "Topics in Graph Theory: Graph Structures and Their Symmetry"**

### Forbidden Subgraph Classes

5. **"Critical Hereditary Graph Classes: A Survey"** (2021)
   - https://scispace.com/pdf/critical-hereditary-graph-classes-a-survey-1hcoysj8f1.pdf

6. **"Hereditary Classes of Graphs: A Parametric Approach"** (Lozin, 2023)
   - https://wrap.warwick.ac.uk/id/eprint/171156/

### Intersection Graphs

7. **Circular arc graphs** - Booth (1976), Tucker (1980)
8. **Interval bigraphs** - Müller (1998), Hell (2004)
9. **Tolerance graphs** - Golumbic, Monma (1984)

### Width Parameters

10. **Downey, Fellows - "Parameterized Complexity" (2013)**
11. **Bodlaender - "A Linear-Time Algorithm for Finding Tree Decompositions" (1996)**

### Probe Graphs

12. **"Probe Graph Classes"** - Chandran, et al. (2004)
13. **"Probe Interval Graphs"** - Zhang (1994)

---

## Next Steps

1. **Review and prioritize** this list based on research needs
2. **Design the forbidden subgraph module** architecture
3. **Implement top 10 forbidden subgraph classes**
4. **Add intersection graph generation** for circular arc and interval bigraph
5. **Create validation suite** for all new classes
6. **Update documentation** with class definitions and examples

---

**Conclusion:**

GraphBox has excellent foundational coverage (~40 classes) but ISGCI tracks **500+ classes**. The biggest gaps are:

1. **Forbidden subgraph classes** (200+ classes)
2. **Intersection graph classes** (50+ classes)
3. **Probe and augmented classes** (30+ classes)
4. **Width parameter classes** (20+ classes)

With systematic implementation of the **Phase 1-5 priorities** above, GraphBox could reach **50-60% coverage** of known graph classes, making it the most comprehensive open-source graph generation and classification library.
