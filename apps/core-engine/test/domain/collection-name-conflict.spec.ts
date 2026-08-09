import { ConflictException } from "@nestjs/common";
import { ArchiveService } from "../../src/modules/archive/archive.service.js";
import { createTestDb } from "../helpers/db.js";

/**
 * Collection sibling name rules (R-A11, v1.6.0).
 *
 * A folder and a category with the same name under the same parent coexist —
 * their `kind` differs, so they are distinct siblings. Two folders (or two
 * categories) with the same name under the same parent are refused with a 409
 * (`COLLECTION_NAME_CONFLICT`), and the comparison is case-insensitive, so
 * "Work" and "work" collide.
 */

/** Asserts the promise rejects with a 409 ConflictException (and, optionally,
 * a message fragment). */
async function expectConflict(
	promise: Promise<unknown>,
	message?: RegExp,
): Promise<void> {
	const error = await promise.catch((e: unknown) => e);
	expect(error).toBeInstanceOf(ConflictException);
	if (message) expect((error as Error).message).toMatch(message);
}

describe("collection sibling name uniqueness (R-A11)", () => {
	it("a folder and a category with the same name coexist under one parent", async () => {
		const db = createTestDb();
		try {
			const archive = new ArchiveService(db.service);
			const tech = await archive.createCollection({
				name: "Tech",
				kind: "category",
			});
			const parent = await archive.createCollection({
				name: "Parent",
				kind: "folder",
				parentId: tech.id,
			});
			// Cross-kind siblings, same name — both allowed.
			const folder = await archive.createCollection({
				name: "Work",
				kind: "folder",
				parentId: parent.id,
			});
			const category = await archive.createCollection({
				name: "Work",
				kind: "category",
				parentId: parent.id,
			});
			expect(folder.kind).toBe("folder");
			expect(category.kind).toBe("category");
			expect(folder.id).not.toBe(category.id);
		} finally {
			db.close();
		}
	});

	it("a second folder with the same name under the same parent is refused", async () => {
		const db = createTestDb();
		try {
			const archive = new ArchiveService(db.service);
			const tech = await archive.createCollection({
				name: "Tech",
				kind: "category",
			});
			const parent = await archive.createCollection({
				name: "Parent",
				kind: "folder",
				parentId: tech.id,
			});
			await archive.createCollection({
				name: "Work",
				kind: "folder",
				parentId: parent.id,
			});
			await expectConflict(
				archive.createCollection({
					name: "Work",
					kind: "folder",
					parentId: parent.id,
				}),
				/A folder named "Work" already exists here/,
			);
		} finally {
			db.close();
		}
	});

	it("a second root category with the same name is refused", async () => {
		const db = createTestDb();
		try {
			const archive = new ArchiveService(db.service);
			await archive.createCollection({ name: "Research", kind: "category" });
			await expectConflict(
				archive.createCollection({ name: "Research", kind: "category" }),
				/A category named "Research" already exists here/,
			);
		} finally {
			db.close();
		}
	});

	it("the same name is allowed under different parents", async () => {
		const db = createTestDb();
		try {
			const archive = new ArchiveService(db.service);
			const tech = await archive.createCollection({
				name: "Tech",
				kind: "category",
			});
			const design = await archive.createCollection({
				name: "Design",
				kind: "category",
			});
			const a = await archive.createCollection({
				name: "Work",
				kind: "folder",
				parentId: tech.id,
			});
			const b = await archive.createCollection({
				name: "Work",
				kind: "folder",
				parentId: design.id,
			});
			expect(a.id).not.toBe(b.id);
		} finally {
			db.close();
		}
	});

	it("rename onto a same-kind sibling name is refused; onto a category name is fine", async () => {
		const db = createTestDb();
		try {
			const archive = new ArchiveService(db.service);
			const tech = await archive.createCollection({
				name: "Tech",
				kind: "category",
			});
			const parent = await archive.createCollection({
				name: "Parent",
				kind: "folder",
				parentId: tech.id,
			});
			const alpha = await archive.createCollection({
				name: "Alpha",
				kind: "folder",
				parentId: parent.id,
			});
			const beta = await archive.createCollection({
				name: "Beta",
				kind: "folder",
				parentId: parent.id,
			});
			// A category sibling may share the folder name…
			await archive.createCollection({
				name: "Gamma",
				kind: "category",
				parentId: parent.id,
			});

			// Rename Beta → Alpha (same-kind sibling) is refused.
			await expectConflict(
				archive.updateCollection(beta.id, { name: "Alpha" }),
			);
			// Rename Beta → Gamma (cross-kind sibling name) is allowed.
			expect(
				(await archive.updateCollection(beta.id, { name: "Gamma" })).name,
			).toBe("Gamma");
			expect(alpha.name).toBe("Alpha");
		} finally {
			db.close();
		}
	});

	it("names collide case-insensitively ('Work' vs 'work')", async () => {
		const db = createTestDb();
		try {
			const archive = new ArchiveService(db.service);
			const tech = await archive.createCollection({
				name: "Tech",
				kind: "category",
			});
			await archive.createCollection({
				name: "Work",
				kind: "folder",
				parentId: tech.id,
			});
			await expectConflict(
				archive.createCollection({
					name: "work",
					kind: "folder",
					parentId: tech.id,
				}),
			);
		} finally {
			db.close();
		}
	});
});
