CREATE TABLE `scanHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runAt` timestamp NOT NULL DEFAULT (now()),
	`trigger` enum('cron','manual') NOT NULL DEFAULT 'cron',
	`status` enum('running','completed','failed') NOT NULL DEFAULT 'running',
	`found` int NOT NULL DEFAULT 0,
	`added` int NOT NULL DEFAULT 0,
	`skipped` int NOT NULL DEFAULT 0,
	`errorMsg` text,
	`addedLeadIds` json,
	`completedAt` timestamp,
	CONSTRAINT `scanHistory_id` PRIMARY KEY(`id`)
);
