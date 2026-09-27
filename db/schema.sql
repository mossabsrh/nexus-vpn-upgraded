-- Database schema for NexusVPN
-- Character set utf8mb4

SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS `nexus_vpn` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `nexus_vpn`;

-- Users table (stores hashed passwords)
CREATE TABLE IF NOT EXISTS `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `email_verified_at` DATETIME DEFAULT NULL,
  `remember_token` VARCHAR(100) DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`),
  KEY `users_email_idx` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Password resets
CREATE TABLE IF NOT EXISTS `password_resets` (
  `email` VARCHAR(255) NOT NULL,
  `token` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Plans / Offers
CREATE TABLE IF NOT EXISTS `plans` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `slug` VARCHAR(100) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `monthly_price` INT DEFAULT NULL, -- store cents or smallest currency unit if needed
  `yearly_price` INT DEFAULT NULL,
  `yearly_total` INT DEFAULT NULL,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'DZD',
  `features` JSON DEFAULT NULL,
  `popular` TINYINT(1) NOT NULL DEFAULT 0,
  `cta` VARCHAR(100) DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `plans_slug_unique` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Subscriptions (link users to plans)
CREATE TABLE IF NOT EXISTS `subscriptions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `plan_id` BIGINT UNSIGNED NOT NULL,
  `seats` INT DEFAULT 1,
  `billing_period` ENUM('monthly','yearly') NOT NULL DEFAULT 'monthly',
  `status` ENUM('trialing','active','past_due','canceled') NOT NULL DEFAULT 'active',
  `trial_ends_at` DATETIME DEFAULT NULL,
  `current_period_end` DATETIME DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `subscriptions_user_idx` (`user_id`),
  KEY `subscriptions_plan_idx` (`plan_id`),
  CONSTRAINT `subscriptions_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `subscriptions_plan_fk` FOREIGN KEY (`plan_id`) REFERENCES `plans` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Payments / Transactions
CREATE TABLE IF NOT EXISTS `payments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `subscription_id` BIGINT UNSIGNED DEFAULT NULL,
  `amount` INT NOT NULL,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'DZD',
  `status` ENUM('pending','succeeded','failed','refunded') NOT NULL DEFAULT 'pending',
  `provider` VARCHAR(100) DEFAULT NULL,
  `provider_response` JSON DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `payments_user_idx` (`user_id`),
  CONSTRAINT `payments_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `payments_subscription_fk` FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Simple teams table (optional; used for centralized billing / team seats)
CREATE TABLE IF NOT EXISTS `teams` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(150) NOT NULL,
  `owner_id` BIGINT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `teams_owner_fk` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Team members join table
CREATE TABLE IF NOT EXISTS `team_user` (
  `team_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `role` VARCHAR(50) DEFAULT 'member',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`team_id`,`user_id`),
  CONSTRAINT `team_user_team_fk` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE CASCADE,
  CONSTRAINT `team_user_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Indexes to speed up common lookups
CREATE INDEX IF NOT EXISTS `idx_users_created_at` ON `users` (`created_at`);
CREATE INDEX IF NOT EXISTS `idx_plans_created_at` ON `plans` (`created_at`);

-- Seed-ish example inserts (optional)
INSERT INTO `plans` (`slug`,`name`,`description`,`monthly_price`,`yearly_price`,`yearly_total`,`features`,`popular`,`cta`)
VALUES
('essential','Essential','One person, one device at a time.',1119,558,6704,JSON_ARRAY('Up to 3 devices','All 87 server locations','WireGuard & OpenVPN','Zero-log policy','Kill switch','Email support'),0,'Start trial'),
('standard','Standard','All features. Unlimited devices.',1679,838,10063,JSON_ARRAY('Unlimited devices','All 87 server locations','WireGuard & OpenVPN','Zero-log policy','Kill switch','Split tunneling','DNS leak protection','Priority support'),1,'Start trial'),
('team','Team','Centralized billing for 5–50 seats.',NULL,NULL,NULL,JSON_ARRAY('Everything in Standard','Centralized dashboard','Usage analytics','Dedicated IP option','SSO / SAML support','Account manager','SLA guarantee'),0,'Contact us');
