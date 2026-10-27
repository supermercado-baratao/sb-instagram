-- Hand-written after drizzle-kit generate, to carry each product, its codes and the offer items
-- over to the new id (#55). Migrations run inside a transaction, where PRAGMA foreign_keys is a
-- no-op, so the new tables point to __new_products and RENAME TO updates those references
CREATE TABLE `__product_ids` (
	`code` text PRIMARY KEY NOT NULL,
	`id` text NOT NULL
);
--> statement-breakpoint
-- A random UUID v4, the format crypto.randomUUID gives new products
INSERT INTO `__product_ids`(`code`, `id`) SELECT `code`, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + abs(random()) % 4, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) FROM `products`;--> statement-breakpoint
CREATE TABLE `__new_products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`brand` text,
	`unit` text,
	`photo` text
);
--> statement-breakpoint
INSERT INTO `__new_products`(`id`, `name`, `brand`, `unit`, `photo`) SELECT `__product_ids`.`id`, `name`, `brand`, `unit`, `photo` FROM `products` INNER JOIN `__product_ids` ON `__product_ids`.`code` = `products`.`code`;--> statement-breakpoint
CREATE TABLE `__new_product_codes` (
	`productId` text NOT NULL,
	`code` text NOT NULL,
	CONSTRAINT `product_codes_pk` PRIMARY KEY(`productId`, `code`),
	CONSTRAINT `fk_product_codes_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `__new_products`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_product_codes`(`productId`, `code`) SELECT `id`, `code` FROM `__product_ids` UNION SELECT `__product_ids`.`id`, `product_codes`.`code` FROM `product_codes` INNER JOIN `__product_ids` ON `__product_ids`.`code` = `product_codes`.`productCode`;--> statement-breakpoint
CREATE TABLE `__new_offer_page_items` (
	`pageId` integer NOT NULL,
	`position` integer NOT NULL,
	`productId` text NOT NULL,
	`priceInCents` integer NOT NULL,
	CONSTRAINT `offer_page_items_pk` PRIMARY KEY(`pageId`, `position`),
	CONSTRAINT `fk_offer_page_items_pageId_offer_pages_id_fk` FOREIGN KEY (`pageId`) REFERENCES `offer_pages`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_offer_page_items_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `__new_products`(`id`)
);
--> statement-breakpoint
INSERT INTO `__new_offer_page_items`(`pageId`, `position`, `productId`, `priceInCents`) SELECT `pageId`, `position`, `__product_ids`.`id`, `priceInCents` FROM `offer_page_items` INNER JOIN `__product_ids` ON `__product_ids`.`code` = `offer_page_items`.`productCode`;--> statement-breakpoint
DROP TABLE `offer_page_items`;--> statement-breakpoint
DROP TABLE `product_codes`;--> statement-breakpoint
DROP TABLE `products`;--> statement-breakpoint
DROP TABLE `__product_ids`;--> statement-breakpoint
ALTER TABLE `__new_products` RENAME TO `products`;--> statement-breakpoint
ALTER TABLE `__new_product_codes` RENAME TO `product_codes`;--> statement-breakpoint
ALTER TABLE `__new_offer_page_items` RENAME TO `offer_page_items`;--> statement-breakpoint
CREATE INDEX `product_codes_code_index` ON `product_codes` (`code`);
