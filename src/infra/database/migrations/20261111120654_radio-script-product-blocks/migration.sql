CREATE TABLE `radio_script_product_blocks` (
	`productId` text PRIMARY KEY NOT NULL,
	`blockId` integer NOT NULL,
	CONSTRAINT `fk_radio_script_product_blocks_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `radio_script_template` ADD `speakRepeatedOnce` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `radio_script_template` ADD `splitEvenly` integer DEFAULT false NOT NULL;