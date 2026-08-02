import type { ArchiveItem, Collection } from "@vorynth/types";

/** A node in the collections tree (categories → folders → items). */
export interface TreeNode {
	id: string;
	name: string;
	kind: "category" | "folder";
	items: ArchiveItem[];
	children: TreeNode[];
}

/**
 * Build the collections tree from flat collections + items.
 *
 * Items attach to their own collection node only (items live at leaves, R-A11)
 * — a sub-folder's items never appear on its parent node. Roots are collections
 * with no parent; a parentId pointing at a missing collection degrades to root.
 */
export function buildTree(
	collections: Collection[],
	items: ArchiveItem[],
): TreeNode[] {
	const nodes = new Map<string, TreeNode>();
	for (const c of collections) {
		nodes.set(c.id, {
			id: c.id,
			name: c.name,
			kind: c.kind,
			items: [],
			children: [],
		});
	}

	// Attach items to their collections.
	for (const item of items) {
		if (item.collectionId && nodes.has(item.collectionId)) {
			nodes.get(item.collectionId)!.items.push(item);
		}
	}

	// Build the tree: roots are collections with no parent; children attach to parents.
	const roots: TreeNode[] = [];
	for (const c of collections) {
		const node = nodes.get(c.id)!;
		if (c.parentId && nodes.has(c.parentId)) {
			nodes.get(c.parentId)!.children.push(node);
		} else {
			roots.push(node);
		}
	}
	return roots;
}

/** Find the node with `id` and return the path from its root down to it. */
export function findNodePath(roots: TreeNode[], id: string): TreeNode[] | null {
	for (const root of roots) {
		if (root.id === id) return [root];
		const childPath = findNodePath(root.children, id);
		if (childPath) return [root, ...childPath];
	}
	return null;
}

/** Sum of items across a node's whole subtree (its own + all descendants). */
export function subtreeItemCount(node: TreeNode): number {
	let count = node.items.length;
	for (const child of node.children) count += subtreeItemCount(child);
	return count;
}

/** Sum of folders across a node's whole subtree (all descendants, not itself). */
export function subtreeFolderCount(node: TreeNode): number {
	let count = node.children.length;
	for (const child of node.children) count += subtreeFolderCount(child);
	return count;
}
