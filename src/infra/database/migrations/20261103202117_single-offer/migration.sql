-- Rebuilt under temporary names, because PRAGMA foreign_keys is a no-op inside the migrator's
-- transaction: the new tables point to the __new_ ones and RENAME TO updates those references
CREATE TABLE `__new_offers` (
	`id` integer PRIMARY KEY,
	`validUntil` text,
	`highlightTitle` text NOT NULL,
	`highlightMessage` text NOT NULL,
	CONSTRAINT "offers_single_row" CHECK("id" = 1)
);
--> statement-breakpoint
CREATE TABLE `__current_offer` AS SELECT `id` FROM `offers` ORDER BY `updatedAt` DESC, `id` DESC LIMIT 1;--> statement-breakpoint
INSERT INTO `__new_offers`(`id`, `validUntil`, `highlightTitle`, `highlightMessage`) SELECT 1, `validUntil`, `highlightTitle`, `highlightMessage` FROM `offers` WHERE `id` = (SELECT `id` FROM `__current_offer`);--> statement-breakpoint
CREATE TABLE `__new_offer_pages` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`position` integer NOT NULL,
	`templateId` text NOT NULL,
	`layout` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_offer_pages`(`id`, `position`, `templateId`, `layout`) SELECT `id`, `position`, `templateId`, `layout` FROM `offer_pages` WHERE `offerId` = (SELECT `id` FROM `__current_offer`);--> statement-breakpoint
CREATE TABLE `__new_offer_page_items` (
	`pageId` integer NOT NULL,
	`position` integer NOT NULL,
	`productId` text NOT NULL,
	`priceInCents` integer NOT NULL,
	CONSTRAINT `offer_page_items_pk` PRIMARY KEY(`pageId`, `position`),
	CONSTRAINT `fk_offer_page_items_pageId_offer_pages_id_fk` FOREIGN KEY (`pageId`) REFERENCES `__new_offer_pages`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_offer_page_items_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`)
);
--> statement-breakpoint
INSERT INTO `__new_offer_page_items`(`pageId`, `position`, `productId`, `priceInCents`) SELECT `pageId`, `position`, `productId`, `priceInCents` FROM `offer_page_items` WHERE `pageId` IN (SELECT `id` FROM `__new_offer_pages`);--> statement-breakpoint
CREATE TABLE `__new_offer_generations` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`offerId` integer NOT NULL,
	`number` integer NOT NULL,
	`offerExport` text NOT NULL,
	`pageCount` integer NOT NULL,
	`radioScript` text,
	`createdAt` integer NOT NULL,
	CONSTRAINT `fk_offer_generations_offerId_offers_id_fk` FOREIGN KEY (`offerId`) REFERENCES `__new_offers`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_offer_generations`(`id`, `offerId`, `number`, `offerExport`, `pageCount`, `radioScript`, `createdAt`) SELECT `id`, 1, ROW_NUMBER() OVER (ORDER BY `createdAt`, `id`), `offerExport`, `pageCount`, `radioScript`, `createdAt` FROM `offer_generations`;--> statement-breakpoint
-- A deleted generation's id must never come back, since its files' URLs are cached as immutable
DELETE FROM `sqlite_sequence` WHERE `name` = '__new_offer_generations';--> statement-breakpoint
INSERT INTO `sqlite_sequence`(`name`, `seq`) SELECT '__new_offer_generations', `seq` FROM `sqlite_sequence` WHERE `name` = 'offer_generations';--> statement-breakpoint
DROP TABLE `offer_page_items`;--> statement-breakpoint
DROP TABLE `offer_generations`;--> statement-breakpoint
DROP TABLE `offer_pages`;--> statement-breakpoint
DROP TABLE `offers`;--> statement-breakpoint
DROP TABLE `__current_offer`;--> statement-breakpoint
ALTER TABLE `__new_offers` RENAME TO `offers`;--> statement-breakpoint
ALTER TABLE `__new_offer_pages` RENAME TO `offer_pages`;--> statement-breakpoint
ALTER TABLE `__new_offer_page_items` RENAME TO `offer_page_items`;--> statement-breakpoint
ALTER TABLE `__new_offer_generations` RENAME TO `offer_generations`;--> statement-breakpoint
CREATE UNIQUE INDEX `offer_pages_position_unique` ON `offer_pages` (`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `offer_generations_offer_id_number_unique` ON `offer_generations` (`offerId`,`number`);
