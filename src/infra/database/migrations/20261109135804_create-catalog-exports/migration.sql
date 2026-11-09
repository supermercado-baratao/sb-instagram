CREATE TABLE `catalog_exports` (
	`productId` text PRIMARY KEY NOT NULL,
	`fingerprint` text NOT NULL,
	`exportedAt` integer NOT NULL,
	CONSTRAINT `fk_catalog_exports_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE
);
