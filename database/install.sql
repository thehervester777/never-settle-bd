-- NEVER SETTLE database tables.
-- Import this in cPanel → phpMyAdmin → (select your database) → Import.
-- Then import sample-data.sql if you want the demo categories and products.
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE `admins` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(160) NOT NULL,
	`name` varchar(120) NOT NULL,
	`password_hash` varchar(100) NOT NULL,
	`role` varchar(20) NOT NULL DEFAULT 'OWNER',
	`is_active` boolean NOT NULL DEFAULT true,
	`last_login_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `admins_id` PRIMARY KEY(`id`),
	CONSTRAINT `admins_email_uq` UNIQUE(`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`slug` varchar(140) NOT NULL,
	`description` text,
	`image` varchar(500),
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_slug_uq` UNIQUE(`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  CONSTRAINT `stock_movements_id` PRIMARY KEY(`id`),
  INDEX `stock_movements_variant_idx` (`variant_id`),
  INDEX `stock_movements_created_idx` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `expenses` (
  `id` int AUTO_INCREMENT NOT NULL,
  `spent_on` date NOT NULL,
  `category` varchar(40) NOT NULL,
  `description` varchar(255) NOT NULL DEFAULT '',
  `amount` int NOT NULL,
  `admin_id` int,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `expenses_id` PRIMARY KEY(`id`),
  INDEX `expenses_spent_idx` (`spent_on`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `order_events` (
  `id` int AUTO_INCREMENT NOT NULL,
  `order_id` int NOT NULL,
  `type` varchar(20) NOT NULL,
  `message` varchar(255) NOT NULL,
  `admin_id` int,
  `admin_name` varchar(120),
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `order_events_id` PRIMARY KEY(`id`),
  INDEX `order_events_order_idx` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `activity_log` (
  `id` int AUTO_INCREMENT NOT NULL,
  `admin_id` int,
  `admin_name` varchar(120) NOT NULL,
  `action` varchar(60) NOT NULL,
  `entity` varchar(30) NOT NULL,
  `entity_id` varchar(40),
  `summary` varchar(255) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `activity_log_id` PRIMARY KEY(`id`),
  INDEX `activity_log_created_idx` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`email` varchar(160) NOT NULL,
	`phone` varchar(20),
	`order_no` varchar(20),
	`body` text NOT NULL,
	`is_read` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`product_id` int,
	`variant_id` int,
	`title` varchar(200) NOT NULL,
	`options` varchar(120) NOT NULL DEFAULT '',
	`image` varchar(500),
	`unit_price` int NOT NULL,
	`unit_cost` int NOT NULL DEFAULT 0,
	`quantity` int NOT NULL,
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`number` varchar(20) NOT NULL,
	`status` enum('PENDING','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','CANCELLED','RETURNED') NOT NULL DEFAULT 'PENDING',
	`payment_method` enum('COD','SSLCOMMERZ') NOT NULL,
	`payment_status` enum('UNPAID','PAID','FAILED','REFUNDED') NOT NULL DEFAULT 'UNPAID',
	`customer_name` varchar(120) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`email` varchar(160),
	`address` text NOT NULL,
	`city` varchar(80) NOT NULL,
	`area` varchar(80),
	`zone` varchar(20) NOT NULL,
	`note` text,
	`subtotal` int NOT NULL,
	`shipping_fee` int NOT NULL,
	`total` int NOT NULL,
	`stock_released` boolean NOT NULL DEFAULT false,
	`delivered_at` datetime,
	`paid_at` datetime,
	`discount` int NOT NULL DEFAULT 0,
	`coupon_code` varchar(40),
	`source` varchar(40),
	`medium` varchar(60),
	`campaign` varchar(120),
	`attribution` text,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_number_uq` UNIQUE(`number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`provider` varchar(30) NOT NULL,
	`tran_id` varchar(60) NOT NULL,
	`val_id` varchar(80),
	`amount` int NOT NULL,
	`currency` varchar(8) NOT NULL DEFAULT 'BDT',
	`status` varchar(20) NOT NULL,
	`card_type` varchar(60),
	`bank_tran_id` varchar(80),
	`raw` text,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `payments_tran_uq` UNIQUE(`tran_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `product_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`url` varchar(500) NOT NULL,
	`alt` varchar(200) NOT NULL DEFAULT '',
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `product_images_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(200) NOT NULL,
	`slug` varchar(220) NOT NULL,
	`description` text NOT NULL,
	`details` text,
	`category_id` int NOT NULL,
	`price` int NOT NULL,
	`compare_at` int,
	`tags` varchar(300) NOT NULL DEFAULT '',
	`is_active` boolean NOT NULL DEFAULT true,
	`is_featured` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_slug_uq` UNIQUE(`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `settings` (
	`key` varchar(60) NOT NULL,
	`value` text NOT NULL,
	CONSTRAINT `settings_key` PRIMARY KEY(`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `subscribers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(160) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `subscribers_id` PRIMARY KEY(`id`),
	CONSTRAINT `subscribers_email_uq` UNIQUE(`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `variants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`color` varchar(60),
	`size` varchar(30),
	`sku` varchar(80),
	`stock` int NOT NULL DEFAULT 0,
	`cost` int NOT NULL DEFAULT 0,
	CONSTRAINT `variants_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `order_items_order_idx` ON `order_items` (`order_id`);

CREATE INDEX `orders_phone_idx` ON `orders` (`phone`);

CREATE INDEX `orders_status_created_idx` ON `orders` (`status`,`created_at`);

CREATE INDEX `payments_order_idx` ON `payments` (`order_id`);

CREATE INDEX `product_images_product_idx` ON `product_images` (`product_id`);

CREATE INDEX `products_category_idx` ON `products` (`category_id`);

CREATE INDEX `products_active_created_idx` ON `products` (`is_active`,`created_at`);

CREATE INDEX `variants_product_idx` ON `variants` (`product_id`);

SET FOREIGN_KEY_CHECKS = 1;
