CREATE TABLE `coupons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(40) NOT NULL,
	`description` varchar(160) NOT NULL DEFAULT '',
	`type` varchar(20) NOT NULL,
	`value` int NOT NULL DEFAULT 0,
	`min_subtotal` int NOT NULL DEFAULT 0,
	`max_discount` int,
	`usage_limit` int,
	`used_count` int NOT NULL DEFAULT 0,
	`once_per_customer` boolean NOT NULL DEFAULT false,
	`starts_at` datetime,
	`ends_at` datetime,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `coupons_id` PRIMARY KEY(`id`),
	CONSTRAINT `coupons_code_uq` UNIQUE(`code`)
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `discount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `coupon_code` varchar(40);--> statement-breakpoint
ALTER TABLE `orders` ADD `source` varchar(40);--> statement-breakpoint
ALTER TABLE `orders` ADD `medium` varchar(60);--> statement-breakpoint
ALTER TABLE `orders` ADD `campaign` varchar(120);--> statement-breakpoint
ALTER TABLE `orders` ADD `attribution` text;