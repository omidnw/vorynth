import { apiFetch } from "@/lib/api/config";
import type {
	ArchiveItem,
	ArchiveItemList,
	BookmarkList,
	Collection,
	CollectionList,
	CreateCollectionInput,
	UpdateArchiveItemInput,
	UpdateCollectionInput,
} from "@vorynth/types";

/** GET /archive/items — filters + curated default (bookmarked + recent). */
export async function fetchArchiveItems(params?: {
	contentType?: string;
	collectionId?: string;
	tag?: string;
	q?: string;
	archived?: boolean;
	bookmarked?: boolean;
	limit?: number;
	offset?: number;
}): Promise<ArchiveItemList> {
	const qs = new URLSearchParams();
	if (params?.contentType) qs.set("contentType", params.contentType);
	if (params?.collectionId) qs.set("collectionId", params.collectionId);
	if (params?.tag) qs.set("tag", params.tag);
	if (params?.q) qs.set("q", params.q);
	if (params?.archived !== undefined) qs.set("archived", String(params.archived));
	if (params?.bookmarked !== undefined)
		qs.set("bookmarked", String(params.bookmarked));
	if (params?.limit) qs.set("limit", String(params.limit));
	if (params?.offset) qs.set("offset", String(params.offset));
	const q = qs.toString();
	return apiFetch<ArchiveItemList>(`/archive/items${q ? `?${q}` : ""}`);
}

export async function fetchArchiveItem(id: string): Promise<ArchiveItem> {
	return apiFetch<ArchiveItem>(`/archive/items/${id}`);
}

export async function patchArchiveItem(
	id: string,
	patch: UpdateArchiveItemInput,
): Promise<ArchiveItem> {
	return apiFetch<ArchiveItem>(`/archive/items/${id}`, {
		method: "PATCH",
		body: JSON.stringify(patch),
	});
}

// ── Collections ─────────────────────────────────────────────────────────────

export async function fetchCollections(): Promise<CollectionList> {
	return apiFetch<CollectionList>("/archive/collections");
}

export async function createCollection(
	input: CreateCollectionInput,
): Promise<Collection> {
	return apiFetch<Collection>("/archive/collections", {
		method: "POST",
		body: JSON.stringify(input),
	});
}

export async function updateCollection(
	id: string,
	patch: UpdateCollectionInput,
): Promise<Collection> {
	return apiFetch<Collection>(`/archive/collections/${id}`, {
		method: "PATCH",
		body: JSON.stringify(patch),
	});
}

export async function deleteCollection(id: string): Promise<void> {
	await apiFetch<{ id: string; removed: boolean }>(
		`/archive/collections/${id}`,
		{ method: "DELETE" },
	);
}

// ── Bookmarks ───────────────────────────────────────────────────────────────

export async function fetchBookmarks(params?: {
	limit?: number;
	offset?: number;
}): Promise<BookmarkList> {
	const qs = new URLSearchParams();
	if (params?.limit) qs.set("limit", String(params.limit));
	if (params?.offset) qs.set("offset", String(params.offset));
	const q = qs.toString();
	return apiFetch<BookmarkList>(`/bookmarks${q ? `?${q}` : ""}`);
}

/** Save a content item. Throws ApiException(409) when already saved. */
export async function createBookmark(
	contentItemId: string,
): Promise<ArchiveItem> {
	return apiFetch<ArchiveItem>("/bookmarks", {
		method: "POST",
		body: JSON.stringify({ contentItemId }),
	});
}

/** Unsave — removes only the flag; the item stays. */
export async function deleteBookmark(
	contentItemId: string,
): Promise<{ removed: boolean }> {
	return apiFetch<{ removed: boolean }>(`/bookmarks/${contentItemId}`, {
		method: "DELETE",
	});
}
