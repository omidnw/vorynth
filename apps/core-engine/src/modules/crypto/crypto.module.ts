import { Global, Module } from "@nestjs/common";
import { CryptoService } from "./crypto.service.js";

/**
 * Global crypto module. Owns the AES-256-GCM key used to encrypt API keys at
 * rest. Feature modules inject `CryptoService` to seal/unseal secrets.
 */
@Global()
@Module({
	providers: [CryptoService],
	exports: [CryptoService],
})
export class CryptoModule {}
