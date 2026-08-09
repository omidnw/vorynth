import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	Get,
	Header,
	Inject,
	Param,
	Patch,
	Post,
	Query,
	Req,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { PluginsService } from "./plugins.service.js";
import type {
	PluginInfo,
	PluginScanResult,
	UpdatePluginInput,
} from "@vorynth/types";

/**
 * Plugin management endpoints (v1.8.0, project-details.md §27).
 *
 *   GET    /plugins             list all plugins + enable state + configuration
 *   PATCH  /plugins/:id         enable/disable and/or merge configuration
 *   POST   /plugins/scan        re-scan data/plugins/ for dropped-in folders
 *   POST   /plugins/install     install a .vorynth-plugin package (zip body)
 *   DELETE /plugins/:id         uninstall a user-installed plugin (409 for core)
 *   GET    /plugins/:id/bundle  the installed plugin's bundle (UI code)
 *   GET    /plugins/:id/assets/:file  a packaged asset (custom icon, v1.8.0)
 */
@Controller("plugins")
export class PluginsController {
	constructor(
		@Inject(PluginsService) private readonly plugins: PluginsService,
	) {}

	@Get()
	async list() {
		return this.plugins.list();
	}

	@Patch(":id")
	async patch(@Param("id") id: string, @Body() body: UpdatePluginInput) {
		return this.plugins.update(id, body);
	}

	@Post("scan")
	scan(): PluginScanResult {
		return this.plugins.scanInstalledPlugins();
	}

	/**
	 * Install a `.vorynth-plugin` package. The desktop sends the file bytes as
	 * `application/octet-stream` (Fastify parses that into a Buffer); any other
	 * body shape is rejected.
	 */
	@Post("install")
	async install(@Req() req: FastifyRequest): Promise<PluginInfo> {
		const body = req.body;
		if (!Buffer.isBuffer(body)) {
			throw new BadRequestException({
				code: "PLUGIN_INVALID_PACKAGE",
				message: "Upload a .vorynth-plugin file.",
			});
		}
		return this.plugins.installPackage(body);
	}

	@Get("dir")
	dir(): { dir: string } {
		return this.plugins.pluginsDir();
	}

	@Delete(":id")
	remove(@Param("id") id: string, @Query("force") force?: string) {
		this.plugins.uninstall(id, force === "true");
	}

	@Get(":id/bundle")
	@Header("Content-Type", "application/javascript")
	@Header("Cache-Control", "no-cache")
	bundle(@Param("id") id: string): Buffer {
		return this.plugins.readBundle(id);
	}

	/**
	 * Serve a packaged asset (v1.8.0 — custom image icons): any file an
	 * installed plugin extracted into its own folder (e.g. `assets/icon.png`),
	 * path-traversal guarded in the service. Local-only — never a remote fetch.
	 */
	@Get(":id/assets/:file")
	@Header("Cache-Control", "no-cache")
	asset(@Param("id") id: string, @Param("file") file: string): Buffer {
		return this.plugins.readAsset(id, file);
	}
}
