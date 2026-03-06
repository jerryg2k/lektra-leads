CREATE TABLE `gtcTargets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyName` varchar(255) NOT NULL,
	`contactName` varchar(255),
	`contactTitle` varchar(255),
	`type` enum('Elite Sponsor','Diamond Sponsor','Platinum Sponsor','Gold Sponsor','Silver Sponsor','Presenter','Startup') NOT NULL,
	`description` text,
	`gpuFitReason` text,
	`priorityTier` enum('Must Meet','High Value','Worth Visiting') NOT NULL,
	`priorityScore` int NOT NULL DEFAULT 0,
	`boothNumber` varchar(32),
	`website` varchar(512),
	`linkedinUrl` varchar(512),
	`addedToLeadsId` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `gtcTargets_id` PRIMARY KEY(`id`)
);
