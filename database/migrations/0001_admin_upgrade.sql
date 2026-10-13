CREATE TABLE `activity_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`admin_id` int,
	`admin_name` varchar(120) NOT NULL,
	`action` varchar(60) NOT NULL,
	`entity` varchar(30) NOT NULL,
	`entity_id` varchar(40),
	`summary` varchar(255) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `activity_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`spent_on` date NOT NULL,
	`category` varchar(40) NOT NULL,
	`description` varchar(255) NOT NULL DEFAULT '',
	`amount` int NOT NULL,
	`admin_id` int,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `expenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`type` varchar(20) NOT NULL,
	`message` varchar(255) NOT NULL,
	`admin_id` int,
	`admin_name` varchar(120),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `order_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`variant_id` int NOT NULL,
	`product_id` int NOT NULL,
	`change` int NOT NULL,
	`balance_after` int NOT NULL,
	`reason` varchar(20) NOT NULL,
	`unit_cost` int,
	`order_id` int,
	`note` varchar(255),
	`admin_id` int,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `stock_movements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `admins` ADD `role` varchar(20) DEFAULT 'OWNER' NOT NULL;--> statement-breakpoint
ALTER TABLE `admins` ADD `is_active` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `admins` ADD `last_login_at` datetime;--> statement-breakpoint
ALTER TABLE `order_items` ADD `unit_cost` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `delivered_at` datetime;--> statement-breakpoint
ALTER TABLE `orders` ADD `paid_at` datetime;--> statement-breakpoint
ALTER TABLE `variants` ADD `cost` int DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `activity_log_created_idx` ON `activity_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `expenses_spent_idx` ON `expenses` (`spent_on`);--> statement-breakpoint
CREATE INDEX `order_events_order_idx` ON `order_events` (`order_id`);--> statement-breakpoint
CREATE INDEX `stock_movements_variant_idx` ON `stock_movements` (`variant_id`);--> statement-breakpoint
CREATE INDEX `stock_movements_created_idx` ON `stock_movements` (`created_at`);