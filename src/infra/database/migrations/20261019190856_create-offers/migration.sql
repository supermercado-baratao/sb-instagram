CREATE TABLE `offer_page_items` (
	`pageId` integer NOT NULL,
	`position` integer NOT NULL,
	`productCode` text NOT NULL,
	`priceInCents` integer NOT NULL,
	CONSTRAINT `offer_page_items_pk` PRIMARY KEY(`pageId`, `position`),
	CONSTRAINT `fk_offer_page_items_pageId_offer_pages_id_fk` FOREIGN KEY (`pageId`) REFERENCES `offer_pages`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_offer_page_items_productCode_products_code_fk` FOREIGN KEY (`productCode`) REFERENCES `products`(`code`)
);
--> statement-breakpoint
CREATE TABLE `offer_pages` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`offerId` integer NOT NULL,
	`position` integer NOT NULL,
	`templateId` text NOT NULL,
	`layout` integer NOT NULL,
	CONSTRAINT `fk_offer_pages_offerId_offers_id_fk` FOREIGN KEY (`offerId`) REFERENCES `offers`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `offers` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL,
	`validUntil` text,
	`highlightTitle` text NOT NULL,
	`highlightMessage` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `offer_pages_offer_id_position_unique` ON `offer_pages` (`offerId`,`position`);