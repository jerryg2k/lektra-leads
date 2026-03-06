CREATE TABLE `cardScans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scannedAt` timestamp NOT NULL DEFAULT (now()),
	`imageUrl` text,
	`company` varchar(255),
	`contactName` varchar(255),
	`contactTitle` varchar(255),
	`contactEmail` varchar(255),
	`leadId` int,
	`eventTag` varchar(100) DEFAULT 'GTC-2026',
	`userId` int,
	CONSTRAINT `cardScans_id` PRIMARY KEY(`id`)
);
