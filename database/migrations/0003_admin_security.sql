-- Sign-in lockout and two-step sign-in. The app adds these columns by itself on start-up;
-- this file is for anyone who prefers to upgrade the database by hand.
ALTER TABLE `admins` ADD `failed_logins` int NOT NULL DEFAULT 0;
ALTER TABLE `admins` ADD `locked_until` datetime;
ALTER TABLE `admins` ADD `totp_secret` varchar(255);
ALTER TABLE `admins` ADD `totp_enabled_at` datetime;
ALTER TABLE `admins` ADD `totp_last_step` int NOT NULL DEFAULT 0;
ALTER TABLE `admins` ADD `recovery_codes` text;
