import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createBookmark,
	deleteBookmark,
	fetchBookmarks,
} from "./archive-api.js";

/**
 * Bookmark toggle for a content item (v1.6.0).
 *
 * Bookmarks are a flag on a content item. `saved` is derived from the cached
 * bookmarks list (server truth); toggling mutates through the engine and
 * invalidates archive/bookmark queries. The button is inert (disabled) when
 * the item has no spine id yet (e.g. a pre-migration article).
 *
 * `contentItemId` may arrive asynchronously (detail pages load after mount) —
 * a ref keeps the latest value for the mutation.
 */
export function useBookmarkToggle(contentItemId: string | null | undefined) {
	const queryClient = useQueryClient();
	const idRef = useRef(contentItemId);
	idRef.current = contentItemId;

	const { data } = useQuery({
		queryKey: ["bookmarks"],
		queryFn: () => fetchBookmarks({ limit: 500 }),
		enabled: Boolean(contentItemId),
	});

	const saved =
		Boolean(contentItemId) &&
		Boolean(data?.items.some((i) => i.contentItemId === contentItemId));

	const mutation = useMutation({
		mutationFn: (next: boolean): Promise<unknown> =>
			next ? createBookmark(idRef.current!) : deleteBookmark(idRef.current!),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
			queryClient.invalidateQueries({ queryKey: ["archive"] });
		},
	});

	const enabled = Boolean(idRef.current);
	return {
		saved,
		enabled,
		toggle: () => {
			if (!idRef.current) return;
			mutation.mutate(!saved);
		},
	};
}
