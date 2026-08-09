import { Body, Controller, Get, Inject, Post } from "@nestjs/common";
import { TrashService } from "./trash.service.js";
import type {
	EmptyTrashInput,
	PurgeTrashInput,
	RestoreTrashInput,
} from "@vorynth/types";

/**
 * Trash endpoints (v1.7.0).
 *
 *   GET  /trash           unified list (trashed collections + history)
 *   POST /trash/restore   { kind, id } → back to the live view
 *   POST /trash/purge     { kind, id, force? } → permanent delete (409 when
 *                          bookmarked items are inside and force is absent)
 *   POST /trash/empty     { force? } → permanently delete everything in trash
 */
@Controller("trash")
export class TrashController {
	constructor(@Inject(TrashService) private readonly trash: TrashService) {}

	@Get()
	list() {
		return this.trash.list();
	}

	@Post("restore")
	async restore(@Body() body: RestoreTrashInput) {
		await this.trash.restore(body ?? {});
		return { restored: true };
	}

	@Post("purge")
	async purge(@Body() body: PurgeTrashInput) {
		const removed = await this.trash.purge(body ?? {});
		return { removed };
	}

	@Post("empty")
	empty(@Body() body: EmptyTrashInput) {
		const removed = this.trash.empty(Boolean(body?.force));
		return { removed };
	}
}
