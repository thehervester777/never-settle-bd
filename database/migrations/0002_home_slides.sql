CREATE TABLE `home_slides` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`media_type` varchar(10) NOT NULL DEFAULT 'IMAGE',
	`media_url` varchar(500) NOT NULL,
	`mobile_media_url` varchar(500),
	`poster_url` varchar(500),
	`eyebrow` varchar(80) NOT NULL DEFAULT '',
	`heading` varchar(120) NOT NULL DEFAULT '',
	`text` varchar(300) NOT NULL DEFAULT '',
	`cta_label` varchar(60) NOT NULL DEFAULT '',
	`cta_href` varchar(300) NOT NULL DEFAULT '',
	`cta2_label` varchar(60) NOT NULL DEFAULT '',
	`cta2_href` varchar(300) NOT NULL DEFAULT '',
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `home_slides_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `home_slides_order_idx` ON `home_slides` (`sort_order`);
--> statement-breakpoint
INSERT INTO `home_slides` (`sort_order`, `media_type`, `media_url`, `eyebrow`, `heading`, `text`, `cta_label`, `cta_href`, `cta2_label`, `cta2_href`) VALUES
  (1, 'IMAGE', '/images/hero-1.jpg', 'New season', 'Never\nSettle', 'T-shirts, pants and punjabis cut for everyday Dhaka, plus shoes and wallets to finish the look.', 'Shop new arrivals', '/collections/new-in', 'Shop punjabis', '/collections/punjabis'),
  (2, 'IMAGE', '/images/hero-2.jpg', 'Punjabi season', 'Punjabi\nSeason', 'Festive punjabis and kurtas in breathable cotton and soft linen blends.', 'Shop the edit', '/collections/punjabis', '', '');
