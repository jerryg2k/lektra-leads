CREATE TABLE `emailSequences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`contactId` int,
	`contactName` varchar(255),
	`contactEmail` varchar(320),
	`stepNumber` int NOT NULL,
	`dayOffset` int NOT NULL,
	`subject` varchar(512) NOT NULL,
	`body` text NOT NULL,
	`status` enum('Draft','Scheduled','Sent','Skipped') NOT NULL DEFAULT 'Draft',
	`scheduledAt` timestamp,
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `emailSequences_id` PRIMARY KEY(`id`)
);
